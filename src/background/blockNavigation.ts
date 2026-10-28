import { normalizeDomain } from "../shared/domains.ts";
import { explainBlock } from "../shared/plan.ts";
import type { BlockReason } from "../shared/plan.ts";
import type { AppState } from "../shared/types.ts";

export interface NavigationDetails {
  tabId: number;
  frameId: number;
  url: string;
}

export interface NavigationFilter {
  url: Array<{ schemes: string[] }>;
}

export interface NavigationEventSource {
  addListener(
    listener: (details: NavigationDetails) => void,
    filter: NavigationFilter,
  ): void;
  removeListener(listener: (details: NavigationDetails) => void): void;
}

export interface WebNavigationSources {
  onCommitted: NavigationEventSource;
  onHistoryStateUpdated: NavigationEventSource;
}

export interface BlockNavigationDependencies {
  getState(): Promise<AppState>;
  recordBlock(tabId: number, domain: string, reason: BlockReason): Promise<void>;
  updateTab(tabId: number, url: string): Promise<void>;
  blockedBase: string;
  now(): number;
  onError?(error: unknown): void;
}

function validNavigation(details: NavigationDetails): URL | null {
  if (details.frameId !== 0 || details.tabId < 0) return null;
  try {
    const url = new URL(details.url);
    return url.protocol === "http:" || url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

/**
 * Creates staged webNavigation fallbacks. This module is deliberately not
 * registered by the active v1 worker; S1 and the WP5 cutover gate activation.
 */
export function registerBlockNavigation(
  events: WebNavigationSources,
  dependencies: BlockNavigationDependencies,
): () => void {
  const handle = (details: NavigationDetails): void => {
    const url = validNavigation(details);
    if (!url) return;
    void (async () => {
      const state = await dependencies.getState();
      const reason = explainBlock(url.href, state, dependencies.now());
      if (!reason) return;
      const domain = normalizeDomain(url.hostname);
      if (!domain) return;

      try {
        await dependencies.recordBlock(details.tabId, domain, reason);
      } catch (error) {
        dependencies.onError?.(error);
      }
      try {
        await dependencies.updateTab(
          details.tabId,
          `${dependencies.blockedBase}#${url.href}`,
        );
      } catch (error) {
        dependencies.onError?.(error);
      }
    })().catch((error: unknown) => dependencies.onError?.(error));
  };

  const filter: NavigationFilter = { url: [{ schemes: ["http", "https"] }] };
  events.onCommitted.addListener(handle, filter);
  events.onHistoryStateUpdated.addListener(handle, filter);
  return () => {
    events.onCommitted.removeListener(handle);
    events.onHistoryStateUpdated.removeListener(handle);
  };
}
