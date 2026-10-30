import { describe, expect, it } from "vitest";
import { createWeeklyReportService } from "../../src/background/weeklyReport.ts";
import { createDefaultState } from "../../src/shared/defaults.ts";
import type { AppState } from "../../src/shared/types.ts";

// Monday, 2026-11-02 at 09:00 local — the weekly report fires then and
// covers the previous Monday-through-Sunday window (2026-10-26..11-01).
const NOW = new Date(2026, 10, 2, 9, 0).getTime();

function stateWithDays(): AppState {
  const state = createDefaultState();
  const day = (dateKey: string, focusMin: number, blocks: number) => {
    state.dayStats[dateKey] = {
      dateKey,
      focusMs: focusMin * 60_000,
      sessionsCompleted: focusMin > 0 ? 1 : 0,
      sessionsAbandoned: 0,
      blocks,
      blocksByDomain: blocks > 0 ? { "example.com": blocks } : {},
      tasksCompleted: 0,
    };
  };
  day("2026-10-26", 30, 1);
  day("2026-10-27", 45, 0);
  day("2026-10-28", 25, 2);
  day("2026-10-29", 60, 0);
  day("2026-10-30", 20, 0);
  day("2026-10-31", 50, 0);
  day("2026-11-01", 40, 0);
  state.sessionHistory = [
    {
      id: "s1",
      startedAt: NOW - 7 * 86_400_000,
      endedAt: NOW - 7 * 86_400_000 + 30 * 60_000,
      plannedMs: 30 * 60_000,
      elapsedMs: 30 * 60_000,
      status: "completed",
      lockLevel: "none",
      blockedAttempts: 0,
      gaps: [],
    },
  ];
  return state;
}

function createHarness(initial: AppState) {
  let state = structuredClone(initial);
  const writes: Partial<AppState>[] = [];
  const notices: string[] = [];
  const service = createWeeklyReportService({
    store: {
      readState: async () => structuredClone(state),
      writeState: async (patch) => {
        writes.push(structuredClone(patch));
        state = { ...state, ...patch };
      },
    },
    notify: async (notice) => {
      notices.push(
        notice.kind === "weekly_report" ? notice.focusText : notice.kind,
      );
    },
    now: () => NOW,
  });
  return { service, state: () => state, writes, notices };
}

describe("weekly report service", () => {
  it("builds the previous seven days and stores the last report", async () => {
    const harness = createHarness(stateWithDays());
    await harness.service.generate();

    expect(harness.writes).toHaveLength(1);
    const report = harness.writes[0]?.lastWeeklyReport as Record<
      string,
      unknown
    >;
    expect(report.startDateKey).toBe("2026-10-26");
    expect(report.endDateKey).toBe("2026-11-01");
    expect(report.focusText).toBe("4 h 30 min");
    expect(report.sessionsCompleted).toBe(6);
    expect(report.blockedAttempts).toBe(3);
    expect(harness.state().lastWeeklyReport?.endDateKey).toBe("2026-11-01");
    expect(harness.state().weeklyReports).toHaveLength(1);
  });

  it("keeps at most eight saved reports", async () => {
    const state = stateWithDays();
    state.weeklyReports = Array.from({ length: 8 }, (_, index) => ({
      startDateKey: `2026-01-0${index + 1}`,
    }));
    const harness = createHarness(state);
    await harness.service.generate();
    expect(harness.state().weeklyReports).toHaveLength(8);
    expect(harness.state().weeklyReports[0]?.startDateKey).toBe(
      "2026-01-02",
    );
  });

  it("does not regenerate for a window that was already reported", async () => {
    const harness = createHarness(stateWithDays());
    await harness.service.generate();
    const stored = harness.state().lastWeeklyReport;
    await harness.service.generate();
    expect(harness.writes).toHaveLength(1);
    expect(harness.state().lastWeeklyReport).toEqual(stored);
  });

  it("respects the weekly-report notification toggle", async () => {
    const state = stateWithDays();
    state.settings.notifications.weeklyReport = false;
    const harness = createHarness(state);
    await harness.service.generate();
    expect(harness.writes).toHaveLength(1);
    expect(harness.notices).toEqual([]);
  });

  it("announces the report with hours and minutes, never floored hours", async () => {
    const harness = createHarness(stateWithDays());
    await harness.service.generate();
    expect(harness.notices).toEqual(["4 h 30 min"]);
  });
});
