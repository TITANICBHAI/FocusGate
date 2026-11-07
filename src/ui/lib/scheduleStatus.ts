import { isScheduleActiveAt, parseHHMM } from "../../shared/time.ts";
import type { Schedule } from "../../shared/types.ts";

export type ScheduleStatus =
  | { kind: "active"; schedule: Schedule; endsAt: number }
  | { kind: "next"; schedule: Schedule; startsAt: number }
  | { kind: "none"; reason: "no-schedules" | "all-off" };

export function activeScheduleAt(
  schedules: readonly Schedule[],
  nowMs: number,
): Schedule | null {
  const now = new Date(nowMs);
  return schedules.find((schedule) => isScheduleActiveAt(schedule, now)) ?? null;
}

/** A schedule whose stored times cannot be read is ignored, never thrown on. */
function hasReadableTimes(schedule: Schedule): boolean {
  try {
    parseHHMM(schedule.start);
    parseHHMM(schedule.end);
    return true;
  } catch {
    return false;
  }
}

/** First local time after `after` whose minutes after midnight equal `minutes`. */
function boundaryAfter(after: number, minutes: number): number {
  for (let offset = 0; offset <= 2; offset += 1) {
    const candidate = new Date(after);
    candidate.setHours(0, 0, 0, 0);
    candidate.setDate(candidate.getDate() + offset);
    candidate.setMinutes(minutes);
    if (candidate.getTime() > after) return candidate.getTime();
  }
  return after;
}

function coveredUntil(schedules: readonly Schedule[], nowMs: number): number {
  let at = nowMs;
  for (let step = 0; step < 16; step += 1) {
    const running = schedules.filter((schedule) =>
      isScheduleActiveAt(schedule, new Date(at)),
    );
    if (running.length === 0) break;
    at = Math.min(
      ...running.map((schedule) => boundaryAfter(at, parseHHMM(schedule.end))),
    );
  }
  return at;
}

function canEverStart(schedule: Schedule): boolean {
  return (
    schedule.enabled &&
    schedule.days.length > 0 &&
    schedule.start !== "24:00" &&
    parseHHMM(schedule.start) !== parseHHMM(schedule.end)
  );
}

function nextStartOf(schedule: Schedule, nowMs: number): number | null {
  const minutes = parseHHMM(schedule.start);
  for (let offset = 0; offset <= 7; offset += 1) {
    const candidate = new Date(nowMs);
    candidate.setHours(0, 0, 0, 0);
    candidate.setDate(candidate.getDate() + offset);
    candidate.setMinutes(minutes);
    if (schedule.days.includes(candidate.getDay()) && candidate.getTime() > nowMs) {
      return candidate.getTime();
    }
  }
  return null;
}

/** What the schedules are doing at `nowMs`: on now, next to start, or nothing. */
export function scheduleStatus(
  schedules: readonly Schedule[],
  nowMs: number,
): ScheduleStatus {
  if (schedules.length === 0) return { kind: "none", reason: "no-schedules" };
  const readable = schedules.filter(hasReadableTimes);

  const nowDate = new Date(nowMs);
  const active = readable.find((schedule) => isScheduleActiveAt(schedule, nowDate));
  if (active) {
    return { kind: "active", schedule: active, endsAt: coveredUntil(readable, nowMs) };
  }

  let best: { schedule: Schedule; startsAt: number } | null = null;
  for (const schedule of readable) {
    if (!canEverStart(schedule)) continue;
    const startsAt = nextStartOf(schedule, nowMs);
    if (startsAt !== null && (best === null || startsAt < best.startsAt)) {
      best = { schedule, startsAt };
    }
  }
  if (best) return { kind: "next", ...best };
  return { kind: "none", reason: "all-off" };
}
