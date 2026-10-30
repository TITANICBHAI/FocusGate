import type { AchievementRecord, DayStats, SessionRecord } from "./types.ts";

export interface AchievementDefinition {
  id: string;
  label: string;
  description: string;
}

export const ACHIEVEMENT_DEFINITIONS: readonly AchievementDefinition[] = [
  {
    id: "IRON_SESSION",
    label: "Iron Session",
    description: "Complete a focus session with zero blocked attempts.",
  },
  {
    id: "QUIET_WIN",
    label: "Quiet Win",
    description: "Log 60 clean minutes of focus in one day.",
  },
  {
    id: "RESISTANCE_10",
    label: "Resistance ×10",
    description: "Complete 10 sessions with zero blocked attempts.",
  },
  {
    id: "THREE_WEEKS",
    label: "Three Weeks",
    description: "Keep a 21-day focus streak going.",
  },
  {
    id: "PRESENCE_7",
    label: "Presence",
    description: "Focus on all 7 days of a calendar week.",
  },
  {
    id: "BACK_AGAIN",
    label: "Back Again",
    description: "Return to focus after more than 5 days away.",
  },
];

const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;

export interface AchievementInput {
  sessionHistory: readonly SessionRecord[];
  dayStats: Readonly<Record<string, DayStats>>;
  unlockedIds: readonly string[];
  now: number;
}

/**
 * WP7-B2: returns the not-yet-unlocked achievements that the recorded
 * history qualifies for. Pure; the caller stores the results.
 */
export function evaluateAchievements(input: AchievementInput): AchievementRecord[] {
  const known = new Set(input.unlockedIds);
  const unlocked: AchievementRecord[] = [];
  const unlock = (id: string): void => {
    if (known.has(id)) return;
    known.add(id);
    unlocked.push({ id, unlockedAt: input.now });
  };

  const completed = input.sessionHistory.filter(
    (record) => record.status === "completed",
  );
  const cleanSessions = completed.filter(
    (record) => record.blockedAttempts === 0,
  );

  if (cleanSessions.length > 0) unlock("IRON_SESSION");
  if (cleanSessions.length >= 10) unlock("RESISTANCE_10");

  for (const day of Object.values(input.dayStats)) {
    if (day.focusMs >= 60 * MINUTE_MS && day.blocks === 0) {
      unlock("QUIET_WIN");
      break;
    }
  }

  const focusDays = Object.values(input.dayStats)
    .filter((day) => day.sessionsCompleted > 0)
    .map((day) => day.dateKey)
    .sort();

  if (currentStreakLength(focusDays, localDateKeyOf(input.now)) >= 21) {
    unlock("THREE_WEEKS");
  }
  if (hasFullyFocusedWeek(focusDays)) unlock("PRESENCE_7");
  if (hasReturnAfterGap(focusDays, 5)) unlock("BACK_AGAIN");

  return unlocked;
}

/** Consecutive focused local days ending today, or yesterday if today has none. */
export function currentStreakLength(
  sortedDateKeys: readonly string[],
  todayKey: string,
): number {
  if (sortedDateKeys.length === 0) return 0;
  const checked = new Set(sortedDateKeys);
  const today = dateKeyOrdinal(todayKey);
  const latest = dateKeyOrdinal(sortedDateKeys[sortedDateKeys.length - 1]!);
  if (latest < today - 1) return 0;
  let streak = 0;
  let cursor = Math.min(latest, today);
  while (checked.has(ordinalToKey(cursor))) {
    streak += 1;
    cursor -= 1;
  }
  return streak;
}

function hasFullyFocusedWeek(sortedDateKeys: readonly string[]): boolean {
  const weeks = new Set<string>();
  const focused = new Set(sortedDateKeys);
  for (const dateKey of sortedDateKeys) {
    const ordinal = dateKeyOrdinal(dateKey);
    // Monday-based week index: shift Sunday (0) to the end of the prior week.
    const weekday = (new Date(ordinal * DAY_MS).getUTCDay() + 6) % 7;
    const weekStart = ordinal - weekday;
    weeks.add(String(weekStart));
  }
  for (const weekStart of weeks) {
    const start = Number(weekStart);
    let allFocused = true;
    for (let offset = 0; offset < 7; offset += 1) {
      if (!focused.has(ordinalToKey(start + offset))) {
        allFocused = false;
        break;
      }
    }
    if (allFocused) return true;
  }
  return false;
}

function hasReturnAfterGap(
  sortedDateKeys: readonly string[],
  gapDays: number,
): boolean {
  for (let index = 1; index < sortedDateKeys.length; index += 1) {
    const previous = dateKeyOrdinal(sortedDateKeys[index - 1]!);
    const current = dateKeyOrdinal(sortedDateKeys[index]!);
    if (current - previous > gapDays) return true;
  }
  return false;
}

function localDateKeyOf(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

function dateKeyOrdinal(dateKey: string): number {
  const [year, month, day] = dateKey.split("-").map(Number);
  return Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1) / DAY_MS;
}

function ordinalToKey(ordinal: number): string {
  return new Date(ordinal * DAY_MS).toISOString().slice(0, 10);
}
