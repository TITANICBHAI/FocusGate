import {
  buildWeeklyReport,
  calculateStreaks,
  lastNDaysRange,
} from "../shared/stats.ts";
import type { AppState } from "../shared/types.ts";
import type { SessionNotice } from "./notify.ts";

export interface WeeklyReportServiceDependencies {
  store: {
    readState(): Promise<AppState>;
    writeState(patch: Partial<AppState>): Promise<void>;
  };
  notify(notice: SessionNotice): Promise<void>;
  now(): number;
  onError?(error: unknown): void;
}

export interface WeeklyReportService {
  /** WP8.3: build, store, and announce the previous week's report once. */
  generate(): Promise<void>;
}

/**
 * Staged WP8.3 service: the Monday-morning report covers the previous
 * Monday-through-Sunday window. Regenerating for the same window is a no-op.
 */
export function createWeeklyReportService(
  dependencies: WeeklyReportServiceDependencies,
): WeeklyReportService {
  return {
    async generate() {
      let state: AppState;
      const now = dependencies.now();
      try {
        state = await dependencies.store.readState();
      } catch (error) {
        dependencies.onError?.(error);
        return;
      }

      const endDate = new Date(now);
      endDate.setHours(0, 0, 0, 0);
      endDate.setDate(endDate.getDate() - 1);
      const { startDateKey, endDateKey } = lastNDaysRange(endDate, 7);

      const last = state.lastWeeklyReport;
      if (last && (last as { endDateKey?: unknown }).endDateKey === endDateKey) {
        return;
      }

      const streaks = calculateStreaks(state.sessionHistory, new Date(now));
      const report = buildWeeklyReport(
        state.dayStats,
        startDateKey,
        endDateKey,
        streaks.current,
      );

      try {
        await dependencies.store.writeState({
          lastWeeklyReport: report,
          weeklyReports: [...state.weeklyReports, report].slice(-8),
        });
      } catch (error) {
        dependencies.onError?.(error);
        return;
      }

      if (!state.settings.notifications.weeklyReport) return;
      try {
        await dependencies.notify({
          kind: "weekly_report",
          focusText: String(report.focusText ?? ""),
          sessionsCompleted: Number(report.sessionsCompleted ?? 0),
        });
      } catch (error) {
        dependencies.onError?.(error);
      }
    },
  };
}
