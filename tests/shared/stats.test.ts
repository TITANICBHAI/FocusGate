import { describe, expect, it } from "vitest";
import {
  aggregateStats,
  buildWeeklyReport,
  calculateFocusScore,
  calculateStreaks,
  formatDuration,
  getFocusInsights,
} from "../../src/shared/stats.ts";
import type { DayStats, SessionRecord } from "../../src/shared/types.ts";

function record(day: number, status: SessionRecord["status"], elapsedMs: number): SessionRecord {
  const startedAt = new Date(2026, 9, day, 9).getTime();
  return {
    id: `${day}-${status}`,
    startedAt,
    endedAt: startedAt + elapsedMs,
    plannedMs: elapsedMs,
    elapsedMs,
    status,
    lockLevel: "none",
    blockedAttempts: 0,
    gaps: [],
  };
}

const dayStats = (day: string, overrides: Partial<DayStats> = {}): DayStats => ({
  dateKey: day,
  focusMs: 0,
  sessionsCompleted: 0,
  sessionsAbandoned: 0,
  blocks: 0,
  blocksByDomain: {},
  tasksCompleted: 0,
  ...overrides,
});

describe("focus statistics", () => {
  it("calculates current and best streaks across local calendar days", () => {
    const records = [
      record(24, "completed", 60_000),
      record(25, "completed", 60_000),
      record(26, "completed", 60_000),
      record(27, "abandoned", 60_000),
    ];
    expect(calculateStreaks(records, new Date(2026, 9, 27, 12))).toEqual({
      current: 3,
      best: 3,
    });
    expect(calculateStreaks(records, new Date(2026, 9, 28, 12))).toEqual({
      current: 3,
      best: 3,
    });
  });

  it("aggregates actual session time and daily block totals in a date range", () => {
    const records = [record(26, "completed", 90_000), record(26, "abandoned", 30_000)];
    const days = {
      "2026-10-26": dayStats("2026-10-26", {
        blocks: 2,
        blocksByDomain: { "example.com": 2 },
        tasksCompleted: 1,
      }),
    };
    expect(
      aggregateStats(records, days, "2026-10-26", "2026-10-26"),
    ).toMatchObject({
      focusMs: 120_000,
      sessionsCompleted: 1,
      sessionsAbandoned: 1,
      blocks: 2,
      blocksByDomain: { "example.com": 2 },
      tasksCompleted: 1,
      completionRate: 0.5,
    });
  });

  it("uses the specified daily-goal/task/streak score formula", () => {
    expect(
      calculateFocusScore({
        focusMs: 60 * 60_000,
        dailyGoalMin: 120,
        tasksCompleted: 1,
        tasksPlanned: 2,
        streak: 3,
      }),
    ).toBe(55);
    expect(
      calculateFocusScore({
        focusMs: 120 * 60_000,
        dailyGoalMin: 120,
        tasksCompleted: 2,
        tasksPlanned: 2,
        streak: 1,
      }),
    ).toBe(100);
  });

  it("formats minutes without dropping sub-hour time", () => {
    expect(formatDuration(6 * 60 * 60_000 + 25 * 60_000)).toBe("6 h 25 min");
    expect(formatDuration(59 * 60_000)).toBe("59 min");
  });

  it("builds weekly totals and focus insights from seeded records", () => {
    const records = [
      record(26, "completed", 60 * 60_000),
      record(27, "completed", 30 * 60_000),
      record(27, "abandoned", 10 * 60_000),
    ];
    const days = {
      "2026-10-26": dayStats("2026-10-26", {
        focusMs: 60 * 60_000,
        sessionsCompleted: 1,
        blocks: 2,
        blocksByDomain: { "example.com": 2 },
      }),
      "2026-10-27": dayStats("2026-10-27", {
        focusMs: 30 * 60_000,
        sessionsCompleted: 1,
        sessionsAbandoned: 1,
        blocks: 1,
        blocksByDomain: { "news.example": 1 },
      }),
    };
    const report = buildWeeklyReport(days, "2026-10-26", "2026-11-01", 2);
    expect(report).toMatchObject({
      focusMs: 90 * 60_000,
      focusText: "1 h 30 min",
      sessionsCompleted: 2,
      blockedAttempts: 3,
      streak: 2,
      topBlockedSites: [
        { domain: "example.com", count: 2 },
        { domain: "news.example", count: 1 },
      ],
    });

    const insights = getFocusInsights(records, days, new Date(2026, 9, 27, 12));
    expect(insights).toMatchObject({
      averageSessionMs: 45 * 60_000,
      completionRate: 2 / 3,
      thisWeekSessions: 2,
      bestSessionMs: 60 * 60_000,
      topBlockedDomains: [
        { domain: "example.com", count: 2 },
        { domain: "news.example", count: 1 },
      ],
    });
  });
});
