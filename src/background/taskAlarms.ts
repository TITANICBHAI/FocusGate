import type { TaskReminder } from "../shared/taskScheduling.ts";
import type { AlarmSchedule, AlarmSnapshot } from "./alarms.ts";
import type { NotificationApi, NotificationOptions } from "./notify.ts";

export const TASK_REMINDER_ALARM_PREFIX = "task-reminder:";
export const TASK_REMINDER_NOTIFICATION_PREFIX = "focusgate-task:";
const ALARM_TIME_TOLERANCE_MS = 1_000;

export interface TaskAlarmApi {
  getAll(): Promise<AlarmSnapshot[]>;
  create(name: string, alarmInfo: AlarmSchedule): void | Promise<void>;
  clear(name: string): boolean | Promise<boolean>;
}

/**
 * Reconciles only FocusGate task alarms. Unchanged alarms are retained across
 * worker restarts; stale alarms are removed and the next 50 are scheduled.
 */
export async function reconcileTaskAlarms(
  alarms: TaskAlarmApi,
  reminders: readonly TaskReminder[],
  now: number,
): Promise<void> {
  const current = (await alarms.getAll()).filter((alarm) =>
    alarm.name.startsWith(TASK_REMINDER_ALARM_PREFIX),
  );
  const currentByName = new Map(current.map((alarm) => [alarm.name, alarm]));
  const desired = reminders
    .slice()
    .sort(
      (left, right) =>
        left.scheduledAt - right.scheduledAt || left.id.localeCompare(right.id),
    )
    .slice(0, 50);
  const desiredNames = new Set(
    desired.map((reminder) => taskReminderAlarmName(reminder.id)),
  );

  for (const alarm of current) {
    if (!desiredNames.has(alarm.name)) {
      await alarms.clear(alarm.name);
      currentByName.delete(alarm.name);
    }
  }
  for (const reminder of desired) {
    const name = taskReminderAlarmName(reminder.id);
    const when = Math.max(reminder.scheduledAt, now + ALARM_TIME_TOLERANCE_MS);
    const existing = currentByName.get(name);
    if (
      existing &&
      Math.abs(existing.scheduledTime - when) <= ALARM_TIME_TOLERANCE_MS
    ) {
      continue;
    }
    if (existing) await alarms.clear(name);
    await alarms.create(name, { when });
  }
}

export function taskReminderAlarmName(reminderId: string): string {
  return `${TASK_REMINDER_ALARM_PREFIX}${encodeURIComponent(reminderId)}`;
}

export function taskReminderNotification(
  reminder: TaskReminder,
): { id: string; options: NotificationOptions } {
  return {
    id: `${TASK_REMINDER_NOTIFICATION_PREFIX}${encodeURIComponent(reminder.id)}`,
    options: {
      type: "basic",
      iconUrl: "icon.png",
      title: reminder.title,
      message: reminder.message,
      ...(reminder.startNow ? { buttons: [{ title: "Start now" }] } : {}),
    },
  };
}

export async function deliverTaskReminder(
  notifications: NotificationApi,
  reminder: TaskReminder,
): Promise<void> {
  const notification = taskReminderNotification(reminder);
  await notifications.create(notification.id, notification.options);
}

export interface TaskReminderButtonEvents {
  addListener(listener: (notificationId: string, buttonIndex: number) => void): void;
  removeListener(listener: (notificationId: string, buttonIndex: number) => void): void;
}

/**
 * Registers the staged Start now action. The WP5 worker may activate it only
 * after the approved runtime cutover.
 */
export function registerTaskReminderButtonHandler(
  events: TaskReminderButtonEvents,
  openDashboard: (fragment: string) => Promise<void>,
  onError?: (error: unknown) => void,
): () => void {
  const listener = (notificationId: string, buttonIndex: number) => {
    if (
      buttonIndex !== 0 ||
      !notificationId.startsWith(TASK_REMINDER_NOTIFICATION_PREFIX)
    ) {
      return;
    }
    void openDashboard("#focus").catch((error: unknown) => onError?.(error));
  };
  events.addListener(listener);
  return () => events.removeListener(listener);
}
