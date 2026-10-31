import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createWorker,
  type WorkerBrowserApi,
  type WorkerMessageEvent,
} from "../../src/background/worker.ts";
import {
  MIDNIGHT_ALARM,
  TICK_ALARM,
  WEEKLY_REPORT_ALARM,
} from "../../src/background/alarms.ts";
import type { AppState } from "../../src/shared/types.ts";

function createSignal<T>() {
  const listeners = new Set<(argument: T) => void>();
  return {
    source: {
      addListener(listener: (argument: T) => void) {
        listeners.add(listener);
      },
      removeListener(listener: (argument: T) => void) {
        listeners.delete(listener);
      },
    },
    emit(argument: T) {
      listeners.forEach((listener) => listener(argument));
    },
    count() {
      return listeners.size;
    },
  };
}

class FakeArea {
  private store = new Map<string, unknown>();

  constructor(seed: Record<string, unknown> = {}) {
    for (const [key, value] of Object.entries(seed)) {
      this.store.set(key, structuredClone(value));
    }
  }

  async get(keys: string | string[] | Record<string, unknown> | null) {
    if (keys === null) return Object.fromEntries(this.store);
    if (typeof keys === "string") {
      return this.store.has(keys)
        ? { [keys]: this.store.get(keys) }
        : {};
    }
    if (Array.isArray(keys)) {
      const result: Record<string, unknown> = {};
      for (const key of keys) {
        if (this.store.has(key)) result[key] = this.store.get(key);
      }
      return result;
    }
    const result: Record<string, unknown> = { ...keys };
    for (const key of Object.keys(keys)) {
      if (this.store.has(key)) result[key] = this.store.get(key);
    }
    return result;
  }

  async set(items: Record<string, unknown>) {
    for (const [key, value] of Object.entries(items)) {
      this.store.set(key, structuredClone(value));
    }
  }

  async remove(keys: string | string[]) {
    for (const key of Array.isArray(keys) ? keys : [keys]) {
      this.store.delete(key);
    }
  }
}

function createHarness(seed: Record<string, unknown> = {}) {
  let now = 1_000_000;
  const local = new FakeArea(seed);
  const sessionArea = new FakeArea();
  const signals = {
    onInstalled: createSignal<{ reason: string }>(),
    onAlarm: createSignal<string>(),
    onCommand: createSignal<string>(),
    onMessage: createSignal<WorkerMessageEvent>(),
    onCommitted: createSignal<{ tabId: number; url: string; frameId: number }>(),
    onHistoryStateUpdated: createSignal<{
      tabId: number;
      url: string;
      frameId: number;
    }>(),
    tabActivated: createSignal<void>(),
    windowFocusChanged: createSignal<void>(),
    idleStateChanged: createSignal<void>(),
  };
  const tabs: Array<{ id?: number; url?: string }> = [
    { id: 5, url: "https://x.com/home" },
  ];
  const dnrRules: Array<{ id: number }> = [];
  const badgeTitles: string[] = [];
  const notificationMessages: string[] = [];
  const errors: string[] = [];

  const chromeLike = {
    storage: { local, session: sessionArea },
    alarms: {
      get: async (name: string) =>
        sessionAreaHasAlarm(name) ? { name, scheduledTime: 0 } : undefined,
      create: async () => undefined,
      clear: async () => undefined,
    },
    notifications: {
      create: async (
        id: string,
        options: { message: string },
      ) => {
        notificationMessages.push(`${id}:${options.message}`);
        return id;
      },
    },
    action: {
      setBadgeText: async () => undefined,
      setBadgeBackgroundColor: async () => undefined,
      setTitle: async ({ title }: { title: string }) => {
        badgeTitles.push(title);
      },
    },
    tabs: {
      update: async (tabId: number, url: string) => {
        const tab = tabs.find((item) => item.id === tabId);
        if (tab) tab.url = url;
      },
      getCurrent: async () => tabs[0],
      remove: async (tabId: number) => {
        const index = tabs.findIndex((item) => item.id === tabId);
        if (index >= 0) tabs.splice(index, 1);
      },
    },
  };

  function sessionAreaHasAlarm(name: string): boolean {
    // The fake has no real alarm registry for this probe; worker tests use
    // the onAlarm signal directly instead of the registry.
    void name;
    return false;
  }

  (globalThis as { chrome?: unknown }).chrome = chromeLike;

  const api: WorkerBrowserApi = {
    now: () => now,
    onError: (effect, error) => {
      errors.push(`${effect}: ${String(error)}`);
    },
    alarms: {
      get: async () => undefined,
      create: async () => undefined,
      clear: async () => undefined,
      onAlarm: signals.onAlarm.source,
    },
    notifications: {
      create: chromeLike.notifications.create,
    },
    action: chromeLike.action,
    tabs: {
      queryActive: async () => tabs,
      queryAll: async () => tabs,
      update: chromeLike.tabs.update,
      getCurrent: chromeLike.tabs.getCurrent,
      remove: chromeLike.tabs.remove,
    },
    webNavigation: {
      onCommitted: signals.onCommitted.source,
      onHistoryStateUpdated: signals.onHistoryStateUpdated.source,
    },
    commands: { onCommand: signals.onCommand.source },
    windows: {
      getLastFocused: async () => ({
        focused: true,
        tabs: [{ active: true, url: tabs[0]?.url }],
      }),
    },
    idle: { queryState: async () => "active" },
    declarativeNetRequest: {
      getDynamicRules: async () => dnrRules,
      updateDynamicRules: async (update) => {
        dnrRules.length = 0;
        dnrRules.push(...update.addRules);
      },
    },
    session: {
      get: async (keys) => sessionArea.get(keys),
      set: async (items) => sessionArea.set(items),
    },
    runtime: {
      getURL: (path) => `chrome-extension://test/${path}`,
      onInstalled: signals.onInstalled.source,
      onMessage: signals.onMessage.source,
    },
    events: {
      tabActivated: signals.tabActivated.source,
      windowFocusChanged: signals.windowFocusChanged.source,
      idleStateChanged: signals.idleStateChanged.source,
    },
  };

  const worker = createWorker(api);
  const localStore = () => local.get(null) as Promise<AppState>;

  return {
    worker,
    signals,
    errors,
    badgeTitles,
    notificationMessages,
    dnrRules,
    tabs,
    setNow: (value: number) => {
      now = value;
    },
    localState: async () => (await local.get(null)) as AppState,
  };
}

describe("v2 worker composition (dormant until cutover)", () => {
  let harness: ReturnType<typeof createHarness>;

  beforeEach(() => {
    harness = createHarness();
  });

  afterEach(() => {
    delete (globalThis as { chrome?: unknown }).chrome;
  });

  it("registers every listener on start and detaches on stop", () => {
    const stop = harness.worker.start();
    expect(harness.signals.onInstalled.count()).toBe(1);
    expect(harness.signals.onAlarm.count()).toBe(1);
    expect(harness.signals.onCommand.count()).toBe(1);
    expect(harness.signals.onMessage.count()).toBe(1);
    // webNavigation.onCommitted carries both the navigation fallback and the
    // attention main-frame source.
    expect(harness.signals.onCommitted.count()).toBe(2);
    expect(harness.signals.onHistoryStateUpdated.count()).toBe(1);
    expect(harness.signals.tabActivated.count()).toBe(1);

    stop();
    expect(harness.signals.onInstalled.count()).toBe(0);
    expect(harness.signals.onAlarm.count()).toBe(0);
    // Both onCommitted listeners (navigation fallback + attention) detach.
    expect(harness.signals.onCommitted.count()).toBe(0);
  });

  it("finalizes the install flow: migration, recovery, and rule install", async () => {
    // A v2-shaped seed with one always-blocked site: the install flow must
    // install a redirect rule for it and leave the session idle.
    const harness = createHarness({
      schemaVersion: 2,
      alwaysBlockedSites: ["example.com"],
    });
    await harness.worker.handleInstalled({ reason: "update" });
    expect(harness.dnrRules.length).toBe(1);
    const state = await harness.localState();
    expect(state.schemaVersion).toBe(2);
    expect(state.session.status).toBe("idle");
  });

  it("dispatches session/start and updates the badge", async () => {
    const response = (await harness.worker.handleMessage({
      type: "session/start",
      durationMin: 25,
      lockLevel: "none",
    })) as { ok: boolean };

    expect(response.ok).toBe(true);
    const state = await harness.localState();
    expect(state.session.status).toBe("work");
    expect(harness.badgeTitles.some((title) => title.includes("focus"))).toBe(
      true,
    );
  });

  it("routes guarded state writes without a password for strengthening", async () => {
    const response = (await harness.worker.handleMessage({
      type: "state/write",
      key: "blockedSites",
      value: ["example.com"],
    })) as { ok: boolean };

    expect(response.ok).toBe(true);
    const state = await harness.localState();
    expect(state.blockedSites).toEqual(["example.com"]);
  });

  it("returns undefined for unknown messages", async () => {
    expect(await harness.worker.handleMessage({ type: "nope" })).toBeUndefined();
  });

  it("handles the toggle-focus and quick-block commands", async () => {
    expect(await harness.worker.handleCommand("toggle-focus")).toBe(true);
    const state = await harness.localState();
    expect(state.session.status).toBe("work");

    expect(await harness.worker.handleCommand("block-current-site")).toBe(true);
    const updated = await harness.localState();
    // The alias group of x.com is added, not just the typed host.
    expect(updated.blockedSites).toContain("x.com");
    expect(updated.blockedSites).toContain("twitter.com");
    expect(harness.tabs[0]?.url).toContain("blocked.html");
  });

  it("updates the heartbeat on ticks", async () => {
    await harness.worker.handleMessage({
      type: "session/start",
      durationMin: 25,
      lockLevel: "none",
    });
    harness.setNow(1_060_000);
    expect(await harness.worker.handleAlarm(TICK_ALARM)).toBe(true);
    const state = await harness.localState();
    expect(state.session.lastHeartbeatAt).toBe(1_060_000);
  });

  it("runs the midnight hooks and writes the weekly report on its alarm", async () => {
    await harness.worker.handleAlarm(MIDNIGHT_ALARM);
    const state = await harness.localState();
    // The key is only written when a report exists; absent means null.
    expect(state.lastWeeklyReport ?? null).toBeNull();

    await harness.worker.handleAlarm(WEEKLY_REPORT_ALARM);
    const updated = await harness.localState();
    expect(updated.lastWeeklyReport).not.toBeNull();
    expect(updated.weeklyReports).toHaveLength(1);
    expect(harness.notificationMessages.some((message) =>
      message.startsWith("focusgate-weekly_report:"),
    )).toBe(true);
  });
});
