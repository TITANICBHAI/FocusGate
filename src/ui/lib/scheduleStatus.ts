import { isScheduleActiveAt } from "../../shared/time.ts";
import type { Schedule } from "../../shared/types.ts";

export function activeScheduleAt(
  schedules: readonly Schedule[],
  nowMs: number,
): Schedule | null {
  const now = new Date(nowMs);
  return schedules.find((schedule) => isScheduleActiveAt(schedule, now)) ?? null;
}
