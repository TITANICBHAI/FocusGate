import { describe, expect, it } from "vitest";
import { evaluateAchievements } from "../../src/shared/achievements.ts";
import { createBackupJson, parseBackupJson } from "../../src/shared/backup.ts";
import { createDefaultState } from "../../src/shared/defaults.ts";
import { addRecordToDayStats, countedFocusMs } from "../../src/shared/session.ts";
import {
  dayGoalProgress,
  goalFocusMs,
  stoppedEarlyText,
  stoppedFocusMs,
} from "../../src/shared/stats.ts";
import type { DayStats, SessionRecord } from "../../src/shared/types.ts";

const MINUTE = 60_000;
const START = new Date(2026, 10, 11, 10, 0).getTime();
const KEY = "2026-11-11";

function record(overrides: Partial<SessionRecord>): SessionRecord {
  const elapsedMs = overrides.elapsedMs ?? 25 * MINUTE;
  return {
    id: "s:1",
    startedAt: START,
    endedAt: START + elapsedMs,
    plannedMs: 25 * MINUTE,
    elapsedMs,
    status: "completed",
    lockLevel: "none",
    blockedAttempts: 0,
    gaps: [],
    ...overrides,
  };
}

function day(overrides: Partial<DayStats> = {}): DayStats {
  return {
    dateKey: KEY,
    focusMs: 0,
    sessionsCompleted: 0,
    sessionsAbandoned: 0,
    blocks: 0,
    blocksByDomain: {},
    tasksCompleted: 0,
    ...overrides,
  };
}

describe("a stopped session in the day totals", () => {
  it("adds its minutes to focused time and also to the stopped-early minutes", () => {
    const stopped = record({ status: "abandoned", elapsedMs: 12 * MINUTE });
    const days = addRecordToDayStats({}, stopped);
    expect(days[KEY]).toMatchObject({
      focusMs: 12 * MINUTE,
      stoppedMs: 12 * MINUTE,
      sessionsAbandoned: 1,
      sessionsCompleted: 0,
    });
  });

  it("keeps a completed session out of the stopped-early minutes", () => {
    const days = addRecordToDayStats({}, record({}));
    expect(days[KEY]?.focusMs).toBe(25 * MINUTE);
    expect(days[KEY]?.stoppedMs ?? 0).toBe(0);
  });

  it("adds a stopped session to a day that already has a completed one", () => {
    let days = addRecordToDayStats({}, record({}));
    days = addRecordToDayStats(
      days,
      record({ id: "s:2", status: "abandoned", elapsedMs: 12 * MINUTE }),
    );
    expect(days[KEY]).toMatchObject({ focusMs: 37 * MINUTE, stoppedMs: 12 * MINUTE });
  });

  it("counts nothing for an interrupted session", () => {
    const days = addRecordToDayStats({}, record({ status: "interrupted" }));
    expect(days[KEY]?.focusMs).toBe(0);
    expect(days[KEY]?.stoppedMs ?? 0).toBe(0);
  });

  it("leaves out the time the browser was closed, as before", () => {
    const stopped = record({
      status: "abandoned",
      elapsedMs: 20 * MINUTE,
      gaps: [{ from: START + 5 * MINUTE, to: START + 9 * MINUTE }],
    });
    expect(countedFocusMs(stopped)).toBe(16 * MINUTE);
    expect(addRecordToDayStats({}, stopped)[KEY]).toMatchObject({
      focusMs: 16 * MINUTE,
      stoppedMs: 16 * MINUTE,
    });
  });
});

describe("what counts toward the daily goal", () => {
  it("is focused time without the stopped-early minutes", () => {
    const d = day({ focusMs: 37 * MINUTE, stoppedMs: 12 * MINUTE });
    expect(goalFocusMs(d)).toBe(25 * MINUTE);
    expect(stoppedFocusMs(d)).toBe(12 * MINUTE);
  });

  it("is all of the focused time for a day saved before this change", () => {
    expect(goalFocusMs(day({ focusMs: 40 * MINUTE }))).toBe(40 * MINUTE);
    expect(stoppedFocusMs(day({ focusMs: 40 * MINUTE }))).toBe(0);
  });

  it("is zero, never negative, and zero for a missing day", () => {
    expect(goalFocusMs(day({ focusMs: 5 * MINUTE, stoppedMs: 9 * MINUTE }))).toBe(0);
    expect(goalFocusMs(undefined)).toBe(0);
    expect(stoppedFocusMs(undefined)).toBe(0);
  });

  it("gives goal progress from those minutes only, capped at 1", () => {
    const d = day({ focusMs: 50 * MINUTE, stoppedMs: 20 * MINUTE });
    expect(dayGoalProgress(d, 60)).toBeCloseTo(0.5);
    expect(dayGoalProgress(day({ focusMs: 90 * MINUTE }), 60)).toBe(1);
    expect(dayGoalProgress(undefined, 60)).toBe(0);
  });
});

describe("the stopped-early line", () => {
  it("says how long and that it is not counted toward the goal", () => {
    expect(stoppedEarlyText(day({ focusMs: 12 * MINUTE, stoppedMs: 12 * MINUTE }))).toBe(
      "12 min stopped early, not counted toward your goal.",
    );
  });

  it("is absent when nothing was stopped, or less than a minute was", () => {
    expect(stoppedEarlyText(day({ focusMs: 30 * MINUTE }))).toBeNull();
    expect(stoppedEarlyText(day({ focusMs: 30_000, stoppedMs: 30_000 }))).toBeNull();
    expect(stoppedEarlyText(undefined)).toBeNull();
  });
});

describe("Quiet Win and stopped minutes", () => {
  const history: SessionRecord[] = [];
  const base = { sessionHistory: history, unlockedIds: [], now: START };

  it("does not unlock when stopped minutes are what take the day past 60", () => {
    const days = { [KEY]: day({ focusMs: 70 * MINUTE, stoppedMs: 20 * MINUTE }) };
    const ids = evaluateAchievements({ ...base, dayStats: days }).map((item) => item.id);
    expect(ids).not.toContain("QUIET_WIN");
  });

  it("still unlocks with 60 counted minutes", () => {
    const days = { [KEY]: day({ focusMs: 80 * MINUTE, stoppedMs: 20 * MINUTE }) };
    const ids = evaluateAchievements({ ...base, dayStats: days }).map((item) => item.id);
    expect(ids).toContain("QUIET_WIN");
  });
});

describe("backup", () => {
  it("keeps the stopped-early minutes through export and import", () => {
    const state = createDefaultState();
    state.dayStats[KEY] = day({ focusMs: 37 * MINUTE, stoppedMs: 12 * MINUTE });
    const parsed = parseBackupJson(createBackupJson(state, 123));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.backup.data.stats.dayStats[KEY]?.stoppedMs).toBe(12 * MINUTE);
    }
  });

  it("refuses a stopped-early value that is not a number", () => {
    const state = createDefaultState();
    state.dayStats[KEY] = day({ focusMs: 37 * MINUTE, stoppedMs: 12 * MINUTE });
    const original = createBackupJson(state, 123);
    const json = original
      .replace(`"stoppedMs": ${12 * MINUTE}`, `"stoppedMs": "many"`)
      .replace(`"stoppedMs":${12 * MINUTE}`, `"stoppedMs":"many"`);
    expect(json).not.toBe(original);
    expect(parseBackupJson(json)).toMatchObject({ ok: false });
  });
});
