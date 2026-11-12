import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildWorkerApi,
  configureToolbarAction,
  type ChromeLike,
} from "../../src/background/chrome.ts";

function event<T = never>() {
  const listeners = new Set<(argument: T) => void>();
  return {
    addListener: (fn: (argument: T) => void) => void listeners.add(fn),
    removeListener: (fn: (argument: T) => void) => void listeners.delete(fn),
    fire: (argument: T) => listeners.forEach((fn) => fn(argument)),
    count: () => listeners.size,
  };
}

/** The parts of the browser every supported browser has. */
function core() {
  return {
    storage: {
      local: { get: async () => ({}), set: async () => undefined, remove: async () => undefined },
      session: { get: async () => ({}), set: async () => undefined },
    },
    alarms: {
      get: async () => undefined,
      create: () => undefined,
      clear: async () => true,
      getAll: async () => [],
      onAlarm: event<{ name: string; scheduledTime: number }>(),
    },
    action: { setBadgeText: async () => undefined },
    tabs: {
      query: vi.fn(async () => [{ id: 7, url: "https://example.com/", active: true, audible: true }]),
      update: async () => undefined,
      getCurrent: async () => undefined,
      create: vi.fn(async () => undefined),
      remove: async () => undefined,
      onActivated: event<{ tabId: number; windowId: number }>(),
    },
    webNavigation: {
      onCommitted: event<{ tabId: number; url: string; frameId: number }>(),
      onHistoryStateUpdated: event<{ tabId: number; url: string; frameId: number }>(),
    },
    declarativeNetRequest: {
      getDynamicRules: async () => [],
      updateDynamicRules: async () => undefined,
    },
    runtime: {
      getURL: (path: string) => `moz-extension://abc/${path}`,
      onInstalled: event<{ reason: string }>(),
      onStartup: event<void>(),
      onMessage: { addListener: () => undefined, removeListener: () => undefined },
    },
  };
}

/** What Firefox for Android has: no notifications, shortcuts, windows or idle. */
function androidLike(): ChromeLike {
  return core() as unknown as ChromeLike;
}

function desktopLike() {
  return {
    ...core(),
    notifications: { create: vi.fn(async () => "id") },
    commands: { onCommand: event<string>() },
    windows: {
      getLastFocused: async () => ({ focused: true, tabs: [] }),
      onFocusChanged: event<number>(),
    },
    idle: { queryState: async () => "idle" as const, onStateChanged: event<"active" | "idle" | "locked">() },
  };
}

afterEach(() => vi.restoreAllMocks());

describe("a browser without notifications, shortcuts, windows or idle (Firefox for Android)", () => {
  it("still builds the worker's browser API", () => {
    expect(() => buildWorkerApi(androidLike())).not.toThrow();
  });

  it("drops a notification instead of throwing", async () => {
    const api = buildWorkerApi(androidLike());
    await expect(Promise.resolve(api.notifications.create("n", { message: "hi" }))).resolves.toBe("");
  });

  it("accepts shortcut and window listeners that never fire", () => {
    const api = buildWorkerApi(androidLike());
    const listener = vi.fn();
    expect(() => api.commands.onCommand.addListener(listener)).not.toThrow();
    expect(() => api.commands.onCommand.removeListener(listener)).not.toThrow();
    expect(() => api.events.windowFocusChanged.addListener(listener)).not.toThrow();
    expect(() => api.events.idleStateChanged.addListener(listener)).not.toThrow();
  });

  it("treats the person as active when there is no idle API, so attention keeps counting", async () => {
    const api = buildWorkerApi(androidLike());
    await expect(api.idle.queryState(60)).resolves.toBe("active");
  });

  it("reads the foreground tab from the tabs API when there is no windows API", async () => {
    const chrome = androidLike();
    const api = buildWorkerApi(chrome);
    const result = await api.windows.getLastFocused();
    expect(result.focused).toBe(true);
    expect(result.tabs).toEqual([{ active: true, url: "https://example.com/", audible: true }]);
  });

  it("does not throw when the toolbar badge cannot be set", async () => {
    const chrome = androidLike();
    (chrome as unknown as { action?: unknown }).action = undefined;
    const api = buildWorkerApi(chrome);
    await expect(Promise.resolve(api.action.setBadgeText({ text: "5" }))).resolves.toBeUndefined();
  });
});

describe("a browser that has all of them (Firefox for desktop)", () => {
  it("uses the real notification, idle and window APIs", async () => {
    const chrome = desktopLike();
    const api = buildWorkerApi(chrome as unknown as ChromeLike);
    await api.notifications.create("n", { message: "hi" });
    expect(chrome.notifications.create).toHaveBeenCalledWith("n", { message: "hi" });
    await expect(api.idle.queryState(60)).resolves.toBe("idle");
    const listener = vi.fn();
    api.commands.onCommand.addListener(listener);
    chrome.commands.onCommand.fire("toggle-focus");
    expect(listener).toHaveBeenCalledWith("toggle-focus");
    expect(chrome.tabs.query).not.toHaveBeenCalled();
  });
});

describe("what the toolbar button does", () => {
  type ClickEvent = ReturnType<typeof event<{ windowId: number }>>;

  function withAction(extra: Record<string, unknown>) {
    const onClicked: ClickEvent = event<{ windowId: number }>();
    const chrome = { action: { onClicked }, tabs: { create: vi.fn(async () => undefined) }, runtime: { getURL: (p: string) => `moz-extension://abc/${p}` }, ...extra };
    return { chrome, onClicked };
  }

  it("opens the side panel in Chrome, as before", () => {
    const setPanelBehavior = vi.fn(async () => undefined);
    const { chrome } = withAction({ sidePanel: { setPanelBehavior } });
    configureToolbarAction(chrome as never);
    expect(setPanelBehavior).toHaveBeenCalledWith({ openPanelOnActionClick: true });
  });

  it("opens the Firefox sidebar with no arguments, because Firefox refuses extra ones", () => {
    const open = vi.fn(async () => undefined);
    const { chrome, onClicked } = withAction({ sidebarAction: { open } });
    configureToolbarAction(chrome as never);
    onClicked.fire({ windowId: 3 });
    expect(open).toHaveBeenCalledTimes(1);
    expect(open.mock.calls[0]).toHaveLength(0);
    expect(chrome.tabs.create).not.toHaveBeenCalled();
  });

  it("opens the panel in a tab where there is no side panel or sidebar (Firefox for Android)", () => {
    const { chrome, onClicked } = withAction({});
    configureToolbarAction(chrome as never);
    onClicked.fire({ windowId: 3 });
    expect(chrome.tabs.create).toHaveBeenCalledWith({ url: "moz-extension://abc/panel.html" });
  });

  it("never throws when the browser has no toolbar action API", () => {
    expect(() => configureToolbarAction({} as never)).not.toThrow();
  });
});
