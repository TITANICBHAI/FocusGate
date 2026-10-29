import { describe, expect, it, vi } from "vitest";
import { createTaskMessageHandler } from "../../src/background/messages.ts";
import { createTaskService } from "../../src/background/tasks.ts";
import { createDefaultState } from "../../src/shared/defaults.ts";
import type { AppState, Task } from "../../src/shared/types.ts";
import type { AlarmSchedule, AlarmSnapshot } from "../../src/background/alarms.ts";
import type { TaskAlarmApi } from "../../src/background/taskAlarms.ts";
import type { NotificationApi } from "../../src/background/notify.ts";

function makeRecurringTask(): Task {
  return {
    id: "daily-template",
    title: "Daily reading",
    durationMin: 30,
    scheduledDate: "2026-10-28",
    scheduledTime: "14:00",
    priority: "medium",
    tags: [],
    recurring: "daily",
    lockLevel: "none",
    completed: false,
    createdAt: 1,
  };
}

function alarmFake() {
  const values = new Map<string, AlarmSnapshot>();
  const created: Array<{ name: string; info: AlarmSchedule }> = [];
  const api: TaskAlarmApi = {
    getAll: async () => [...values.values()],
    create: async (name, info) => {
      created.push({ name, info });
      values.set(name, { name, scheduledTime: info.when ?? 0 });
    },
    clear: async (name) => values.delete(name),
  };
  return { api, values, created };
}

describe("staged task service", () => {
  it("generates the local-day recurrence once and reconciles reminders", async () => {
    const initial = createDefaultState();
    initial.tasks = [makeRecurringTask()];
    let state: AppState = structuredClone(initial);
    const writes: Partial<AppState>[] = [];
    const alarms = alarmFake();
    const now = new Date(2026, 9, 29, 13, 0).getTime();
    const service = createTaskService({
      store: {
        readState: async () => structuredClone(state),
        writeState: async (patch) => {
          writes.push(patch);
          state = { ...state, ...patch };
        },
      },
      alarms: alarms.api,
      notifications: { create: vi.fn() },
      now: () => now,
    });

    await service.reconcile();
    await service.reconcile();

    expect(state.tasks.filter((task) => task.scheduledDate === "2026-10-29"))
      .toHaveLength(1);
    expect(writes).toHaveLength(1);
    expect(alarms.created.some(({ name }) => name.includes("pre-start"))).toBe(true);
  });

  it("delivers a due reminder and rejects unrelated alarms", async () => {
    const state = createDefaultState();
    const dueTask: Task = {
      ...makeRecurringTask(),
      id: "today",
      recurring: "none",
      scheduledDate: "2026-10-29",
      scheduledTime: "13:00",
    };
    state.tasks = [dueTask];
    const now = new Date(2026, 9, 29, 13, 0).getTime();
    const create = vi.fn(async () => undefined);
    const service = createTaskService({
      store: { readState: async () => state, writeState: async () => undefined },
      alarms: alarmFake().api,
      notifications: { create } as NotificationApi,
      now: () => now,
    });
    const reminderId = `${encodeURIComponent(dueTask.id)}:at-start:0`;

    await expect(service.handleReminderAlarm("weekly_report")).resolves.toBe(false);
    await expect(
      service.handleReminderAlarm(`task-reminder:${encodeURIComponent(reminderId)}`),
    ).resolves.toBe(true);
    expect(create).toHaveBeenCalledWith(
      expect.stringContaining("focusgate-task:"),
      expect.objectContaining({ buttons: [{ title: "Start now" }] }),
    );
  });

  it("reconciles after a tasks/changed message", async () => {
    const reconcile = vi.fn(async () => undefined);
    const handle = createTaskMessageHandler({ reconcile });
    await expect(handle({ type: "other" })).resolves.toBe(false);
    await expect(handle({ type: "tasks/changed" })).resolves.toBe(true);
    expect(reconcile).toHaveBeenCalledOnce();
  });
});
