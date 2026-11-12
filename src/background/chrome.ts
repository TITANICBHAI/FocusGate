import {
  createWorker,
  type WorkerBrowserApi,
  type WorkerEventSource,
  type WorkerMessageEvent,
} from "./worker.ts";
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

type ChromeMessageEvent = {
  addListener(
    callback: (
      message: unknown,
      sender: unknown,
      sendResponse: (response: unknown) => void,
    ) => boolean | void,
  ): void;
  removeListener(
    callback: (
      message: unknown,
      sender: unknown,
      sendResponse: (response: unknown) => void,
    ) => boolean | void,
  ): void;
};

export interface ChromeLike {
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
    get(
      name: string,
    ): Promise<{ name: string; scheduledTime: number } | undefined>;
    create(
      name: string,
      info: {
        when?: number;
        delayInMinutes?: number;
        periodInMinutes?: number;
      },
    ): void;
    clear(name: string): boolean | Promise<boolean>;
    getAll(): Promise<Array<{ name: string; scheduledTime: number }>>;
    onAlarm: ChromeEvent<{ name: string; scheduledTime: number }>;
  };
  /** Missing on Firefox for Android. */
  notifications?: {
    create(id: string, options: unknown): string | Promise<string>;
    onButtonClicked?: ChromeEvent<string> & {
      addListener(
        callback: (notificationId: string, buttonIndex: number) => void,
      ): void;
      removeListener(
        callback: (notificationId: string, buttonIndex: number) => void,
      ): void;
    };
  };
  /** Missing or limited on Firefox for Android. */
  action?: {
    setBadgeText(details: { text: string }): void | Promise<void>;
    setBadgeBackgroundColor?(details: { color: string }): void | Promise<void>;
    setTitle?(details: { title: string }): void | Promise<void>;
  };
  tabs: {
    query(
      query: unknown,
    ): Promise<Array<{ id?: number; url?: string; active?: boolean; audible?: boolean }>>;
    update(
      tabId: number,
      properties: { url?: string },
    ): Promise<unknown>;
    getCurrent(): Promise<{ id?: number } | undefined>;
    create(properties: { url: string }): Promise<unknown>;
    remove(tabId: number): Promise<void>;
    onActivated: ChromeEvent<{ tabId: number; windowId: number }>;
  };
  webNavigation: {
    onCommitted: ChromeEvent<{ tabId: number; url: string; frameId: number }>;
    onHistoryStateUpdated: ChromeEvent<{
      tabId: number;
      url: string;
      frameId: number;
    }>;
  };
  /** Missing on Firefox for Android (no keyboard). */
  commands?: { onCommand: ChromeEvent<string> };
  /** Missing or limited on Firefox for Android (one browser window). */
  windows?: {
    getLastFocused(): Promise<{
      focused?: boolean;
      tabs?: Array<{ active?: boolean; url?: string; audible?: boolean }>;
    }>;
    onFocusChanged: ChromeEvent<number>;
  };
  /** Missing on Firefox for Android. */
  idle?: {
    queryState(
      detectionIntervalSeconds: number,
    ): Promise<"active" | "idle" | "locked">;
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
    onStartup: ChromeEvent<void>;
    onMessage: ChromeMessageEvent;
  };
}

function chromeApi(): ChromeLike {
  const chrome = (globalThis as unknown as { chrome?: ChromeLike }).chrome;
  if (!chrome) {
    throw new Error(
      "FocusGate must run inside a browser extension context (chrome APIs unavailable).",
    );
  }
  return chrome;
}

export function adaptEvent<TArgument, TEvent>(
  event: ChromeEvent<TEvent>,
  project: (argument: TEvent) => TArgument,
): WorkerEventSource<TArgument> {
  const wrappers = new Map<
    (argument: TArgument) => void,
    (argument: TEvent) => void
  >();
  return {
    addListener(listener: (argument: TArgument) => void) {
      const wrapper = (argument: TEvent) => listener(project(argument));
      wrappers.set(listener, wrapper);
      event.addListener(wrapper);
    },
    removeListener(listener: (argument: TArgument) => void) {
      const wrapper = wrappers.get(listener);
      if (wrapper) {
        wrappers.delete(listener);
        event.removeListener(wrapper);
      }
    },
  };
}

/** An event that never fires, for an API the browser does not have. */
function inertEvent<T>(): WorkerEventSource<T> {
  return {
    addListener() {
      // The browser has no such event: nothing will ever call the listener.
    },
    removeListener() {
      // Nothing was attached.
    },
  };
}

/**
 * Maps the browser's APIs onto what the worker uses. Notifications, shortcuts,
 * windows, idle and the toolbar badge are missing or limited on Firefox for
 * Android, so each has a quiet fallback: the worker starts either way.
 */
export function buildWorkerApi(chrome: ChromeLike): WorkerBrowserApi {
  const api: WorkerBrowserApi = {
    now: () => Date.now(),
    onError: (effect, error) => {
      console.error("[FocusGate]", effect, error);
    },
    alarms: {
      get: (name) => chrome.alarms.get(name),
      create: (name, info) => chrome.alarms.create(name, info),
      clear: (name) => chrome.alarms.clear(name),
      getAll: async () => await chrome.alarms.getAll(),
      onAlarm: adaptEvent(chrome.alarms.onAlarm, (alarm) => alarm.name),
    },
    notifications: {
      create: async (id, options) => {
        if (!chrome.notifications) return "";
        return await chrome.notifications.create(id, options);
      },
      ...(chrome.notifications?.onButtonClicked
        ? {
            onButtonClicked:
              chrome.notifications.onButtonClicked as unknown as TaskReminderButtonEvents,
          }
        : {}),
    },
    action: {
      setBadgeText: async (details) => {
        await chrome.action?.setBadgeText(details);
      },
      setBadgeBackgroundColor: async (details) => {
        await chrome.action?.setBadgeBackgroundColor?.(details);
      },
      setTitle: async (details) => {
        await chrome.action?.setTitle?.(details);
      },
    },
    tabs: {
      queryActive: async () =>
        await chrome.tabs.query({ active: true, currentWindow: true }),
      queryAll: async () => await chrome.tabs.query({}),
      update: async (tabId, url) => {
        await chrome.tabs.update(tabId, { url });
      },
      getCurrent: async () => await chrome.tabs.getCurrent(),
      remove: async (tabId) => {
        await chrome.tabs.remove(tabId);
      },
      create: async (url) => {
        await chrome.tabs.create({ url });
      },
    },
    webNavigation: {
      onCommitted: chrome.webNavigation.onCommitted,
      onHistoryStateUpdated: chrome.webNavigation.onHistoryStateUpdated,
    },
    commands: { onCommand: chrome.commands?.onCommand ?? inertEvent<string>() },
    windows: {
      getLastFocused: async () => {
        if (!chrome.windows) {
          // One browser window: its foreground tab is the active tab.
          const tabs = await chrome.tabs.query({ active: true });
          return {
            focused: true,
            tabs: tabs.map((tab) => ({
              active: tab.active === true,
              ...(tab.url === undefined ? {} : { url: tab.url }),
              ...(tab.audible === undefined ? {} : { audible: tab.audible }),
            })),
          };
        }
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
    idle: {
      // Without an idle API, count the person as active.
      queryState: async (seconds) =>
        chrome.idle ? await chrome.idle.queryState(seconds) : "active",
    },
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
      onStartup: adaptEvent(chrome.runtime.onStartup, () => {
        // No payload: chrome.runtime.onStartup carries nothing.
      }),
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
      tabActivated: adaptEvent(chrome.tabs.onActivated, () => {
        // Tab/window/idle events carry no payload the sampler needs.
      }),
      windowFocusChanged: chrome.windows
        ? adaptEvent(chrome.windows.onFocusChanged, () => {
            // Intentionally empty: see tabActivated.
          })
        : inertEvent<void>(),
      idleStateChanged: chrome.idle
        ? adaptEvent(chrome.idle.onStateChanged, () => {
            // Intentionally empty: see tabActivated.
          })
        : inertEvent<void>(),
    },
  };
  return api;
}

interface ToolbarChrome {
  sidePanel?: {
    setPanelBehavior(options: { openPanelOnActionClick: boolean }): Promise<void>;
  };
  sidebarAction?: { open(): Promise<void> };
  action?: {
    onClicked?: {
      addListener(listener: (tab: { windowId: number }) => void): void;
    };
  };
  tabs?: { create(properties: { url: string }): Promise<unknown> };
  runtime?: { getURL(path: string): string };
}

/**
 * What the toolbar button does. Chrome and Edge open the side panel. Firefox
 * for desktop opens its sidebar (the call takes no arguments there). Firefox
 * for Android has neither, so the panel opens in a tab. Never throws.
 */
export function configureToolbarAction(chrome: ToolbarChrome): void {
  try {
    if (chrome.sidePanel?.setPanelBehavior) {
      void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
      return;
    }
    const onClicked = chrome.action?.onClicked;
    if (!onClicked) return;
    if (chrome.sidebarAction?.open) {
      onClicked.addListener(() => {
        void chrome.sidebarAction?.open();
      });
    } else if (chrome.tabs?.create && chrome.runtime?.getURL) {
      onClicked.addListener(() => {
        void chrome.tabs?.create({ url: chrome.runtime?.getURL("panel.html") ?? "panel.html" });
      });
    }
  } catch {
    // Feature-detected: no toolbar API to configure.
  }
}

export function createChromeWorker(): ReturnType<typeof createWorker> {
  const chrome = chromeApi();
  const api = buildWorkerApi(chrome);

  configureToolbarAction(
    (globalThis as unknown as { chrome?: ToolbarChrome }).chrome ?? {},
  );

  return createWorker(api);
}
