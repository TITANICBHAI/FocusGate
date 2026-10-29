import type {
  SessionState,
  Settings,
  Task,
  TaskRecurrence,
} from "./types.ts";

export type TaskGroupKey =
  | "overdue"
  | "now"
  | "upNext"
  | "later"
  | "noTime"
  | "completed";

export type TaskReminderKind =
  | "pre-start"
  | "at-start"
  | "mid-session"
  | "almost-done"
  | "at-end";

export interface TaskReminder {
  id: string;
  taskId: string;
  kind: TaskReminderKind;
  scheduledAt: number;
  title: string;
  message: string;
  startNow: boolean;
}

const MINUTE_MS = 60_000;
const MAX_TASK_REMINDERS = 50;

function parseDateKey(value: string): [number, number, number] | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    return null;
  }
  return [year, month, day];
}

function localDateKey(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

export function taskWindowStart(task: Task): number | null {
  if (!task.scheduledDate || !task.scheduledTime) return null;
  const date = parseDateKey(task.scheduledDate);
  const time = /^(\d{2}):(\d{2})$/.exec(task.scheduledTime);
  if (!date || !time) return null;
  const hour = Number(time[1]);
  const minute = Number(time[2]);
  if (hour > 23 || minute > 59) return null;
  const start = new Date(date[0], date[1] - 1, date[2], hour, minute, 0, 0);
  if (
    start.getFullYear() !== date[0] ||
    start.getMonth() !== date[1] - 1 ||
    start.getDate() !== date[2]
  ) {
    return null;
  }
  return start.getTime();
}

export function taskWindowEnd(task: Task): number | null {
  const start = taskWindowStart(task);
  return start === null ? null : start + task.durationMin * MINUTE_MS;
}

export function taskDurationForStart(task: Task, now: number): number {
  const end = taskWindowEnd(task);
  const start = taskWindowStart(task);
  if (start !== null && end !== null && now >= start && now < end) {
    return Math.max(1, Math.ceil((end - now) / MINUTE_MS));
  }
  return task.durationMin;
}

function recurrenceMatches(
  recurrence: TaskRecurrence,
  baseDate: string,
  dateKey: string,
): boolean {
  if (dateKey <= baseDate) return false;
  const date = parseDateKey(dateKey);
  const base = parseDateKey(baseDate);
  if (!date || !base) return false;
  if (recurrence === "daily") return true;
  const weekday = new Date(Date.UTC(date[0], date[1] - 1, date[2])).getUTCDay();
  if (recurrence === "weekdays") return weekday >= 1 && weekday <= 5;
  if (recurrence === "weekly") {
    const baseWeekday = new Date(
      Date.UTC(base[0], base[1] - 1, base[2]),
    ).getUTCDay();
    return weekday === baseWeekday;
  }
  return false;
}

/**
 * Creates at most one stable occurrence for each recurring template and local
 * date. Re-running this function with the same task list is idempotent.
 */
export function generateRecurringForToday(
  tasks: readonly Task[],
  dateKey: string,
  createdAt: number,
): Task[] {
  if (!parseDateKey(dateKey)) return [];
  const existing = new Set(
    tasks
      .filter((task) => task.scheduledDate === dateKey)
      .map((task) => task.templateId ?? task.id),
  );
  const generated: Task[] = [];
  for (const task of tasks) {
    if (
      task.recurring === "none" ||
      !task.scheduledDate ||
      (task.templateId !== undefined && task.templateId !== task.id) ||
      !recurrenceMatches(task.recurring, task.scheduledDate, dateKey)
    ) {
      continue;
    }
    const templateId = task.templateId ?? task.id;
    if (existing.has(templateId)) continue;
    existing.add(templateId);
    generated.push({
      ...task,
      id: `recurring:${encodeURIComponent(templateId)}:${dateKey}`,
      templateId,
      scheduledDate: dateKey,
      completed: false,
      completedAt: undefined,
      createdAt,
    });
  }
  return generated;
}

function compareTaskTime(left: Task, right: Task): number {
  const leftStart = taskWindowStart(left) ?? Number.MAX_SAFE_INTEGER;
  const rightStart = taskWindowStart(right) ?? Number.MAX_SAFE_INTEGER;
  return leftStart - rightStart || left.title.localeCompare(right.title);
}

export function groupTasksForDate(
  tasks: readonly Task[],
  dateKey: string,
  now: number,
): Record<TaskGroupKey, Task[]> {
  const today = localDateKey(now);
  const groups: Record<TaskGroupKey, Task[]> = {
    overdue: [],
    now: [],
    upNext: [],
    later: [],
    noTime: [],
    completed: [],
  };
  for (const task of tasks) {
    if (task.completed) {
      groups.completed.push(task);
      continue;
    }
    if (!task.scheduledDate || !task.scheduledTime) {
      groups.noTime.push(task);
      continue;
    }
    if (task.scheduledDate > dateKey) {
      groups.later.push(task);
      continue;
    }
    if (task.scheduledDate < dateKey) {
      groups.overdue.push(task);
      continue;
    }
    const start = taskWindowStart(task);
    const end = taskWindowEnd(task);
    if (start === null || end === null) {
      groups.noTime.push(task);
    } else if (dateKey === today && start <= now && now < end) {
      groups.now.push(task);
    } else if (dateKey <= today && end <= now) {
      groups.overdue.push(task);
    } else if (start > now) {
      groups.upNext.push(task);
    } else {
      groups.later.push(task);
    }
  }
  for (const group of Object.values(groups)) group.sort(compareTaskTime);
  return groups;
}

export function planTaskReminders(
  tasks: readonly Task[],
  settings: Pick<Settings, "notifications" | "reminders">,
  session: SessionState,
  now: number,
): TaskReminder[] {
  if (!settings.notifications.taskReminders) return [];
  const planned: TaskReminder[] = [];
  const add = (
    task: Task,
    kind: TaskReminderKind,
    scheduledAt: number,
    suffix: string,
    message: string,
    startNow = false,
  ) => {
    if (scheduledAt <= now || !Number.isFinite(scheduledAt)) return;
    planned.push({
      id: `${encodeURIComponent(task.id)}:${kind}:${suffix}`,
      taskId: task.id,
      kind,
      scheduledAt,
      title: task.title,
      message,
      startNow,
    });
  };

  for (const task of tasks) {
    if (task.completed) continue;
    const start = taskWindowStart(task);
    if (start === null) continue;
    const activeSession = session.status === "work" && session.taskId === task.id;
    const end =
      activeSession && session.phaseEndsAt > now
        ? session.phaseEndsAt
        : taskWindowEnd(task);
    if (end === null) continue;

    for (const offset of new Set(settings.reminders.preStartMin)) {
      if (!Number.isFinite(offset) || offset <= 0) continue;
      add(
        task,
        "pre-start",
        start - offset * MINUTE_MS,
        String(offset),
        `Starts in ${offset} minute${offset === 1 ? "" : "s"}.`,
      );
    }
    if (settings.reminders.atStart) {
      add(task, "at-start", start, "0", "It's time to start this task.", true);
    }
    if (activeSession) {
      for (const offset of new Set(settings.reminders.midSessionMin)) {
        if (!Number.isFinite(offset) || offset <= 0) continue;
        const at = session.phaseStartedAt + offset * MINUTE_MS;
        if (session.phaseEndsAt - at < 10 * MINUTE_MS) continue;
        add(task, "mid-session", at, String(offset), "How is your focus going?");
      }
    }
    if (settings.reminders.almostDone) {
      add(task, "almost-done", end - 5 * MINUTE_MS, "5", "About 5 minutes remain.");
    }
    if (settings.reminders.atEnd) {
      add(task, "at-end", end, "0", "The task window has ended.");
    }
  }

  const unique = new Map(planned.map((reminder) => [reminder.id, reminder]));
  return [...unique.values()]
    .sort(
      (left, right) =>
        left.scheduledAt - right.scheduledAt || left.id.localeCompare(right.id),
    )
    .slice(0, MAX_TASK_REMINDERS);
}
