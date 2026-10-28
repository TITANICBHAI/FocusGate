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
  });

  it("does not reset existing correct alarms on worker wake", async () => {
    const state = createDefaultState();
    state.session.status = "work";
    state.session.phaseEndsAt = 60_000;
    const fake = createFakeAlarms([
      { name: TICK_ALARM, scheduledTime: 60_000 },
      { name: SESSION_PHASE_END_ALARM, scheduledTime: 60_000 },
    ]);

    await ensureAlarms(fake.api, state.session, state.standalone, 0);

    expect(fake.creates).toHaveLength(0);
    expect(fake.clears).toHaveLength(0);
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
    expect(fake.creates.at(-1)).toEqual({
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
});
