import { ready, getState, patch, update } from "../shared/storage.ts";
import { computeBlockPlan, explainBlock } from "../shared/plan.ts";
import { verifyPassword } from "../shared/password.ts";
import type { AppState, Health } from "../shared/types.ts";
import type { DnrRule } from "../shared/dnr.ts";
import {
  ensureAlarms,
  type AlarmApi,
  type AlarmSnapshot,
} from "./alarms.ts";
import { createSessionService } from "./session.ts";
import { auditOpenBlockedTabs, createReconciler } from "./reconcile.ts";
import { createBlockRecorder } from "./recordBlock.ts";
import { registerBlockNavigation } from "./blockNavigation.ts";
import { createAttentionTracker } from "./attention.ts";
import { createAlarmHandler } from "./alarmHandler.ts";
import { createTaskService } from "./tasks.ts";
import { createAchievementsService } from "./achievements.ts";
import { createDailyReflectionService } from "./dailyReflection.ts";
import { createPruningService } from "./pruning.ts";
import { createAllowanceAlertService } from "./allowanceAlerts.ts";
import { createWeeklyReportService } from "./weeklyReport.ts";
import { createPasswordActionService } from "./passwordActions.ts";
import { createGuardedStateWriteService } from "./guardedStateWrites.ts";
import { createStandaloneActionService } from "./standaloneActions.ts";
import { createDataActionService } from "./dataActions.ts";
import {
  createDataActionMessageHandler,
  createGuardedStateWriteMessageHandler,
  createPasswordMessageHandler,
  createSessionMessageHandler,
  createStandaloneMessageHandler,
  createTaskMessageHandler,
  createToggleFocusCommandHandler,
} from "./messages.ts";
import {
  BLOCK_CURRENT_SITE_COMMAND,
  createQuickBlockCommandHandler,
} from "./quickBlock.ts";
import { registerTaskReminderButtonHandler } from "./taskAlarms.ts";
import {
  showSessionNotice,
  updateActionBadge,
} from "./notify.ts";
import type {
  ActionBadgeApi,
  NotificationApi,
  SessionNotice,
} from "./notify.ts";
import type { BlockPlan, BlockReason } from "../shared/plan.ts";

/**
 * WP5 cutover composition: assembles every staged v2 service against the
 * injected browser APIs and returns the registration handles. This module is
 * deliberately NOT imported by the active entrypoint (src/background/index.ts
 * still bridges the v1 worker); the cutover flips that import together with
 * the manifest routes and activates migration in the same change.
 */

export interface WorkerEventSource<T> {
  addListener(listener: (argument: T) => void): unknown;
  removeListener(listener: (argument: T) => void): void;
}

export interface WorkerMessageEvent {
  message: unknown;
  sendResponse(response: unknown): void;
}

export interface WorkerBrowserApi {
  now(): number;
  onError?(effect: string, error: unknown): void;
  alarms: AlarmApi & {
    getAll(): Promise<AlarmSnapshot[]>;
    onAlarm: WorkerEventSource<string>;
  };
  notifications: NotificationApi & {
    onButtonClicked?: {
      addListener(
        listener: (notificationId: string, buttonIndex: number) => void,
      ): void;
      removeListener(
        listener: (notificationId: string, buttonIndex: number) => void,
      ): void;
    };
  };
  action: ActionBadgeApi;
  tabs: {
    queryActive(): Promise<Array<{ id?: number; url?: string }>>;
    queryAll(): Promise<Array<{ id?: number; url?: string }>>;
    update(tabId: number, url: string): Promise<void>;
    getCurrent(): Promise<{ id?: number } | undefined>;
    remove(tabId: number): Promise<void>;
  };
  webNavigation: {
    onCommitted: WorkerEventSource<{
      tabId: number;
      url: string;
      frameId: number;
    }>;
    onHistoryStateUpdated: WorkerEventSource<{
      tabId: number;
      url: string;
      frameId: number;
    }>;
  };
  commands: { onCommand: WorkerEventSource<string> };
  windows: {
    getLastFocused(): Promise<{
      focused: boolean;
      tabs?: Array<{ active: boolean; url?: string; audible?: boolean }>;
    }>;
  };
  idle: {
    queryState(detectionIntervalSeconds: number): Promise<
      "active" | "idle" | "locked"
    >;
  };
  declarativeNetRequest: {
    getDynamicRules(): Promise<DnrRule[]>;
    updateDynamicRules(update: {
      removeRuleIds: number[];
      addRules: DnrRule[];
    }): Promise<void>;
  };
  session: {
    get(keys: string[]): Promise<Record<string, unknown>>;
    set(items: Record<string, unknown>): Promise<void>;
  };
  runtime: {
    getURL(path: string): string;
    onInstalled: WorkerEventSource<{ reason: string }>;
    onMessage: WorkerEventSource<WorkerMessageEvent>;
  };
  events: {
    tabActivated: WorkerEventSource<void>;
    windowFocusChanged: WorkerEventSource<void>;
    idleStateChanged: WorkerEventSource<void>;
  };
  countAudible?: boolean;
}

export interface Worker {
  handleInstalled(details: { reason: string }): Promise<void>;
  handleAlarm(name: string): Promise<boolean>;
  handleCommand(command: string): Promise<boolean>;
  handleMessage(message: unknown): Promise<unknown>;
  start(): () => void;
}

function isUnknownResponse(response: unknown): boolean {
  return (
    typeof response === "object" &&
    response !== null &&
    (response as { code?: unknown }).code === "UNKNOWN_MESSAGE"
  );
}

// Satisfies AttentionEventSources.tick without emitting: the alarm handler's
// tick path calls the sampler exactly once per tick.
const neverEmittedSource: WorkerEventSource<never> = {
  addListener() {
    return undefined;
  },
  removeListener() {
    return undefined;
  },
};

export function createWorker(api: WorkerBrowserApi): Worker {
  const onError = (effect: string, error: unknown): void =>
    api.onError?.(effect, error);
  const now = api.now;

  const store = {
    readState: async (): Promise<AppState> => {
      await ready();
      return getState();
    },
    writeState: async (partial: Partial<AppState>): Promise<void> => {
      await ready();
      await patch(partial);
    },
  };

  const notify = async (notice: SessionNotice): Promise<void> =>
    showSessionNotice(api.notifications, notice);

  const recorder = createBlockRecorder({
    getState: store.readState,
    write: async (partial) => {
      await patch(partial);
    },
    dedupe: {
      getAll: async () => {
        const stored = await api.session.get(["blockDedupe"]);
        const value = stored.blockDedupe;
        return value && typeof value === "object"
          ? (value as Record<string, number>)
          : {};
      },
      setAll: async (value) => {
        await api.session.set({ blockDedupe: value });
      },
    },
    now,
  });

  const ensureAlarmsFor = async (
    state: AppState,
    plan: BlockPlan,
    at: number,
  ): Promise<void> => {
    await ensureAlarms(api.alarms, state.session, state.standalone, at, {
      nextBoundaryAt: plan.nextBoundaryAt,
    });
  };

  const reconcilerDependencies = {
    getState: store.readState,
    updateHealth: async (healthPatch: Partial<Health>) => {
      await update("health", (current) => ({ ...current, ...healthPatch }));
    },
    getDynamicRules: api.declarativeNetRequest.getDynamicRules,
    updateDynamicRules: api.declarativeNetRequest.updateDynamicRules,
    getSnapshot: async () => {
      const stored = await api.session.get(["reconcileSnapshot"]);
      const snapshot = stored.reconcileSnapshot;
      return snapshot && typeof snapshot === "object"
        ? (snapshot as { hash: string; blockedDomains: string[] })
        : null;
    },
    setSnapshot: async (snapshot: {
      hash: string;
      blockedDomains: string[];
    }) => {
      await api.session.set({ reconcileSnapshot: snapshot });
    },
    ensureAlarms: ensureAlarmsFor,
    listTabs: api.tabs.queryAll,
    updateTab: api.tabs.update,
    recordBlock: async (tabId: number, domain: string, reason: BlockReason) => {
      await recorder({ tabId, domain, reason });
    },
    blockedBase: api.runtime.getURL("blocked.html"),
    now,
  };
  const reconciler = createReconciler(reconcilerDependencies);

  const achievements = createAchievementsService({
    store,
    notify,
    now,
    onError: (error) => onError("achievements", error),
  });

  const session = createSessionService({
    store,
    now,
    createSessionId: () => crypto.randomUUID(),
    ensureAlarms: async (state, at) => {
      await ensureAlarmsFor(state, computeBlockPlan(state, at), at);
    },
    updateBadge: async (state, at) => {
      await updateActionBadge(api.action, state, at);
    },
    notify,
    reconcile: reconciler,
    verifyPassword,
    achievements,
    onEffectError: onError,
  });

  const allowanceAlerts = createAllowanceAlertService({
    store,
    notify,
    now,
    onError: (error) => onError("allowance-alerts", error),
  });

  const attention = createAttentionTracker({
    getState: store.readState,
    getCheckpoint: async () => {
      const stored = await api.session.get(["attentionCheckpoint"]);
      const value = stored.attentionCheckpoint;
      return value && typeof value === "object"
        ? (value as {
            lastTickAt: number;
            lastDomain: string | null;
            lastAttentive: boolean;
          })
        : null;
    },
    setCheckpoint: async (value) => {
      await api.session.set({ attentionCheckpoint: value });
    },
    getLastFocusedWindow: api.windows.getLastFocused,
    getIdleState: api.idle.queryState,
    countAudible: api.countAudible,
    writeUsage: async (usage) => {
      await patch({ usage });
    },
    now,
    reconcile: reconciler,
    allowanceAlerts,
    onError: (error) => onError("attention", error),
  });

  const tasks = createTaskService({
    store,
    alarms: api.alarms,
    notifications: api.notifications,
    now,
    session: {
      start: async (input) => {
        const result = await session.start(input);
        return { ok: result.ok };
      },
    },
    onEffectError: onError,
  });

  const weeklyReport = createWeeklyReportService({
    store,
    notify,
    now,
    onError: (error) => onError("weekly-report", error),
  });
  const reflection = createDailyReflectionService({
    store,
    notify,
    now,
    onError: (error) => onError("daily-reflection", error),
  });
  const pruning = createPruningService({
    store,
    now,
    onError: (error) => onError("pruning", error),
  });

  const alarmHandler = createAlarmHandler({
    getState: store.readState,
    ensureAlarms: ensureAlarmsFor,
    session,
    attention: {
      sample: async () => attention.sample(),
    },
    auditOpenTabs: async (state, at) => {
      await auditOpenBlockedTabs(reconcilerDependencies, state, at);
    },
    reconcile: reconciler,
    handleWeeklyReport: async () => {
      await weeklyReport.generate();
    },
    handleMidnight: async () => undefined,
    reflection,
    achievements,
    pruning,
    tasks,
    now,
    onEffectError: onError,
  });

  const handleAlarm = (name: string): Promise<boolean> => alarmHandler(name);

  const passwordService = createPasswordActionService({ store, now });
  const guardedService = createGuardedStateWriteService({ store, now });
  const standaloneService = createStandaloneActionService({
    store,
    now,
    afterChange: async () => {
      await reconciler("standalone");
    },
  });
  const dataService = createDataActionService({
    store,
    now,
    verifyPassword: async (input, stored) => ({
      valid: (await verifyPassword(input, stored)).valid,
    }),
    afterChange: async () => {
      await reconciler("data");
    },
  });

  const quickBlock = createQuickBlockCommandHandler({
    getActiveTab: async () => {
      const tab = (await api.tabs.queryActive())[0];
      return tab && tab.id !== undefined ? { id: tab.id, url: tab.url } : null;
    },
    getDestination: async () => (await store.readState()).quickBlockMode,
    addSites: async (domains, destination) => {
      const key =
        destination === "always" ? "alwaysBlockedSites" : "blockedSites";
      await update(key, (latest) => [...new Set([...latest, ...domains])]);
    },
    shouldRedirect: async (target) =>
      explainBlock(target.url, await store.readState(), now()) !== null,
    redirectTab: async (tabId, url) => {
      await api.tabs.update(
        tabId,
        `${api.runtime.getURL("blocked.html")}#${encodeURIComponent(url)}`,
      );
    },
  });

  const sessionMessages = createSessionMessageHandler(session);
  const standaloneMessages = createStandaloneMessageHandler(standaloneService);
  const passwordMessages = createPasswordMessageHandler(passwordService);
  const guardedMessages = createGuardedStateWriteMessageHandler(guardedService);
  const dataMessages = createDataActionMessageHandler(dataService);
  const taskMessages = createTaskMessageHandler(tasks);

  const handleMessage = async (message: unknown): Promise<unknown> => {
    if (await taskMessages(message)) return true;
    for (const handler of [
      sessionMessages,
      standaloneMessages,
      passwordMessages,
      guardedMessages,
      dataMessages,
    ]) {
      const response = await handler(message);
      if (!isUnknownResponse(response)) return response;
    }
    return undefined;
  };

  const toggleFocus = createToggleFocusCommandHandler(session);

  const handleCommand = async (command: string): Promise<boolean> => {
    if (await toggleFocus(command)) return true;
    if (await quickBlock(command)) return true;
    return false;
  };

  const handleInstalled = async (details: {
    reason: string;
  }): Promise<void> => {
    if (details.reason !== "install" && details.reason !== "update") return;
    try {
      await ready();
      await session.recover();
      await tasks.reconcile();
    } catch (error) {
      onError("install", error);
    }
  };

  const start = (): (() => void) => {
    const unbinders: Array<() => void> = [];

    api.runtime.onInstalled.addListener((details) => {
      void handleInstalled(details);
    });
    api.alarms.onAlarm.addListener((name) => {
      void handleAlarm(name);
    });    api.commands.onCommand.addListener((command) => {
      void handleCommand(command);
    });
    api.runtime.onMessage.addListener((event) => {
      void handleMessage(event.message)
        .then((response) => event.sendResponse(response))
        .catch((error) => {
          onError("message", error);
          event.sendResponse(undefined);
        });
      return true;
    });

    unbinders.push(
      registerBlockNavigation(
        {
          onCommitted: api.webNavigation.onCommitted,
          onHistoryStateUpdated: api.webNavigation.onHistoryStateUpdated,
        },
        {
          getState: store.readState,
          recordBlock: async (tabId: number, domain: string, reason: BlockReason) => {
            await recorder({ tabId, domain, reason });
          },
          updateTab: api.tabs.update,
          blockedBase: api.runtime.getURL("blocked.html"),
          now,
          onError: (error) => onError("navigation", error),
        },
      ),
    );

    unbinders.push(
      attention.attach({
        // Sampling is driven by the alarm handler's tick path, so the tick
        // source attached here is intentionally never emitted.
        tick: neverEmittedSource,
        tabActivated: api.events.tabActivated,
        windowFocusChanged: api.events.windowFocusChanged,
        mainFrameCommitted: api.webNavigation.onCommitted,
        idleStateChanged: api.events.idleStateChanged,
      }),
    );

    if (api.notifications.onButtonClicked) {
      unbinders.push(
        registerTaskReminderButtonHandler(
          api.notifications.onButtonClicked,
          async () => undefined,
          (error) => onError("task-button", error),
        ),
      );
    }

    return () => unbinders.forEach((unbind) => unbind());
  };

  return { handleInstalled, handleAlarm, handleCommand, handleMessage, start };
}
