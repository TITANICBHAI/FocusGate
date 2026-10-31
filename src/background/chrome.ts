import { createWorker, type WorkerBrowserApi, type WorkerEventSource, type WorkerMessageEvent } from "./worker.ts";
import type { TaskReminderButtonEvents } from "./taskAlarms.ts";
import type { DnrRule } from "../shared/dnr.ts";

/**
 * WP5 cutover adapter: maps the browser's chrome.* APIs onto the injected
 * WorkerBrowserApi and activates the v2 worker. Typed locally (the same
 * self-contained pattern as shared/storage.ts) so the build never depends on
 * @types/chrome resolution.
 */

type ChromeEvent<T> = {
  addListener(callback: (argument: T) => void): void;
  removeListener(callback: (argument: T) => void): void;
};

interface ChromeLike {
  storage: {
    local: {
      get(
        keys: string | string[] | Record<string, unknown> | null,
      ): Promise<Record<string, unknown>>;
      set(items: Record<string, unknown>): Promise<void>;
      remove(keys: string | string[]): Promise<void>;
    };
    session: {
      get(keys: string[]): Promise<Record<string, unknown>>;
      set(items: Record<string, unknown>): Promise<void>;
    };
  };
  alarms: {
    get(name: string): Promise<{ name: string; scheduledTime: number } | undefined>;
    create(
      name: string,
      info: { when?: number; delayInMinutes?: number; periodInMinutes?: number },
    ): void;
    clear(name: string): boolean | Promise<boolean>;
    getAll(): Promise<Array<{ name: string; scheduledTime: number }>>;
    onAlarm: ChromeEvent<string>;
  };
  notifications: {
    create(id: string, options: unknown): string | Promise<string>;
    onButtonClicked?: ChromeEvent<[string, number]>;
  };
  action: {
    setBadgeText(details: { text: string }): void | Promise<void>;
    setBadgeBackgroundColor?(details: { color: string }): void | Promise<void>;
    setTitle?(details: { title: string }): void | Promise<void>;
  };
  tabs: {
    query(query: unknown): Promise<Array<{ id?: number; url?: string }>>;
    update(tabId: number, url: string): Promise<unknown>;
    getCurrent(): Promise<{ id?: number } | undefined>;
    remove(tabId: number): Promise<void>;
    onActivated: ChromeEvent<unknown>;
  };
  webNavigation: {
    onCommitted: ChromeEvent<{ tabId: number; url: string; frameId: number }>;
    onHistoryStateUpdated: ChromeEvent<{
      tabId: number;
      url: string;
      frameId: number;
    }>;
  };
  commands: { onCommand: ChromeEvent<string> };
  windows: {
    getLastFocused(): Promise<{
      focused?: boolean;
      tabs?: Array<{ active?: boolean; url?: string; audible?: boolean }>;
    }>;
    onFocusChanged: ChromeEvent<unknown>;
  };
  idle: {
    queryState(detectionIntervalSeconds: number): Promise<
      "active" | "idle" | "locked"
    >;
    onStateChanged: ChromeEvent<"active" | "idle" | "locked">;
  };
  declarativeNetRequest: {
    getDynamicRules(): Promise<unknown[]>;
    updateDynamicRules(update: {
      removeRuleIds: number[];
      addRules: unknown[];
    }): Promise<void>;
  };
  runtime: {
    getURL(path: string): string;
    onInstalled: ChromeEvent<{ reason: string }>;
    onMessage: ChromeEvent<[unknown, unknown, (response: unknown) => void]>;
  };
}

function chromeApi(): ChromeLike {
  const chrome = (globalThis as { chrome?: ChromeLike }).chrome;
  if (!chrome) {
    throw new Error(
      "FocusGate must run inside a browser extension context (chrome APIs unavailable).",
    );
  }
  return chrome;
}

function adaptEvent<TArgument, TEvent>(
  event: ChromeEvent<TEvent>,
  project: (argument: TEvent) => TArgument,
): WorkerEventSource<TArgument> {
  return {
    addListener(listener: (argument: TArgument) => void) {
      event.addListener((argument: TEvent) => listener(project(argument)));
    },
    removeListener(listener: (argument: TArgument) => void) {
      event.removeListener((argument: TEvent) => listener(project(argument)));
    },
  };
}

export function createChromeWorker(): ReturnType<
  typeof createWorker
> {
  const chrome = chromeApi();

  const api: WorkerBrowserApi = {
    now: () => Date.now(),
    alarms: {
      get: (name) => chrome.alarms.get(name),
      create: (name, info) => chrome.alarms.create(name, info),
      clear: (name) => chrome.alarms.clear(name),
      getAll: async () => await chrome.alarms.getAll(),
      onAlarm: chrome.alarms.onAlarm,
    },
    notifications: {
      create: (id, options) => chrome.notifications.create(id, options),
      ...(chrome.notifications.onButtonClicked
        ? {
            onButtonClicked: chrome.notifications
              .onButtonClicked as unknown as TaskReminderButtonEvents,
          }
        : {}),
    },
    action: chrome.action,
    tabs: {
      queryActive: async () => await chrome.tabs.query({ active: true, currentWindow: true }),
      queryAll: async () => await chrome.tabs.query({}),
      update: async (tabId, url) => {
        await chrome.tabs.update(tabId, { url });
      },
      getCurrent: async () => await chrome.tabs.getCurrent(),
      remove: async (tabId) => {
        await chrome.tabs.remove(tabId);
      },
    },
    webNavigation: {
      onCommitted: chrome.webNavigation.onCommitted,
      onHistoryStateUpdated: chrome.webNavigation.onHistoryStateUpdated,
    },
    commands: { onCommand: chrome.commands.onCommand },
    windows: {
      getLastFocused: async () => {
        const window = await chrome.windows.getLastFocused();
        return {
          focused: window.focused === true,
          tabs: (window.tabs ?? []) as Array<{
            active: boolean;
            url?: string;
            audible?: boolean;
          }>,
        };
      },
    },
    idle: { queryState: (seconds) => chrome.idle.queryState(seconds) },
    declarativeNetRequest: {
      getDynamicRules: async () =>
        (await chrome.declarativeNetRequest.getDynamicRules()) as DnrRule[],
      updateDynamicRules: async (update) => {
        await chrome.declarativeNetRequest.updateDynamicRules(update);
      },
    },
    session: {
      get: async (keys) => await chrome.storage.session.get(keys),
      set: async (items) => {
        await chrome.storage.session.set(items);
      },
    },
    runtime: {
      getURL: (path) => chrome.runtime.getURL(path),
      onInstalled: chrome.runtime.onInstalled,
      onMessage: {
        addListener(listener: (event: WorkerMessageEvent) => void) {
          chrome.runtime.onMessage.addListener(
            (message, _sender, sendResponse) => {
              listener({ message, sendResponse });
              return true;
            },
          );
        },
        removeListener() {
          // chrome.runtime.onMessage has no targeted removal for wrapped
          // listeners; the worker registers this listener once per worker.
        },
      },
    },
    events: {
      tabActivated: adaptEvent(chrome.tabs.onActivated, () => undefined),
      windowFocusChanged: adaptEvent(
        chrome.windows.onFocusChanged,
        () => undefined,
      ),
      idleStateChanged: adaptEvent(
        chrome.idle.onStateChanged,
        (state) => state,
      ),
    },
  };

  return createWorker(api);
}
