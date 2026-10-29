import { localDateKey } from "../shared/time.ts";
import {
  generateRecurringForToday,
  planTaskReminders,
  taskDurationForStart,
  type TaskReminder,
} from "../shared/taskScheduling.ts";
import type { AppState } from "../shared/types.ts";
import {
  deliverTaskReminder,
  reconcileTaskAlarms,
  TASK_REMINDER_ALARM_PREFIX,
  type TaskAlarmApi,
} from "./taskAlarms.ts";
import type { NotificationApi } from "./notify.ts";

export interface TaskServiceDependencies {
  store: {
    readState(): Promise<AppState>;
    writeState(patch: Partial<AppState>): Promise<void>;
  };
  alarms: TaskAlarmApi;
  notifications: NotificationApi;
  now(): number;
  session?: {
    start(input: {
      durationMin: number;
      lockLevel: AppState["session"]["lockLevel"];
      taskId?: string;
    }): Promise<{ ok: boolean }>;
  };
  onEffectError?(effect: string, error: unknown): void;
}

export interface TaskService {
  reconcile(): Promise<void>;
  handleReminderAlarm(name: string): Promise<boolean>;
}

const REMINDER_MESSAGES: Record<TaskReminder["kind"], string> = {
  "pre-start": "Your task starts soon.",
  "at-start": "It's time to start this task.",
  "mid-session": "How is your focus going?",
  "almost-done": "About 5 minutes remain.",
  "at-end": "The task window has ended.",
};

/**
 * Staged task recurrence and reminder service. A future worker calls reconcile
 * at startup, after task changes, and at local midnight; this module is not
 * registered with the active v1 worker.
 */
export function createTaskService(
  dependencies: TaskServiceDependencies,
): TaskService {
  async function reconcile(): Promise<void> {
    const now = dependencies.now();
    let state = await dependencies.store.readState();
    const generated = generateRecurringForToday(
      state.tasks,
      localDateKey(new Date(now)),
      now,
    );
    if (generated.length > 0) {
      const generatedIds = new Set(generated.map((task) => task.id));
      const tasks = [...generated, ...state.tasks];
      await dependencies.store.writeState({ tasks });
      state = { ...state, tasks: tasks.filter((task) => generatedIds.has(task.id) || state.tasks.includes(task)) };
    }
    const reminders = planTaskReminders(
      state.tasks,
      state.settings,
      state.session,
      now,
    );
    await reconcileTaskAlarms(dependencies.alarms, reminders, now);
  }

  async function handleReminderAlarm(name: string): Promise<boolean> {
    if (!name.startsWith(TASK_REMINDER_ALARM_PREFIX)) return false;
    let decoded: string;
    try {
      decoded = decodeURIComponent(name.slice(TASK_REMINDER_ALARM_PREFIX.length));
    } catch {
      return true;
    }
    const match =
      /^(.*):(pre-start|at-start|mid-session|almost-done|at-end):([^:]*)$/.exec(
        decoded,
      );
    if (!match) return true;
    let taskId: string;
    try {
      taskId = decodeURIComponent(match[1] ?? "");
    } catch {
      return true;
    }
    const kind = match[2] as TaskReminder["kind"];
    const state = await dependencies.store.readState();
    const task = state.tasks.find((item) => item.id === taskId);
    if (!task || task.completed) {
      await reconcile();
      return true;
    }
    const now = dependencies.now();
    let autoStarted = false;
    if (
      kind === "at-start" &&
      state.settings.autoStartTasks &&
      state.session.status === "idle" &&
      dependencies.session
    ) {
      try {
        const result = await dependencies.session.start({
          durationMin: taskDurationForStart(task, now),
          lockLevel: task.lockLevel,
          taskId: task.id,
        });
        autoStarted = result.ok;
      } catch (error) {
        dependencies.onEffectError?.("task-auto-start", error);
      }
    }
    const reminder: TaskReminder = {
      id: decoded,
      taskId: task.id,
      kind,
      scheduledAt: now,
      title: task.title,
      message: autoStarted
        ? `Focus started for ${task.title}.`
        : REMINDER_MESSAGES[kind],
      startNow: kind === "at-start" && !autoStarted,
    };
    try {
      await deliverTaskReminder(dependencies.notifications, reminder);
    } catch (error) {
      dependencies.onEffectError?.("task-notification", error);
    }
    try {
      await reconcile();
    } catch (error) {
      dependencies.onEffectError?.("task-alarm-reconcile", error);
    }
    return true;
  }

  return { reconcile, handleReminderAlarm };
}
