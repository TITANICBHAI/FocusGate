import { describe, expect, it } from "vitest";
import { registerBlockNavigation } from "../../src/background/blockNavigation.ts";
import type {
  NavigationDetails,
  NavigationEventSource,
  NavigationFilter,
} from "../../src/background/blockNavigation.ts";
import { createDefaultState } from "../../src/shared/defaults.ts";

function createEventSource() {
  const listeners: Array<(details: NavigationDetails) => void> = [];
  const filters: NavigationFilter[] = [];
  const source: NavigationEventSource = {
    addListener: (listener, filter) => {
      listeners.push(listener);
      filters.push(filter);
    },
    removeListener: (listener) => {
      const index = listeners.indexOf(listener);
      if (index >= 0) listeners.splice(index, 1);
    },
  };
  return {
    source,
    filters,
    emit(details: NavigationDetails) {
      for (const listener of [...listeners]) listener(details);
    },
    count: () => listeners.length,
  };
}

describe("staged navigation fallback", () => {
  it("registers only filtered webNavigation listeners and removes them cleanly", () => {
    const committed = createEventSource();
    const history = createEventSource();
    const dispose = registerBlockNavigation(
      { onCommitted: committed.source, onHistoryStateUpdated: history.source },
      {
        getState: async () => createDefaultState(),
        recordBlock: async () => undefined,
        updateTab: async () => undefined,
        blockedBase: "chrome-extension://test/blocked.html",
        now: () => 1_000,
      },
    );

    expect(committed.filters).toEqual([
      { url: [{ schemes: ["http", "https"] }] },
    ]);
    expect(history.filters).toEqual(committed.filters);
    expect(committed.count()).toBe(1);
    expect(history.count()).toBe(1);
    dispose();
    expect(committed.count()).toBe(0);
    expect(history.count()).toBe(0);
  });

  it("uses the shared decision function and ignores subframes/non-http URLs", async () => {
    const committed = createEventSource();
    const history = createEventSource();
    const state = createDefaultState();
    state.alwaysBlockedSites = ["example.com"];
    const recorded: Array<{ tabId: number; domain: string }> = [];
    const redirected: Array<{ tabId: number; url: string }> = [];
    registerBlockNavigation(
      { onCommitted: committed.source, onHistoryStateUpdated: history.source },
      {
        getState: async () => state,
        recordBlock: async (tabId, domain) => {
          recorded.push({ tabId, domain });
        },
        updateTab: async (tabId, url) => {
          redirected.push({ tabId, url });
        },
        blockedBase: "chrome-extension://test/blocked.html",
        now: () => 1_000,
      },
    );

    committed.emit({
      tabId: 4,
      frameId: 2,
      url: "https://example.com/frame",
    });
    committed.emit({ tabId: 4, frameId: 0, url: "file:///example.com" });
    committed.emit({
      tabId: 5,
      frameId: 0,
      url: "https://sub.example.com/path?x=1#part",
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(recorded).toEqual([{ tabId: 5, domain: "sub.example.com" }]);
    expect(redirected).toEqual([
      {
        tabId: 5,
        url: "chrome-extension://test/blocked.html#https://sub.example.com/path?x=1#part",
      },
    ]);
  });
});
