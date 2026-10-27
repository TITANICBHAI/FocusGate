import type { Schedule } from "./types.ts";

const DAY_MS = 24 * 60 * 60 * 1000;

export function parseHHMM(value: string): number {
  if (value === "24:00") return 1440;
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) throw new RangeError(`Invalid time: ${value}`);
  return Number(match[1]) * 60 + Number(match[2]);
}

export function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function isScheduleActiveAt(schedule: Schedule, now: Date): boolean {
  if (!schedule.enabled) return false;

  const start = parseHHMM(schedule.start);
  const end = parseHHMM(schedule.end);
  if (start === end) return false;

  const current = now.getHours() * 60 + now.getMinutes();
  const today = now.getDay();
  const yesterday = (today + 6) % 7;

  if (end > start) {
    return schedule.days.includes(today) && current >= start && current < end;
  }

  return (
    (schedule.days.includes(today) && current >= start) ||
    (schedule.days.includes(yesterday) && current < end)
  );
}

export function nextScheduleBoundary(
  schedules: Schedule[],
  now: Date,
): number | null {
  let next: number | null = null;
  for (const schedule of schedules) {
    if (!schedule.enabled) continue;
    const boundaries = [parseHHMM(schedule.start), parseHHMM(schedule.end)];
    for (let offset = 0; offset <= 8; offset += 1) {
      for (const minutes of boundaries) {
        const at = new Date(now);
        at.setHours(0, 0, 0, 0);
        at.setDate(at.getDate() + offset);
        at.setMinutes(minutes);
        const timestamp = at.getTime();
        if (timestamp > now.getTime() && (next === null || timestamp < next)) {
          next = timestamp;
        }
      }
    }
  }
  return next;
}

export function startOfNextLocalDay(timestamp: number): number {
  const next = new Date(timestamp);
  next.setHours(0, 0, 0, 0);
  next.setDate(next.getDate() + 1);
  return next.getTime();
}

export function addLocalDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function localDayDistance(from: Date, to: Date): number {
  const start = new Date(from);
  const end = new Date(to);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  return Math.round((end.getTime() - start.getTime()) / DAY_MS);
}
