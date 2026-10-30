import { describe, expect, it } from "vitest";
import {
  ensureAlarms,
  SESSION_PHASE_END_ALARM,
  STANDALONE_END_ALARM,
  TICK_ALARM,
} from "../../src/background/alarms.ts";
import { createDefaultState } from "../../src/shared/defaults.ts";
import type { AlarmApi, AlarmSchedule, AlarmSnapshot } from "../../src/background/alarms.ts";

function createFakeAlarms(initial: AlarmSnapshot[] = []) {
  const alarms = new Map(initial.map((alarm) => [alarm.name, alarm]));
  const creates: Array<{ name: string; info: AlarmSchedule }> = [];
  const clears: string[] = [];
  const api: AlarmApi = {
    get: async (name) => alarms.get(name),
    create: async (name, info) => {
      creates.push({ name, info });
      alarms.set(name, {
        name,
        scheduledTime: info.when ?? 0,
        ...(info.periodInMinutes !== undefined
          ? { periodInMinutes: info.periodInMinutes }
          : {}),
      });
    },
    clear: async (name) => {
      clears.push(name);
      return alarms.delete(name);
    },
  };
  return { api, alarms, creates, clears };
}

describe("session alarm scheduling", () => {
  it("creates the repeating tick and exact phase-end alarm", async () => {
    const state = createDefaultState();
    state.session.status = "work";
    state.session.phaseEndsAt = 60_000;
    const fake = createFakeAlarms();

    await ensureAlarms(fake.api, state.session, state.standalone, 0);

    expect(fake.creates).toContainEqual({
      name: TICK_ALARM,
      info: { delayInMinutes: 1, periodInMinutes: 1 },
    });
    expect(fake.creates).toContainEqual({
      name: SESSION_PHASE_END_ALARM,
      info: { when: 60_000 },
    });
    expect(fake.creates.some((alarm) => alarm.name === "boundary")).toBe(false);
    expect(fake.creates.some((alarm) => alarm.name === "weekly_report")).toBe(true);
    expect(fake.creates.some((alarm) => alarm.name === "midnight")).toBe(true);
  });

  it("does not reset existing correct alarms on worker wake", async () => {
    const state = createDefaultState();
    state.session.status = "work";
    state.session.phaseEndsAt = 60_000;
    const fake = createFakeAlarms([
      { name: TICK_ALARM, scheduledTime: 60_000, periodInMinutes: 1 },
      { name: SESSION_PHASE_END_ALARM, scheduledTime: 60_000 },
      { name: "boundary", scheduledTime: 30_000 },
      { name: "weekly_report", scheduledTime: 2_000_000 },
      { name: "midnight", scheduledTime: 86_400_000 },
    ]);

    await ensureAlarms(fake.api, state.session, state.standalone, 0, {
      nextBoundaryAt: 30_000,
      weeklyReportAt: 2_000_000,
      midnightAt: 86_400_000,
    });

    expect(fake.creates).toHaveLength(0);
    expect(fake.clears).toHaveLength(0);
  });

  it("schedules boundary, weekly-report, and midnight targets idempotently", async () => {
    const state = createDefaultState();
    const fake = createFakeAlarms();

    await ensureAlarms(fake.api, state.session, state.standalone, 0, {
      nextBoundaryAt: 45_000,
      weeklyReportAt: 80_000,
      midnightAt: 90_000,
    });

    expect(fake.creates).toContainEqual({
      name: "boundary",
      info: { when: 45_000 },
    });
    expect(fake.creates).toContainEqual({
      name: "weekly_report",
      info: { when: 80_000 },
    });
    expect(fake.creates).toContainEqual({
      name: "midnight",
      info: { when: 90_000 },
    });
  });

  it("moves a changed phase alarm and clears it after the session is idle", async () => {
    const state = createDefaultState();
    state.session.status = "work";
    state.session.phaseEndsAt = 120_000;
    const fake = createFakeAlarms([
      { name: SESSION_PHASE_END_ALARM, scheduledTime: 60_000 },
    ]);

    await ensureAlarms(fake.api, state.session, state.standalone, 0);
    expect(fake.clears).toContain(SESSION_PHASE_END_ALARM);
    expect(fake.creates).toContainEqual({
      name: SESSION_PHASE_END_ALARM,
      info: { when: 120_000 },
    });

    await ensureAlarms(
      fake.api,
      createDefaultState().session,
      state.standalone,
      0,
    );
    expect(fake.clears).toContain(SESSION_PHASE_END_ALARM);
    expect(fake.alarms.has(SESSION_PHASE_END_ALARM)).toBe(false);
    expect(fake.alarms.has(STANDALONE_END_ALARM)).toBe(false);
  });

  it("schedules standalone expiry without adding a stop path", async () => {
    const state = createDefaultState();
    state.standalone.active = true;
    state.standalone.until = 90_000;
    const fake = createFakeAlarms();

    await ensureAlarms(fake.api, state.session, state.standalone, 0);

    expect(fake.creates).toContainEqual({
      name: STANDALONE_END_ALARM,
      info: { when: 90_000 },
    });
  });

  it("clears a stale boundary and computes the next local Monday report", async () => {
    const { nextWeeklyReportAt } = await import("../../src/background/alarms.ts");
    const now = new Date(2026, 9, 28, 10, 0).getTime();
    const next = new Date(nextWeeklyReportAt(now));
    expect(next.getDay()).toBe(1);
    expect(next.getHours()).toBe(9);
    expect(next.getTime()).toBeGreaterThan(now);

    const fake = createFakeAlarms([{ name: "boundary", scheduledTime: 10 }]);
    const state = createDefaultState();
    await ensureAlarms(fake.api, state.session, state.standalone, now, {
      nextBoundaryAt: null,
      weeklyReportAt: null,
    });
    expect(fake.clears).toContain("boundary");
    expect(fake.alarms.has("weekly_report")).toBe(false);
  });

  it("keeps the weekly-report schedule unchanged across 20 worker restarts (WP8.AC3)", async () => {
    const now = new Date(2026, 9, 28, 10, 0).getTime();
    const state = createDefaultState();
    const first = createFakeAlarms();
    await ensureAlarms(first.api, state.session, state.standalone, now);
    const scheduled = first.alarms.get("weekly_report");
    expect(scheduled).toBeDefined();

    // Each restart creates a fresh alarm API (as a killed worker would) and
    // must not move the already-correct weekly schedule.
    for (let restart = 0; restart < 20; restart += 1) {
      const fake = createFakeAlarms([...first.alarms.values()]);
      await ensureAlarms(fake.api, state.session, state.standalone, now);
      expect(fake.alarms.get("weekly_report")?.scheduledTime).toBe(
        scheduled?.scheduledTime,
      );
      expect(
        fake.creates.some((alarm) => alarm.name === "weekly_report"),
      ).toBe(false);
      expect(fake.clears).not.toContain("weekly_report");
    }
  });
});
