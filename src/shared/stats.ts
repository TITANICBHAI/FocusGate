import { localDateKey } from "./time.ts";
import type { DayStats, SessionRecord, WeeklyReport } from "./types.ts";

export interface StreakSummary {
  current: number;
  best: number;
}

export interface StatsTotals {
  focusMs: number;
  sessionsCompleted: number;
  sessionsAbandoned: number;
  blocks: number;
  blocksByDomain: Record<string, number>;
  tasksCompleted: number;
  completionRate: number;
}

export interface FocusScoreInput {
  focusMs: number;
  dailyGoalMin: number;
  tasksCompleted: number;
  tasksPlanned: number;
  streak: number;
}

export interface FocusInsights {
  mostProductiveHour: number | null;
  bestWeekday: number | null;
  averageSessionMs: number;
  completionRate: number;
  totalHours: number;
  thisWeekSessions: number;
  thisWeekMinutes: number;
  bestSessionMs: number;
  topBlockedDomains: Array<{ domain: string; count: number }>;
}

function inDateRange(dateKey: string, start: string, end: string): boolean {
  return dateKey >= start && dateKey <= end;
}

export function aggregateStats(
  records: SessionRecord[],
  days: Record<string, DayStats>,
  startDateKey: string,
  endDateKey: string,
): StatsTotals {
  const selectedRecords = records.filter((record) => {
    const key = localDateKey(new Date(record.startedAt));
    return inDateRange(key, startDateKey, endDateKey);
  });
  const selectedDays = Object.values(days).filter((day) =>
    inDateRange(day.dateKey, startDateKey, endDateKey),
  );
  const blocksByDomain: Record<string, number> = {};
  for (const day of selectedDays) {
    for (const [domain, count] of Object.entries(day.blocksByDomain)) {
      blocksByDomain[domain] = (blocksByDomain[domain] ?? 0) + count;
    }
  }

  const focusMs =
    selectedRecords.length > 0
      ? selectedRecords.reduce(
          (total, record) =>
            total + (record.status === "interrupted" ? 0 : record.elapsedMs),
          0,
        )
      : selectedDays.reduce((total, day) => total + day.focusMs, 0);
  const sessionsCompleted =
    selectedRecords.length > 0
      ? selectedRecords.filter((record) => record.status === "completed").length
      : selectedDays.reduce((total, day) => total + day.sessionsCompleted, 0);
  const sessionsAbandoned =
    selectedRecords.length > 0
      ? selectedRecords.filter((record) => record.status === "abandoned").length
      : selectedDays.reduce((total, day) => total + day.sessionsAbandoned, 0);
  const sessions = sessionsCompleted + sessionsAbandoned;

  return {
    focusMs,
    sessionsCompleted,
    sessionsAbandoned,
    blocks: selectedDays.reduce((total, day) => total + day.blocks, 0),
    blocksByDomain,
    tasksCompleted: selectedDays.reduce(
      (total, day) => total + day.tasksCompleted,
      0,
    ),
    completionRate: sessions === 0 ? 0 : sessionsCompleted / sessions,
  };
}

export function calculateStreaks(
  records: SessionRecord[],
  now: Date = new Date(),
): StreakSummary {
  const completedDays = new Set(
    records
      .filter((record) => record.status === "completed")
      .map((record) => localDateKey(new Date(record.startedAt))),
  );
  if (completedDays.size === 0) return { current: 0, best: 0 };

  const sorted = [...completedDays].sort();
  let best = 0;
  let run = 0;
  let previous: Date | null = null;
  for (const key of sorted) {
    const date = new Date(`${key}T12:00:00`);
    const priorDay = previous ? new Date(previous) : null;
    if (
      priorDay &&
      localDateKey(new Date(priorDay.getFullYear(), priorDay.getMonth(), priorDay.getDate() + 1)) ===
        key
    ) {
      run += 1;
    } else {
      run = 1;
    }
    best = Math.max(best, run);
    previous = date;
  }

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const todayKey = localDateKey(today);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  let cursor = completedDays.has(todayKey) ? today : yesterday;
  let current = 0;
  while (completedDays.has(localDateKey(cursor))) {
    current += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return { current, best };
}

export function calculateFocusScore(input: FocusScoreInput): number {
  const goalMs = Math.max(0, input.dailyGoalMin) * 60_000;
  const goalProgress = goalMs === 0 ? 1 : Math.min(1, input.focusMs / goalMs);
  const taskProgress =
    input.tasksPlanned <= 0
      ? 0
      : Math.min(1, input.tasksCompleted / input.tasksPlanned);
  return Math.min(
    100,
    Math.round(
      goalProgress * 60 + taskProgress * 30 + (input.streak > 0 ? 10 : 0),
    ),
  );
}

export function formatDuration(milliseconds: number): string {
  const minutes = Math.max(0, Math.floor(milliseconds / 60_000));
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return hours > 0
    ? `${hours} h ${remainingMinutes} min`
    : `${remainingMinutes} min`;
}

export function buildWeeklyReport(
  days: Record<string, DayStats>,
  startDateKey: string,
  endDateKey: string,
  streak = 0,
): WeeklyReport {
  const selected = Object.values(days).filter((day) =>
    inDateRange(day.dateKey, startDateKey, endDateKey),
  );
  const domains: Record<string, number> = {};
  for (const day of selected) {
    for (const [domain, count] of Object.entries(day.blocksByDomain)) {
      domains[domain] = (domains[domain] ?? 0) + count;
    }
  }
  const topBlockedSites = Object.entries(domains)
    .sort(([, left], [, right]) => right - left)
    .slice(0, 5)
    .map(([domain, count]) => ({ domain, count }));
  const focusMs = selected.reduce((total, day) => total + day.focusMs, 0);
  const totalSessions = selected.reduce(
    (total, day) => total + day.sessionsCompleted + day.sessionsAbandoned,
    0,
  );

  return {
    startDateKey,
    endDateKey,
    focusMs,
    focusText: formatDuration(focusMs),
    sessionsCompleted: selected.reduce(
      (total, day) => total + day.sessionsCompleted,
      0,
    ),
    tasksCompleted: selected.reduce(
      (total, day) => total + day.tasksCompleted,
      0,
    ),
    blockedAttempts: selected.reduce((total, day) => total + day.blocks, 0),
    averageDailyMs: selected.length ? focusMs / selected.length : 0,
    completionRate:
      totalSessions === 0
        ? 0
        : selected.reduce((total, day) => total + day.sessionsCompleted, 0) /
          totalSessions,
    streak,
    topBlockedSites,
  };
}

export function getFocusInsights(
  records: SessionRecord[],
  days: Record<string, DayStats>,
  now: Date = new Date(),
): FocusInsights {
  const completed = records.filter((record) => record.status === "completed");
  const hourTotals = new Map<number, number>();
  const weekdayTotals = new Map<number, number>();
  for (const record of completed) {
    const start = new Date(record.startedAt);
    hourTotals.set(start.getHours(), (hourTotals.get(start.getHours()) ?? 0) + record.elapsedMs);
    weekdayTotals.set(start.getDay(), (weekdayTotals.get(start.getDay()) ?? 0) + record.elapsedMs);
  }
  const bestEntry = (values: Map<number, number>) =>
    [...values.entries()].sort(([, left], [, right]) => right - left)[0]?.[0] ??
    null;

  const weekStart = new Date(now);
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
  const weekStartKey = localDateKey(weekStart);
  const todayKey = localDateKey(now);
  const thisWeek = records.filter((record) => {
    const key = localDateKey(new Date(record.startedAt));
    return key >= weekStartKey && key <= todayKey;
  });
  const totalSessions = records.filter(
    (record) => record.status !== "interrupted",
  );
  const domainCounts: Record<string, number> = {};
  for (const day of Object.values(days)) {
    for (const [domain, count] of Object.entries(day.blocksByDomain)) {
      domainCounts[domain] = (domainCounts[domain] ?? 0) + count;
    }
  }
  const topBlockedDomains = Object.entries(domainCounts)
    .sort(([, left], [, right]) => right - left)
    .slice(0, 5)
    .map(([domain, count]) => ({ domain, count }));

  return {
    mostProductiveHour: bestEntry(hourTotals),
    bestWeekday: bestEntry(weekdayTotals),
    averageSessionMs: completed.length
      ? completed.reduce((total, record) => total + record.elapsedMs, 0) /
        completed.length
      : 0,
    completionRate: totalSessions.length
      ? completed.length / totalSessions.length
      : 0,
    totalHours:
      records.reduce((total, record) => total + record.elapsedMs, 0) /
      3_600_000,
    thisWeekSessions: thisWeek.filter(
      (record) => record.status === "completed",
    ).length,
    thisWeekMinutes: thisWeek.reduce(
      (total, record) => total + record.elapsedMs,
      0,
    ) / 60_000,
    bestSessionMs: completed.reduce(
      (best, record) => Math.max(best, record.elapsedMs),
      0,
    ),
    topBlockedDomains,
  };
}
