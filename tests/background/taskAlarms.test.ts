import { describe, expect, it } from "vitest";
import {
  deliverTaskReminder,
  reconcileTaskAlarms,
  registerTaskReminderButtonHandler,
  taskReminderAlarmName,
  taskReminderNotification,
  type TaskAlarmApi,
} from "../../src/background/taskAlarms.ts";
import type { AlarmSchedule, AlarmSnapshot } from "../../src/background/alarms.ts";
import type { NotificationApi, NotificationOptions } from "../../src/background/notify.ts";
import type { TaskReminder } from "../../src/shared/taskScheduling.ts";

function reminder(id: string, scheduledAt: number): TaskReminder {
  return {
    id,
    taskId: "task-1",
    kind: "at-start",
    scheduledAt,
    title: "Read",
    message: "It's time to start this task.",
    startNow: true,
  };
}

function fakeAlarms(initial: AlarmSnapshot[] = []) {
  const values = new Map(initial.map((alarm) => [alarm.name, alarm]));
  const creates: Array<{ name: string; info: AlarmSchedule }> = [];
  const clears: string[] = [];
  const api: TaskAlarmApi = {
    getAll: async () => [...values.values()],
    create: async (name, info) => {
      creates.push({ name, info });
      values.set(name, {
        name,
        scheduledTime: info.when ?? 0,
        ...(info.periodInMinutes === undefined
          ? {}
          : { periodInMinutes: info.periodInMinutes }),
      });
    },
    clear: async (name) => {
      clears.push(name);
      return values.delete(name);
    },
  };
  return { api, values, creates, clears };
}

describe("task reminder alarms", () => {
  it("creates next reminders, preserves unchanged schedules, and clears stale alarms", async () => {
    const stableName = taskReminderAlarmName("old");
    const staleName = taskReminderAlarmName("deleted");
    const fake = fakeAlarms([
      { name: stableName, scheduledTime: 20_000 },
      { name: staleName, scheduledTime: 25_000 },
      { name: "weekly_report", scheduledTime: 100_000 },
    ]);

    await reconcileTaskAlarms(
      fake.api,
      [reminder("old", 20_000), reminder("new", 30_000)],
      0,
    );

    expect(fake.creates).toEqual([
      { name: taskReminderAlarmName("new"), info: { when: 30_000 } },
    ]);
    expect(fake.clears).toEqual([staleName]);
    expect(fake.values.has("weekly_report")).toBe(true);
  });

  it("caps schedules at 50 and does not schedule past alarms in the past", async () => {
    const fake = fakeAlarms();
    const many = Array.from({ length: 60 }, (_, index) =>
      reminder(String(index), index < 10 ? 1 : 10_000 + index),
    );
    await reconcileTaskAlarms(fake.api, many, 0);
    expect(fake.creates).toHaveLength(50);
    expect(fake.creates[0]?.info).toEqual({ when: 1_000 });
  });
});

describe("task reminder notifications", () => {
  it("adds a Start now action only when requested", () => {
    expect(taskReminderNotification(reminder("start", 1)).options.buttons).toEqual([
      { title: "Start now" },
    ]);
    expect(
      taskReminderNotification({ ...reminder("check", 1), startNow: false }).options
        .buttons,
    ).toBeUndefined();
  });

  it("delivers a notification and opens focus from its button", async () => {
    const created: Array<{ id: string; options: NotificationOptions }> = [];
    const api: NotificationApi = {
      create: (id, options) => {
        created.push({ id, options });
      },
    };
    await deliverTaskReminder(api, reminder("start", 1));
    expect(created[0]?.options.message).toContain("start this task");

    let listener:
      | ((notificationId: string, buttonIndex: number) => void)
      | undefined;
    let opened = "";
    const events = {
      addListener(value: (notificationId: string, buttonIndex: number) => void) {
        listener = value;
      },
      removeListener(value: (notificationId: string, buttonIndex: number) => void) {
        if (listener === value) listener = undefined;
      },
    };
    const dispose = registerTaskReminderButtonHandler(
      events,
      async (fragment) => {
        opened = fragment;
      },
    );
    listener?.(`${created[0]!.id}`, 0);
    await Promise.resolve();
    expect(opened).toBe("#focus");
    dispose();
    expect(listener).toBeUndefined();
  });
});
