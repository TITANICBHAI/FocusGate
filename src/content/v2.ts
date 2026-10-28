import { matchKeyword } from "../shared/keywords.ts";
import { computeBlockPlan, isFilteringActive } from "../shared/plan.ts";
import { getState, onStateChanged } from "../shared/storage.ts";
import type { AppState } from "../shared/types.ts";
import {
  applyKeywordVisibility,
  collectContainers,
  inspectFilterHealth,
  keywordText,
} from "./filterDom.ts";
import type { MutationBatch } from "./filterDom.ts";
import type { FilterHealthReport } from "./filterDom.ts";
import {
  buildFilterCss,
  getAllKeywordTargets,
  getContentSiteForUrl,
  getEnabledKeywordTargets,
  type ContentSiteDefinition,
} from "./sites.ts";

export const FILTER_STYLE_ID = "focusgate-filters";
export { inspectFilterHealth } from "./filterDom.ts";
export type { FilterHealthReport } from "./filterDom.ts";

type TimerHandle = ReturnType<typeof setTimeout>;

export interface ContentScriptDependencies {
  document: Document;
  window: Window;
  location: Pick<Location, "href" | "hostname">;
  getState: () => Promise<AppState>;
  onStateChanged: (listener: () => void) => () => void;
  now: () => number;
  schedule: (callback: () => void, delayMs: number) => TimerHandle;
  cancel: (timer: TimerHandle) => void;
  createObserver: (callback: MutationCallback) => MutationObserver;
  isDev: boolean;
  logger: Pick<Console, "info" | "error">;
}

type FilterWindow = Window & {
  __fgFilterHealth?: () => FilterHealthReport;
};

export class ContentScriptController {
  private state: AppState | null = null;
  private site: ContentSiteDefinition | undefined;
  private unsubscribe: (() => void) | undefined;
  private observer: MutationObserver | undefined;
  private boundaryTimer: TimerHandle | undefined;
  private mutationTimer: TimerHandle | undefined;
  private pendingMutationTargets = new Set<Node>();
  private pendingAddedNodes = new Set<Node>();
  private refreshQueue: Promise<void> = Promise.resolve();
  private started = false;
  private styleElement: HTMLStyleElement | undefined;
  private waitingForDocumentElement = false;

  private readonly onVisibilityChange = () => this.queueRefresh();
  private readonly onYoutubeNavigation = () => {
    if (this.state) this.render(true);
    else this.queueRefresh();
  };
  private readonly onDocumentReady = () => {
    this.waitingForDocumentElement = false;
    if (this.state) this.render(true);
  };

  constructor(private readonly dependencies: ContentScriptDependencies) {}

  async start(): Promise<() => void> {
    if (this.started) return () => this.stop();
    this.started = true;
    this.dependencies.document.addEventListener(
      "visibilitychange",
      this.onVisibilityChange,
    );
    if (this.dependencies.location.hostname === "www.youtube.com" ||
        this.dependencies.location.hostname.endsWith(".youtube.com") ||
        this.dependencies.location.hostname === "youtube.com") {
      this.dependencies.document.addEventListener(
        "yt-navigate-finish",
        this.onYoutubeNavigation,
      );
    }
    this.unsubscribe = this.dependencies.onStateChanged(() =>
      this.queueRefresh(),
    );
    this.installHealthHelper();
    try {
      await this.refreshState();
    } catch (error) {
      this.stop();
      throw error;
    }
    return () => this.stop();
  }

  stop(): void {
    if (!this.started) return;
    this.started = false;
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    this.dependencies.document.removeEventListener(
      "visibilitychange",
      this.onVisibilityChange,
    );
    this.dependencies.document.removeEventListener(
      "yt-navigate-finish",
      this.onYoutubeNavigation,
    );
    this.dependencies.document.removeEventListener(
      "DOMContentLoaded",
      this.onDocumentReady,
    );
    this.waitingForDocumentElement = false;
    this.cancelTimers();
    this.disconnectObserver();
    if (this.site) {
      this.clearKeywordVisibility(this.site);
      this.site = undefined;
    }
    this.setStyles("");
    const filterWindow = this.dependencies.window as FilterWindow;
    if (filterWindow.__fgFilterHealth) {
      delete filterWindow.__fgFilterHealth;
    }
    this.state = null;
  }

  private queueRefresh(): void {
    void this.refreshState().catch((error: unknown) => {
      this.dependencies.logger.error(
        "FocusGate content script could not refresh state.",
        error,
      );
    });
  }

  private refreshState(): Promise<void> {
    const refresh = this.refreshQueue.then(async () => {
      if (!this.started) return;
      this.state = await this.dependencies.getState();
      if (this.started) this.render(true);
    });
    this.refreshQueue = refresh.catch(() => undefined);
    return refresh;
  }

  private render(fullScan: boolean, changedNodes?: MutationBatch): void {
    if (!this.started || !this.state) return;

    const url = new URL(this.dependencies.location.href);
    const nextSite = getContentSiteForUrl(url);
    if (this.site && this.site !== nextSite) {
      this.clearKeywordVisibility(this.site);
    }
    this.site = nextSite;

    if (!nextSite) {
      this.setStyles("");
      this.disconnectObserver();
      this.cancelBoundaryTimer();
      return;
    }

    const now = this.dependencies.now();
    const plan = computeBlockPlan(this.state, now);
    const filteringActive = isFilteringActive(
      this.state,
      now,
      this.dependencies.location.hostname,
    );
    const activeHideWords = this.state.settings.keywords.scope.title
      ? plan.hideWords
      : [];
    const enabledTargets = filteringActive && activeHideWords.length > 0
      ? getEnabledKeywordTargets(
          nextSite,
          this.state.settings.contentFilters,
        )
      : [];
    const activeFilterIds = new Set(
      enabledTargets.map(({ filterId }) => filterId),
    );

    this.setStyles(
      filteringActive
        ? buildFilterCss(
            nextSite,
            this.state.settings.contentFilters,
            enabledTargets.length > 0,
          )
        : "",
    );
    this.updateKeywordVisibility(
      nextSite,
      activeFilterIds,
      activeHideWords,
      this.state.settings.keywords.match,
      fullScan ? undefined : changedNodes,
    );
    this.syncObserver(enabledTargets.length > 0 && activeHideWords.length > 0);
    this.scheduleBoundary(plan.nextBoundaryAt, now);
  }

  private updateKeywordVisibility(
    site: ContentSiteDefinition,
    activeFilterIds: ReadonlySet<string>,
    words: string[],
    matchMode: "substring" | "wholeWord",
    changedNodes?: MutationBatch,
  ): void {
    for (const { filterId, target } of getAllKeywordTargets(site)) {
      const enabled = activeFilterIds.has(filterId) && words.length > 0;
      const containers = collectContainers(
        this.dependencies.document,
        target.containerSelector,
        changedNodes,
      );
      for (const container of containers) {
        const hiddenElement = target.hideSelector
          ? container.closest(target.hideSelector) ?? container
          : container;
        const shouldHide =
          enabled &&
          matchKeyword(keywordText(container, target), words, matchMode) !==
            null;
        if (shouldHide) {
          if (hiddenElement.getAttribute("data-fg-hidden") !== "1") {
            hiddenElement.setAttribute("data-fg-hidden", "1");
          }
        } else if (hiddenElement.getAttribute("data-fg-hidden") === "1") {
          hiddenElement.removeAttribute("data-fg-hidden");
        }
      }
    }
  }

  private clearKeywordVisibility(site: ContentSiteDefinition): void {
    for (const { target } of getAllKeywordTargets(site)) {
      applyKeywordVisibility(this.dependencies.document, target, false);
    }
  }

  private setStyles(cssText: string): void {
    if (!cssText) {
      this.styleElement?.remove();
      this.styleElement = undefined;
      return;
    }
    const existing =
      this.dependencies.document.getElementById(FILTER_STYLE_ID) as
        | HTMLStyleElement
        | null;
    if (existing) {
      this.styleElement = existing;
      if (existing.textContent !== cssText) {
        existing.textContent = cssText;
      }
      return;
    }
    const parent =
      this.dependencies.document.head ??
      this.dependencies.document.documentElement;
    if (!parent) {
      if (!this.waitingForDocumentElement) {
        this.waitingForDocumentElement = true;
        this.dependencies.document.addEventListener(
          "DOMContentLoaded",
          this.onDocumentReady,
          { once: true },
        );
      }
      return;
    }
    const style = this.dependencies.document.createElement("style");
    style.id = FILTER_STYLE_ID;
    style.textContent = cssText;
    parent.append(style);
    this.styleElement = style;
  }

  private syncObserver(needed: boolean): void {
    if (!needed) {
      this.disconnectObserver();
      this.cancelMutationTimer();
      return;
    }
    if (this.observer) return;
    const root = this.dependencies.document.documentElement;
    if (!root) {
      if (!this.waitingForDocumentElement) {
        this.waitingForDocumentElement = true;
        this.dependencies.document.addEventListener(
          "DOMContentLoaded",
          this.onDocumentReady,
          { once: true },
        );
      }
      return;
    }

    let observer: MutationObserver | undefined;
    try {
      observer = this.dependencies.createObserver((records) => {
        this.queueMutationWork(records);
      });
      observer.observe(root, {
        childList: true,
        subtree: true,
        characterData: true,
      });
      this.observer = observer;
    } catch (error) {
      observer?.disconnect();
      this.dependencies.logger.error(
        "FocusGate could not observe the document element.",
        error,
      );
    }
  }

  private queueMutationWork(records: MutationRecord[]): void {
    for (const record of records) {
      this.pendingMutationTargets.add(record.target);
      for (const node of record.addedNodes) {
        this.pendingAddedNodes.add(node);
      }
    }
    if (this.mutationTimer) {
      this.dependencies.cancel(this.mutationTimer);
    }
    this.mutationTimer = this.dependencies.schedule(() => {
      this.mutationTimer = undefined;
      const changedNodes: MutationBatch = {
        targets: [...this.pendingMutationTargets],
        addedNodes: [...this.pendingAddedNodes],
      };
      this.pendingMutationTargets.clear();
      this.pendingAddedNodes.clear();
      if (this.state) this.render(false, changedNodes);
    }, 200);
  }

  private scheduleBoundary(nextBoundaryAt: number | null, now: number): void {
    this.cancelBoundaryTimer();
    if (nextBoundaryAt === null) return;
    const delay = Math.max(
      0,
      Math.min(nextBoundaryAt - now + 1, 2_147_483_647),
    );
    this.boundaryTimer = this.dependencies.schedule(
      () => this.queueRefresh(),
      delay,
    );
  }

  private cancelBoundaryTimer(): void {
    if (this.boundaryTimer === undefined) return;
    this.dependencies.cancel(this.boundaryTimer);
    this.boundaryTimer = undefined;
  }

  private cancelMutationTimer(): void {
    if (this.mutationTimer !== undefined) {
      this.dependencies.cancel(this.mutationTimer);
      this.mutationTimer = undefined;
    }
    this.pendingMutationTargets.clear();
    this.pendingAddedNodes.clear();
  }

  private cancelTimers(): void {
    this.cancelBoundaryTimer();
    this.cancelMutationTimer();
  }

  private disconnectObserver(): void {
    this.observer?.disconnect();
    this.observer = undefined;
  }

  private installHealthHelper(): void {
    if (!this.dependencies.isDev) return;
    const filterWindow = this.dependencies.window as FilterWindow;
    filterWindow.__fgFilterHealth = () => {
      const site = getContentSiteForUrl(new URL(this.dependencies.location.href));
      const report = site
        ? inspectFilterHealth(this.dependencies.document, site)
        : { hosts: [], missingSelectors: [], invalidSelectors: [] };
      this.dependencies.logger.info(
        "FocusGate content-filter selector health",
        report,
      );
      return report;
    };
  }
}

export function createContentScriptDependencies(
  documentRef: Document,
  windowRef: Window,
): ContentScriptDependencies {
  return {
    document: documentRef,
    window: windowRef,
    location: windowRef.location,
    getState,
    onStateChanged,
    now: Date.now,
    schedule: (callback, delayMs) =>
      windowRef.setTimeout(callback, delayMs) as unknown as TimerHandle,
    cancel: (timer) => windowRef.clearTimeout(timer as unknown as number),
    createObserver: (callback) => new MutationObserver(callback),
    isDev: import.meta.env.DEV,
    logger: console,
  };
}

/** Staged until WP5 promotes the active content-script entrypoint. */
export async function startV2ContentScript(): Promise<() => void> {
  const dependencies = createContentScriptDependencies(document, window);
  const controller = new ContentScriptController(dependencies);
  return controller.start();
}
