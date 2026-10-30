const DAY_MS = 86_400_000;

/**
 * WP7-B6: consecutive daily check-ins ending today, or ending yesterday when
 * today has not been checked in yet (the day is not over).
 */
export function habitStreak(
  checkedDateKeys: readonly string[],
  todayKey: string,
): number {
  const checked = new Set(checkedDateKeys);
  if (checked.size === 0) return 0;
  const today = dateKeyOrdinal(todayKey);
  const latest = Math.max(...[...checked].map(dateKeyOrdinal));
  if (latest < today - 1) return 0;
  let streak = 0;
  let cursor = Math.min(latest, today);
  while (checked.has(ordinalToKey(cursor))) {
    streak += 1;
    cursor -= 1;
  }
  return streak;
}

function dateKeyOrdinal(dateKey: string): number {
  const [year, month, day] = dateKey.split("-").map(Number);
  return Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1) / DAY_MS;
}

function ordinalToKey(ordinal: number): string {
  return new Date(ordinal * DAY_MS).toISOString().slice(0, 10);
}
