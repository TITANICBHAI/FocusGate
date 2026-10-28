import type { SessionState, StandaloneBlock } from "../shared/types.ts";

export const TICK_ALARM = "tick";
export const SESSION_PHASE_END_ALARM = "session_phase_end";
export const STANDALONE_END_ALARM = "standalone_end";

export interface AlarmSnapshot {
  name: string;
  scheduledTime: number;
}

export interface AlarmSchedule {
  when?: number;
  delayInMinutes?: number;
  periodInMinutes?: number;
}

export interface AlarmApi {
  get(name: string): Promise<AlarmSnapshot | undefined>;
  create(name: string, alarmInfo: AlarmSchedule): void | Promise<void>;
  clear(name: string): boolean | Promise<boolean>;
}

const ALARM_TIME_TOLERANCE_MS = 1_000;

/**
 * Ensures the session heartbeat and timed phase alarms without resetting an
 * already-correct schedule every time the MV3 worker wakes.
 */
export async function ensureAlarms(
  alarms: AlarmApi,
  session: SessionState,
  standalone: StandaloneBlock,
  now: number,
): Promise<void> {
  const tick = await alarms.get(TICK_ALARM);
  if (!tick) {
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
