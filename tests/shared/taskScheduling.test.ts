import { describe, expect, it } from "vitest";
import { createDefaultState } from "../../src/shared/defaults.ts";
import {
  generateRecurringForToday,
  groupTasksForDate,
  planTaskReminders,
  taskDurationForStart,
  taskWindowEnd,
  taskWindowStart,
} from "../../src/shared/taskScheduling.ts";
import type { Task } from "../../src/shared/types.ts";

const today = "2026-10-29";
const start = new Date(2026, 9, 29, 14, 0).getTime();

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: "task-1",
    title: "Read",
    durationMin: 60,
    scheduledDate: today,
    scheduledTime: "14:00",
    priority: "medium",
    tags: [],
    recurring: "none",
    lockLevel: "none",
    completed: false,
    createdAt: start - 1_000,
    ...overrides,
  };
}

describe("task windows", () => {
  it("parses local date/time and uses remaining window when started in time", () => {
    const item = task();
    expect(taskWindowStart(item)).toBe(start);
    expect(taskWindowEnd(item)).toBe(start + 60 * 60_000);
    expect(taskDurationForStart(item, start + 15 * 60_000)).toBe(45);
    expect(taskDurationForStart(item, start - 1)).toBe(60);
    expect(taskDurationForStart(item, start + 60 * 60_000)).toBe(60);
  });

  it("rejects invalid dates and times", () => {
    expect(taskWindowStart(task({ scheduledDate: "2026-02-30" }))).toBeNull();
    expect(taskWindowStart(task({ scheduledTime: "25:00" }))).toBeNull();
  });

  it("groups today, overdue, future, unscheduled, and completed tasks", () => {
    const groups = groupTasksForDate(
      [
        task({ id: "active" }),
        task({ id: "past", scheduledTime: "12:00" }),
        task({ id: "next", scheduledTime: "16:00" }),
        task({ id: "future", scheduledDate: "2026-10-30" }),
        task({ id: "no-time", scheduledTime: undefined }),
        task({ id: "done", completed: true }),
      ],
      today,
      start + 30 * 60_000,
    );
    expect(groups.now.map((item) => item.id)).toEqual(["active"]);
    expect(groups.overdue.map((item) => item.id)).toEqual(["past"]);
    expect(groups.upNext.map((item) => item.id)).toEqual(["next"]);
    expect(groups.later.map((item) => item.id)).toEqual(["future"]);
    expect(groups.noTime.map((item) => item.id)).toEqual(["no-time"]);
    expect(groups.completed.map((item) => item.id)).toEqual(["done"]);
  });
});

describe("recurring tasks", () => {
  it("generates a stable daily instance once per date", () => {
    const template = task({ recurring: "daily" });
    const generated = generateRecurringForToday([template], "2026-10-30", 123);
    expect(generated).toHaveLength(1);
    expect(generated[0]).toMatchObject({
      templateId: template.id,
      scheduledDate: "2026-10-30",
      completed: false,
      createdAt: 123,
    });
    expect(
      generateRecurringForToday(
        [template, generated[0]!],
        "2026-10-30",
        456,
      ),
    ).toEqual([]);
  });

  it("only creates weekday or matching-weekday occurrences", () => {
    const weekday = task({ recurring: "weekdays" });
    expect(generateRecurringForToday([weekday], "2026-10-31", 1)).toEqual([]);
    expect(generateRecurringForToday([weekday], "2026-11-02", 1)).toHaveLength(1);
    const weekly = task({ recurring: "weekly" });
    expect(generateRecurringForToday([weekly], "2026-11-05", 1)).toHaveLength(1);
    expect(generateRecurringForToday([weekly], "2026-11-06", 1)).toEqual([]);
  });
});

describe("task reminder planning", () => {
  it("plans pre-start, start, almost-done, and end reminders in time order", () => {
    const state = createDefaultState();
    state.settings.reminders.preStartMin = [10, 5, 1];
    const reminders = planTaskReminders(
      [task()],
      state.settings,
      state.session,
      start - 20 * 60_000,
    );
    expect(reminders.map((item) => [item.kind, item.scheduledAt])).toEqual([
      ["pre-start", start - 10 * 60_000],
      ["pre-start", start - 5 * 60_000],
      ["pre-start", start - 1 * 60_000],
      ["at-start", start],
      ["almost-done", start + 55 * 60_000],
      ["at-end", start + 60 * 60_000],
    ]);
  });

  it("only schedules mid-session checks when at least ten minutes remain", () => {
    const state = createDefaultState();
    const session = {
      ...state.session,
      status: "work" as const,
      taskId: "task-1",
      phaseStartedAt: start,
      phaseEndsAt: start + 40 * 60_000,
    };
    const reminders = planTaskReminders(
      [task()],
      state.settings,
      session,
      start - 1,
    );
    expect(
      reminders.filter((item) => item.kind === "mid-session").map((item) => item.scheduledAt),
    ).toEqual([start + 15 * 60_000, start + 30 * 60_000]);
  });

  it("does not plan reminders when task alerts are disabled", () => {
    const state = createDefaultState();
    state.settings.notifications.taskReminders = false;
    expect(
      planTaskReminders([task()], state.settings, state.session, start - 20 * 60_000),
    ).toEqual([]);
  });
});
