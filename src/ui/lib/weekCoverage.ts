import { parseHHMM } from "../../shared/time.ts";
import type { Schedule } from "../../shared/types.ts";

/** Minutes after 00:00, with 0 <= startMin < endMin <= 1440. */
export interface Span {
  startMin: number;
  endMin: number;
}

function merge(spans: Span[]): Span[] {
  const sorted = [...spans].sort((a, b) => a.startMin - b.startMin);
  const merged: Span[] = [];
  for (const span of sorted) {
    const last = merged[merged.length - 1];
    if (last && span.startMin <= last.endMin) {
      last.endMin = Math.max(last.endMin, span.endMin);
    } else {
      merged.push({ ...span });
    }
  }
  return merged;
}

/**
 * The hours each weekday is covered by an enabled schedule.
 * Index 0 to 6 is Sunday to Saturday. An overnight window puts its first part
 * on the selected day and its second part on the day after.
 */
export function weekCoverage(schedules: readonly Schedule[]): Span[][] {
  const week: Span[][] = Array.from({ length: 7 }, () => []);
  for (const schedule of schedules) {
    if (!schedule.enabled) continue;
    let start: number;
    let end: number;
    try {
      start = parseHHMM(schedule.start);
      end = parseHHMM(schedule.end);
    } catch {
      continue;
    }
    if (start === end || start >= 1440) continue;
    for (const day of schedule.days) {
      if (!Number.isInteger(day) || day < 0 || day > 6) continue;
      if (end > start) {
        week[day]?.push({ startMin: start, endMin: end });
      } else {
        week[day]?.push({ startMin: start, endMin: 1440 });
        week[(day + 1) % 7]?.push({ startMin: 0, endMin: end });
      }
    }
  }
  return week.map(merge);
}

export function minutesToClock(minutes: number): string {
  const clamped = Math.max(0, Math.min(1440, minutes));
  if (clamped === 1440) return "24:00";
  return `${String(Math.floor(clamped / 60)).padStart(2, "0")}:${String(clamped % 60).padStart(2, "0")}`;
}
