import type { SessionState, StandaloneBlock } from "../shared/types.ts";
import { startOfNextLocalDay } from "../shared/time.ts";

export const TICK_ALARM = "tick";
export const SESSION_PHASE_END_ALARM = "session_phase_end";
export const STANDALONE_END_ALARM = "standalone_end";
export const BOUNDARY_ALARM = "boundary";
export const WEEKLY_REPORT_ALARM = "weekly_report";
export const MIDNIGHT_ALARM = "midnight";

export interface AlarmSnapshot {
  name: string;
  scheduledTime: number;
  periodInMinutes?: number;
}

export interface AlarmSchedule {
  when?: number;
  delayInMinutes?: number;
  periodInMinutes?: number;
}

export interface AlarmTargets {
  nextBoundaryAt?: number | null;
  weeklyReportAt?: number | null;
  midnightAt?: number | null;
}

export interface AlarmApi {
  get(name: string): Promise<AlarmSnapshot | undefined>;
  create(name: string, alarmInfo: AlarmSchedule): void | Promise<void>;
  clear(name: string): boolean | Promise<boolean>;
}

const ALARM_TIME_TOLERANCE_MS = 1_000;

/**
 * Ensures the heartbeat, blocking boundary, daily rollover, weekly report, and
 * timed phase alarms without resetting an already-correct schedule on wake.
 */
export async function ensureAlarms(
  alarms: AlarmApi,
  session: SessionState,
  standalone: StandaloneBlock,
  now: number,
  targets: AlarmTargets = {},
): Promise<void> {
  const tick = await alarms.get(TICK_ALARM);
  if (tick?.periodInMinutes !== 1) {
    if (tick) await alarms.clear(TICK_ALARM);
    await alarms.create(TICK_ALARM, {
      delayInMinutes: 1,
      periodInMinutes: 1,
    });
  }

  await ensureOneShot(
    alarms,
    SESSION_PHASE_END_ALARM,
    session.status === "idle" ? null : session.phaseEndsAt,
    now,
  );

  await ensureOneShot(
    alarms,
    STANDALONE_END_ALARM,
    standalone.active && standalone.until > now ? standalone.until : null,
    now,
  );

  await ensureOneShot(
    alarms,
    BOUNDARY_ALARM,
    targets.nextBoundaryAt ?? null,
    now,
  );
  await ensureOneShot(
    alarms,
    WEEKLY_REPORT_ALARM,
    targets.weeklyReportAt === undefined
      ? nextWeeklyReportAt(now)
      : targets.weeklyReportAt,
    now,
  );
  await ensureOneShot(
    alarms,
    MIDNIGHT_ALARM,
    targets.midnightAt === undefined
      ? startOfNextLocalDay(now)
      : targets.midnightAt,
    now,
  );
}

export function nextWeeklyReportAt(now: number): number {
  const target = new Date(now);
  target.setHours(9, 0, 0, 0);
  const daysUntilMonday = (8 - target.getDay()) % 7;
  target.setDate(target.getDate() + daysUntilMonday);
  if (target.getTime() <= now) target.setDate(target.getDate() + 7);
  return target.getTime();
}

async function ensureOneShot(
  alarms: AlarmApi,
  name: string,
  targetAt: number | null,
  now: number,
): Promise<void> {
  const current = await alarms.get(name);
  if (targetAt === null) {
    if (current) await alarms.clear(name);
    return;
  }

  const when = Math.max(targetAt, now + ALARM_TIME_TOLERANCE_MS);
  if (
    current &&
    Math.abs(current.scheduledTime - when) <= ALARM_TIME_TOLERANCE_MS
  ) {
    return;
  }

  if (current) await alarms.clear(name);
  await alarms.create(name, { when });
}
