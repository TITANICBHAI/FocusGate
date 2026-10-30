import { describe, expect, it } from "vitest";
import {
  aggregateStats,
  buildWeeklyReport,
  calculateFocusScore,
  calculateStreaks,
  focusMinutesPerDay,
  formatDuration,
  getFocusInsights,
  lastNDaysRange,
  pruneDayStats,
  pruneRecentBlocks,
  pruneSessionHistory,
  todayAllowanceUsage,
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
      current: 0,
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

  it("computes WP8 aggregates from a seeded fixture (hand-calculated)", () => {
    // WP8.AC2 fixture generator: five deterministic days with known values.
    const generatedDays: Record<string, DayStats> = {};
    const generatedRecords: SessionRecord[] = [];
    for (let index = 1; index <= 5; index += 1) {
      const dateKey = `2026-10-${String(index).padStart(2, "0")}`;
      const focusMs = index * 10 * 60_000; // 10..50 minutes
      generatedDays[dateKey] = dayStats(dateKey, {
        focusMs,
        sessionsCompleted: index % 2, // 1,0,1,0,1
        sessionsAbandoned: index % 2 === 0 ? 1 : 0,
        blocks: index,
        blocksByDomain: { "example.com": index },
        tasksCompleted: index % 2,
      });
      if (index % 2 === 1) {
        generatedRecords.push(record(index, "completed", focusMs));
      } else {
        generatedRecords.push(record(index, "abandoned", focusMs));
      }
    }

    const totals = aggregateStats(
      generatedRecords,
      generatedDays,
      "2026-10-01",
      "2026-10-31",
    );
    // Hand-calculated from the records (aggregateStats prefers records when
    // they exist): focus 10+20+30+40+50 = 150 min; completed on odd days and
    // abandoned on even days → rate 3/5.
    expect(totals.focusMs).toBe(150 * 60_000);
    expect(totals.sessionsCompleted).toBe(3);
    expect(totals.sessionsAbandoned).toBe(2);
    expect(totals.blocks).toBe(15);
    expect(totals.tasksCompleted).toBe(3);
    expect(totals.completionRate).toBeCloseTo(3 / 5, 5);
    expect(totals.blocksByDomain).toEqual({ "example.com": 15 });

    // The trailing-week range covers exactly the seven days ending on the end key.
    const range = lastNDaysRange(new Date(2026, 9, 31, 12), 7);
    expect(range).toEqual({ startDateKey: "2026-10-25", endDateKey: "2026-10-31" });

    // Chart points cover every day in the range, including zero days:
    // Oct 4 focused 40 min, Oct 5 focused 50 min, then the fixture ends.
    const chart = focusMinutesPerDay(generatedDays, "2026-10-04", "2026-10-08");
    expect(chart.map((point) => point.minutes)).toEqual([40, 50, 0, 0, 0]);
  });

  it("caps statistics collections during midnight pruning (WP8.4)", () => {
    const history: SessionRecord[] = Array.from({ length: 520 }, (_, index) => ({
      id: `session-${index}`,
      startedAt: index,
      endedAt: index,
      plannedMs: 0,
      elapsedMs: 0,
      status: "completed",
      lockLevel: "none",
      blockedAttempts: 0,
      gaps: [],
    }));
    const prunedHistory = pruneSessionHistory(history);
    expect(prunedHistory).toHaveLength(500);
    expect(prunedHistory[0]?.id).toBe("session-20");
    expect(prunedHistory[499]?.id).toBe("session-519");

    const days: Record<string, DayStats> = {};
    for (let index = 1; index <= 420; index += 1) {
      const date = new Date(2026, 0, index);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      days[key] = dayStats(key);
    }
    const prunedDays = pruneDayStats(days);
    expect(Object.keys(prunedDays)).toHaveLength(400);

    const blocks = Array.from({ length: 210 }, (_, index) => ({
      domain: `domain-${index}.example`,
      reason: "legacy",
      at: index,
    }));
    const prunedBlocks = pruneRecentBlocks(blocks);
    expect(prunedBlocks).toHaveLength(200);
    expect(prunedBlocks[0]?.domain).toBe("domain-10.example");
  });

  it("builds chart points and today's allowance usage (WP8.1)", () => {
    const allowances = {
      "example.com": { mode: "time_budget", limitMin: 60, duringBlocks: true },
      "news.example": { mode: "count", maxOpens: 5, duringBlocks: true },
    } as const;
    const usage = {
      "example.com": {
        dateKey: "2026-10-31",
        usedMs: 21 * 60_000,
        opens: 1,
        windowStartMs: 0,
        lastActiveAt: 0,
      },
      "news.example": {
        dateKey: "2026-10-31",
        usedMs: 0,
        opens: 2,
        windowStartMs: 0,
        lastActiveAt: 0,
      },
      "stale.example": {
        dateKey: "2026-10-01",
        usedMs: 500 * 60_000,
        opens: 1,
        windowStartMs: 0,
        lastActiveAt: 0,
      },
    };
    const usageRows = todayAllowanceUsage(
      allowances,
      usage,
      new Date(2026, 9, 31, 12),
    );
    expect(usageRows).toEqual([
      { domain: "example.com", usedMinutes: 21, limitMinutes: 60 },
      { domain: "news.example", usedMinutes: 0, limitMinutes: null },
    ]);

    const chart = focusMinutesPerDay(
      { "2026-10-31": dayStats("2026-10-31", { focusMs: 90 * 60_000 }) },
      "2026-10-29",
      "2026-10-31",
    );
    expect(chart).toEqual([
      { dateKey: "2026-10-29", minutes: 0 },
      { dateKey: "2026-10-30", minutes: 0 },
      { dateKey: "2026-10-31", minutes: 90 },
    ]);
  });
});
