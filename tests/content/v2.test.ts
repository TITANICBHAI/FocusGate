import { describe, expect, it, vi } from "vitest";
import { ContentScriptController, inspectFilterHealth } from "../../src/content/v2.ts";
import { getContentSiteForHost } from "../../src/content/sites.ts";
import { createDefaultState } from "../../src/shared/defaults.ts";
import type { AppState } from "../../src/shared/types.ts";

const NOW = Date.UTC(2026, 9, 28, 12);
const YOUTUBE_CONTAINER =
  "ytd-rich-item-renderer, ytd-compact-video-renderer, ytd-video-renderer, ytd-reel-item-renderer";
const YOUTUBE_TITLE = "#video-title, .ytd-reel-item-renderer";

class FakeElement {
  readonly nodeType = 1;
  readonly attributes = new Map<string, string>();
  parentElement: FakeElement | null = null;
  textContent = "";
  id = "";
  removed = false;
  children: FakeElement[] = [];

  constructor(
    private readonly matchedSelector?: string,
    textContent = "",
  ) {
    this.textContent = textContent;
  }

  matches(selector: string): boolean {
    return selector === this.matchedSelector;
  }

  closest(selector: string): FakeElement | null {
    return this.matches(selector) ? this : this.parentElement?.closest(selector) ?? null;
  }

  querySelectorAll(selector: string): FakeElement[] {
    if (
      selector === YOUTUBE_TITLE ||
      selector === "#video-title" ||
      selector === ".ytd-reel-item-renderer"
    ) {
      return this.children.filter((child) => child.textContent.length > 0);
    }
    return this.children.flatMap((child) => [
      ...(child.matches(selector) ? [child] : []),
      ...child.querySelectorAll(selector),
    ]);
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  removeAttribute(name: string): void {
    this.attributes.delete(name);
  }

  remove(): void {
    this.removed = true;
  }
}

function makeState(withKeyword = true): AppState {
  const state = createDefaultState();
  state.session.status = "work";
  state.session.phaseStartedAt = NOW;
  state.session.phaseEndsAt = NOW + 60_000;
  state.blockedSites = ["youtube.com"];
  state.settings.contentFilters = { ytShorts: true, keywordHide: true };
  state.settings.keywords.scope.title = true;
  state.keywords = withKeyword
    ? [{ text: "gambling", mode: "hide", when: "blocks" }]
    : [];
  return state;
}

function makeDependencies(initialState: AppState) {
  const title = new FakeElement(undefined, "A gambling video");
  const container = new FakeElement(YOUTUBE_CONTAINER);
  container.children = [title];
  title.parentElement = container;
  const root = new FakeElement();
  const styles = new Map<string, FakeElement>();
  const head = {
    append: (element: FakeElement) => {
      styles.set(element.id, element);
    },
  };
  const documentRef = {
    head,
    documentElement: root,
    defaultView: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    createElement: vi.fn(() => new FakeElement()),
    getElementById: (id: string) => styles.get(id) ?? null,
    querySelectorAll: vi.fn((selector: string) =>
      selector === YOUTUBE_CONTAINER ? [container] : [],
    ),
  } as unknown as Document;
  const scheduled: Array<{
    callback: () => void;
    delay: number;
    cancelled: boolean;
  }> = [];
  const observer = {
    observe: vi.fn(),
    disconnect: vi.fn(),
  } as unknown as MutationObserver;
  let currentState = initialState;
  let stateListener: (() => void) | undefined;
  const eventListeners = new Map<string, EventListenerOrEventListenerObject>();
  vi.mocked(documentRef.addEventListener).mockImplementation(
    ((name: string, listener: EventListenerOrEventListenerObject) => {
      eventListeners.set(name, listener);
    }) as typeof documentRef.addEventListener,
  );
  vi.mocked(documentRef.removeEventListener).mockImplementation(
    ((name: string) => {
      eventListeners.delete(name);
    }) as typeof documentRef.removeEventListener,
  );
  const dependencies = {
    document: documentRef,
    window: {} as Window,
    location: {
      href: "https://www.youtube.com/",
      hostname: "www.youtube.com",
    },
    getState: vi.fn(async () => currentState),
    onStateChanged: vi.fn((listener: () => void) => {
      stateListener = listener;
      return vi.fn();
    }),
    now: () => NOW,
    schedule: vi.fn((callback: () => void, delay: number) => {
      const timer = { callback, delay, cancelled: false };
      scheduled.push(timer);
      return timer as unknown as ReturnType<typeof setTimeout>;
    }),
    cancel: vi.fn((timer: ReturnType<typeof setTimeout>) => {
      const found = scheduled.find(
        (entry) => entry === (timer as unknown as object),
      );
      if (found) found.cancelled = true;
    }),
    createObserver: vi.fn(() => observer),
    isDev: false,
    logger: { info: vi.fn(), error: vi.fn() },
  };
  return {
    container,
    dependencies,
    observer,
    scheduled,
    title,
    dispatch(name: string) {
      const listener = eventListeners.get(name);
      if (typeof listener === "function") listener(new Event(name));
      else listener?.handleEvent(new Event(name));
    },
    setState(state: AppState) {
      currentState = state;
      stateListener?.();
    },
    styles,
    documentQuerySelectorAll: documentRef.querySelectorAll,
  };
}

describe("staged v2 content script", () => {
  it("uses one stylesheet and an observer on documentElement only for active hide words", async () => {
    const fixture = makeDependencies(makeState());
    const controller = new ContentScriptController(fixture.dependencies);
    const stop = await controller.start();

    expect(fixture.container.getAttribute("data-fg-hidden")).toBe("1");
    expect(fixture.styles.size).toBe(1);
    expect(fixture.styles.get("focusgate-filters")?.textContent).toContain(
      "ytd-reel-shelf-renderer",
    );
    expect(fixture.styles.get("focusgate-filters")?.textContent).toContain(
      '[data-fg-hidden="1"]',
    );
    expect(fixture.observer.observe).toHaveBeenCalledWith(
      (fixture.dependencies.document as Document).documentElement,
      { childList: true, subtree: true, characterData: true },
    );
    expect(fixture.scheduled.some((timer) => timer.delay === 60_001)).toBe(
      true,
    );

    fixture.dispatch("visibilitychange");
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fixture.dependencies.getState).toHaveBeenCalledTimes(2);

    const inactive = createDefaultState();
    fixture.setState(inactive);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(fixture.container.getAttribute("data-fg-hidden")).toBeNull();
    expect(fixture.styles.get("focusgate-filters")?.removed).toBe(true);
    expect(fixture.observer.disconnect).toHaveBeenCalled();
    stop();
  });

  it("debounces mutation processing by 200 ms", async () => {
    const fixture = makeDependencies(makeState());
    const controller = new ContentScriptController(fixture.dependencies);
    await controller.start();
    expect(fixture.dependencies.createObserver).toHaveBeenCalledOnce();
    expect(fixture.scheduled.some((timer) => timer.delay === 200)).toBe(false);

    const observerCallback = (fixture.dependencies.createObserver as ReturnType<
      typeof vi.fn
    >).mock.calls[0]?.[0] as MutationCallback;
    observerCallback(
      [
        {
          target: (fixture.dependencies.document as Document)
            .documentElement,
          addedNodes: [fixture.container] as unknown as NodeList,
        } as MutationRecord,
      ],
      fixture.observer,
    );
    const mutationTimer = fixture.scheduled.find(
      (timer) => timer.delay === 200,
    );
    expect(mutationTimer).toBeDefined();
    const queryCount = fixture.documentQuerySelectorAll.mock.calls.length;
    mutationTimer!.callback();
    expect(fixture.documentQuerySelectorAll).toHaveBeenCalledTimes(queryCount);
    controller.stop();
  });

  it("does not attach the observer for CSS-only filters", async () => {
    const fixture = makeDependencies(makeState(false));
    const controller = new ContentScriptController(fixture.dependencies);
    await controller.start();

    expect(fixture.styles.get("focusgate-filters")?.textContent).toContain(
      "ytd-reel-shelf-renderer",
    );
    expect(fixture.dependencies.createObserver).not.toHaveBeenCalled();
    controller.stop();
  });

  it("reprocesses YouTube content after SPA navigation", async () => {
    const state = makeState();
    const fixture = makeDependencies(state);
    fixture.title.textContent = "A different video";
    const controller = new ContentScriptController(fixture.dependencies);
    await controller.start();
    expect(fixture.container.getAttribute("data-fg-hidden")).toBeNull();

    fixture.title.textContent = "A gambling video";
    fixture.dispatch("yt-navigate-finish");
    expect(fixture.container.getAttribute("data-fg-hidden")).toBe("1");
    controller.stop();
  });

  it("does not retain an observer when observe throws at document start", async () => {
    const fixture = makeDependencies(makeState());
    vi.spyOn(fixture.observer, "observe").mockImplementation(() => {
      throw new Error("document is not observable yet");
    });
    const controller = new ContentScriptController(fixture.dependencies);
    await controller.start();

    expect(fixture.observer.disconnect).toHaveBeenCalledOnce();
    expect(fixture.dependencies.logger.error).toHaveBeenCalledOnce();
    controller.stop();
  });

  it("does not enable content filters when title scope is off and no block applies", async () => {
    const state = makeState();
    state.session.status = "idle";
    state.session.phaseEndsAt = 0;
    state.blockedSites = [];
    state.settings.keywords.scope.title = false;
    state.keywords = [{ text: "gambling", mode: "hide", when: "always" }];
    const fixture = makeDependencies(state);
    const controller = new ContentScriptController(fixture.dependencies);
    await controller.start();

    expect(fixture.container.getAttribute("data-fg-hidden")).toBeNull();
    expect(fixture.styles.size).toBe(0);
    expect(fixture.dependencies.createObserver).not.toHaveBeenCalled();
    controller.stop();
  });

  it("reports missing selectors only through the explicit health helper", () => {
    const site = getContentSiteForHost("youtube.com");
    expect(site).toBeDefined();
    const report = inspectFilterHealth(
      { querySelectorAll: () => [] } as unknown as Pick<
        Document,
        "querySelectorAll"
      >,
      site!,
    );
    expect(report.missingSelectors.length).toBeGreaterThan(0);
    expect(report.invalidSelectors).toEqual([]);
  });
});
