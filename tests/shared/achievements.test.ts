import { describe, expect, it } from "vitest";
import {
  currentStreakLength,
  evaluateAchievements,
} from "../../src/shared/achievements.ts";
import type { DayStats, SessionRecord } from "../../src/shared/types.ts";

// 2026-10-31 (UTC noon keeps the local calendar day stable across time zones).
const NOW = Date.UTC(2026, 9, 31, 12);
const DAY_MS = 86_400_000;

function cleanSession(overrides: Partial<SessionRecord> = {}): SessionRecord {
  return {
    id: "session-1",
    startedAt: 0,
    endedAt: 0,
    plannedMs: 0,
    elapsedMs: 0,
    status: "completed",
    lockLevel: "none",
    blockedAttempts: 0,
    gaps: [],
    ...overrides,
  };
}

function day(dateKey: string, overrides: Partial<DayStats> = {}): DayStats {
  return {
    dateKey,
    focusMs: 0,
    sessionsCompleted: 0,
    sessionsAbandoned: 0,
    blocks: 0,
    blocksByDomain: {},
    tasksCompleted: 0,
    ...overrides,
  };
}

function daysBack(count: number, from = NOW): string[] {
  return Array.from({ length: count }, (_, index) =>
    new Date(from - index * DAY_MS).toISOString().slice(0, 10),
  );
}

function focusedDays(count: number): Record<string, DayStats> {
  return Object.fromEntries(
    daysBack(count).map((dateKey) => [
      dateKey,
      day(dateKey, { sessionsCompleted: 1 }),
    ]),
  );
}

function mondayOf(utcNoon: Date): Date {
  const monday = new Date(utcNoon);
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  monday.setUTCHours(12, 0, 0, 0);
  return monday;
}

describe("evaluateAchievements", () => {
  it("unlocks IRON_SESSION for the first clean completed session", () => {
    const result = evaluateAchievements({
      sessionHistory: [cleanSession()],
      dayStats: {},
      unlockedIds: [],
      now: NOW,
    });
    expect(result.map((achievement) => achievement.id)).toEqual([
      "IRON_SESSION",
    ]);
    expect(result[0]?.unlockedAt).toBe(NOW);
  });

  it("does not re-unlock known achievements", () => {
    const result = evaluateAchievements({
      sessionHistory: [cleanSession()],
      dayStats: {},
      unlockedIds: ["IRON_SESSION"],
      now: NOW,
    });
    expect(result).toEqual([]);
  });

  it("unlocks RESISTANCE_10 at ten clean sessions", () => {
    const result = evaluateAchievements({
      sessionHistory: Array.from({ length: 10 }, (_, index) =>
        cleanSession({ id: `session-${index}` }),
      ),
      dayStats: {},
      unlockedIds: ["IRON_SESSION"],
      now: NOW,
    });
    expect(result.map((achievement) => achievement.id)).toEqual([
      "RESISTANCE_10",
    ]);
  });

  it("withholds RESISTANCE_10 when sessions had blocked attempts", () => {
    const result = evaluateAchievements({
      sessionHistory: Array.from({ length: 10 }, (_, index) =>
        cleanSession({ id: `session-${index}`, blockedAttempts: 2 }),
      ),
      dayStats: {},
      unlockedIds: [],
      now: NOW,
    });
    expect(result).toEqual([]);
  });

  it("unlocks QUIET_WIN for 60 clean minutes in a day", () => {
    const result = evaluateAchievements({
      sessionHistory: [],
      dayStats: {
        "2026-10-31": day("2026-10-31", { focusMs: 60 * 60_000 }),
      },
      unlockedIds: [],
      now: NOW,
    });
    expect(result.map((achievement) => achievement.id)).toEqual(["QUIET_WIN"]);
  });

  it("withholds QUIET_WIN when the day had blocked pages", () => {
    const result = evaluateAchievements({
      sessionHistory: [],
      dayStats: {
        "2026-10-31": day("2026-10-31", { focusMs: 60 * 60_000, blocks: 1 }),
      },
      unlockedIds: [],
      now: NOW,
    });
    expect(result).toEqual([]);
  });

  it("unlocks THREE_WEEKS at a 21-day focus streak", () => {
    const result = evaluateAchievements({
      sessionHistory: [],
      dayStats: focusedDays(21),
      unlockedIds: [],
      now: NOW,
    });
    expect(result.map((achievement) => achievement.id)).toEqual([
      "THREE_WEEKS",
    ]);
  });

  it("withholds THREE_WEEKS when the streak is shorter", () => {
    const result = evaluateAchievements({
      sessionHistory: [],
      dayStats: focusedDays(20),
      unlockedIds: [],
      now: NOW,
    });
    expect(result).toEqual([]);
  });

  it("unlocks PRESENCE_7 for a fully focused Monday-through-Sunday week", () => {
    const monday = mondayOf(new Date(NOW));
    monday.setUTCDate(monday.getUTCDate() - 7);
    const week = Object.fromEntries(
      Array.from({ length: 7 }, (_, index) => {
        const dateKey = new Date(monday.getTime() + index * DAY_MS)
          .toISOString()
          .slice(0, 10);
        return [dateKey, day(dateKey, { sessionsCompleted: 1 })];
      }),
    );
    const result = evaluateAchievements({
      sessionHistory: [],
      dayStats: week,
      unlockedIds: [],
      now: NOW,
    });
    expect(result.map((achievement) => achievement.id)).toContain("PRESENCE_7");
  });

  it("unlocks BACK_AGAIN after a gap of more than five days", () => {
    const result = evaluateAchievements({
      sessionHistory: [],
      dayStats: focusedDays(1),
      unlockedIds: [],
      now: NOW,
    });
    expect(result).toEqual([]);

    const withGap = {
      ...focusedDays(1),
      "2026-10-20": day("2026-10-20", { sessionsCompleted: 1 }),
    };
    const backAgain = evaluateAchievements({
      sessionHistory: [],
      dayStats: withGap,
      unlockedIds: [],
      now: NOW,
    });
    expect(backAgain.map((achievement) => achievement.id)).toContain(
      "BACK_AGAIN",
    );
  });
});

describe("currentStreakLength", () => {
  it("is zero with no focus days", () => {
    expect(currentStreakLength([], "2026-10-31")).toBe(0);
  });

  it("counts today's focus", () => {
    expect(currentStreakLength(["2026-10-31"], "2026-10-31")).toBe(1);
    expect(
      currentStreakLength(
        ["2026-10-29", "2026-10-30", "2026-10-31"],
        "2026-10-31",
      ),
    ).toBe(3);
  });

  it("stays alive through an unfocused today when yesterday focused", () => {
    expect(currentStreakLength(["2026-10-30"], "2026-10-31")).toBe(1);
    expect(
      currentStreakLength(["2026-10-28", "2026-10-29", "2026-10-30"], "2026-10-31"),
    ).toBe(3);
  });

  it("breaks after a missed day", () => {
    expect(currentStreakLength(["2026-10-29"], "2026-10-31")).toBe(0);
  });
});
