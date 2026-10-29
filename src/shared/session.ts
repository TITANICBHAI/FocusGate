import type {
  DayStats,
  LockLevel,
  SessionRecord,
  SessionState,
  Settings,
} from "./types.ts";

export const MAX_COMMITMENT_MS = 4 * 60 * 60 * 1000;
export const HEARTBEAT_GAP_THRESHOLD_MS = 3 * 60 * 1000;
export const SESSION_HISTORY_LIMIT = 500;
export const MAX_RECOVERY_TRANSITIONS = 10;

export interface StartSessionInput {
  now: number;
  durationMs: number;
  lockLevel: LockLevel;
  taskId: string | null;
  sessionId: string;
}

export interface SessionTransition {
  session: SessionState;
  record?: SessionRecord;
  completedTaskId?: string;
}

export interface RecoveryResult {
  session: SessionState;
  records: SessionRecord[];
  completedTaskIds: string[];
  transitions: number;
}

export function createSession(input: StartSessionInput): SessionState {
  return {
    status: "work",
    sessionId: input.sessionId,
    phaseStartedAt: input.now,
    phaseEndsAt: input.now + input.durationMs,
    phasePlannedMs: input.durationMs,
    plannedWorkMs: input.durationMs,
    extendedMs: 0,
    cycle: 1,
    lockLevel: input.lockLevel,
    taskId: input.taskId,
    blockedAttempts: 0,
    lastHeartbeatAt: input.now,
    gaps: [],
    stopChallengeStartedAt: null,
  clockSkewDetected: false,
  };
}

export function remainingSeconds(session: SessionState, now: number): number {
  if (session.status === "idle") return 0;
  return Math.ceil(Math.max(0, session.phaseEndsAt - now) / 1000);
}

export function endSession(session: SessionState, now: number): SessionTransition {
  if (session.status === "idle") return { session };

  const record =
    session.status === "work"
      ? createWorkRecord(session, Math.min(now, session.phaseEndsAt), "abandoned")
      : undefined;

  return {
    session: idleSession(now),
    ...(record ? { record } : {}),
  };
}

export function advanceSession(
  session: SessionState,
  now: number,
  settings: Settings,
): SessionTransition {
  if (session.status === "idle") return { session };

  if (session.status === "work") {
    const record = createWorkRecord(session, session.phaseEndsAt, "completed");
    const completedTaskId =
      record.status === "completed" ? session.taskId ?? undefined : undefined;
    const breaks = settings.breaks;
    if (!breaks.enabled) {
      return {
        session: idleSession(now),
        record,
        ...(completedTaskId ? { completedTaskId } : {}),
      };
    }

    const cyclesBeforeLong = Math.max(1, Math.floor(breaks.cyclesBeforeLong) || 1);
    const isLongBreak = session.cycle % cyclesBeforeLong === 0;
    const breakMs =
      Math.max(
        1,
        isLongBreak ? breaks.longMin : breaks.shortMin,
      ) * 60_000;
    return {
      session: {
        ...session,
        status: isLongBreak ? "longBreak" : "shortBreak",
        phaseStartedAt: now,
        phaseEndsAt: now + breakMs,
        phasePlannedMs: breakMs,
        extendedMs: 0,
        taskId: null,
        lastHeartbeatAt: now,
        gaps: [],
        stopChallengeStartedAt: null,
        clockSkewDetected: false,
      },
      record,
      ...(completedTaskId ? { completedTaskId } : {}),
    };
  }

  if (settings.breaks.autoStartNext) {
    const nextWorkMs = Math.max(1, session.plannedWorkMs);
    return {
      session: {
        ...session,
        status: "work",
        phaseStartedAt: now,
        phaseEndsAt: now + nextWorkMs,
        phasePlannedMs: nextWorkMs,
        cycle: session.cycle + 1,
        extendedMs: 0,
        lastHeartbeatAt: now,
        gaps: [],
        stopChallengeStartedAt: null,
        clockSkewDetected: false,
      },
    };
  }

  return { session: idleSession(now) };
}

export function recoverSession(
  source: SessionState,
  now: number,
  settings: Settings,
  options: { updateHeartbeat?: boolean } = {},
): RecoveryResult {
  let session = structuredClone(source);
  const records: SessionRecord[] = [];
  const completedTaskIds: string[] = [];
  let transitions = 0;

  if (
    session.status !== "idle" &&
    !session.clockSkewDetected &&
    now < session.lastHeartbeatAt - 60_000
  ) {
    const rollbackMs = session.lastHeartbeatAt - now;
    session = {
      ...session,
      phaseEndsAt: session.phaseEndsAt + rollbackMs,
      lastHeartbeatAt: now,
      clockSkewDetected: true,
    };
  }

  while (
    session.status !== "idle" &&
    now >= session.phaseEndsAt &&
    transitions < MAX_RECOVERY_TRANSITIONS
  ) {
    session = appendMissedTimeGap(session, now, session.phaseEndsAt);
    const transition = advanceSession(session, session.phaseEndsAt, settings);
    if (transition.record) records.push(transition.record);
    if (transition.completedTaskId) completedTaskIds.push(transition.completedTaskId);
    transitions += 1;

    if (transition.record?.status === "interrupted") {
      session = idleSession(now);
      break;
    }

    session = transition.session;
  }

  if (session.status !== "idle") {
    session = appendMissedTimeGap(session, now, now);
    if (options.updateHeartbeat) session.lastHeartbeatAt = now;
  }

  return { session, records, completedTaskIds, transitions };
}

export function appendSessionRecords(
  history: SessionRecord[],
  records: SessionRecord[],
): SessionRecord[] {
  return [...history, ...records].slice(-SESSION_HISTORY_LIMIT);
}

export function addRecordToDayStats(
  dayStats: Record<string, DayStats>,
  record: SessionRecord,
): Record<string, DayStats> {
  const dateKey = localDateKey(record.startedAt);
  const current = dayStats[dateKey] ?? {
    dateKey,
    focusMs: 0,
    sessionsCompleted: 0,
    sessionsAbandoned: 0,
    blocks: 0,
    blocksByDomain: {},
    tasksCompleted: 0,
  };
  const focusMs =
    record.status === "interrupted"
      ? 0
      : Math.max(0, record.elapsedMs - coveredGapMs(record));
  return {
    ...dayStats,
    [dateKey]: {
      ...current,
      focusMs: current.focusMs + focusMs,
      sessionsCompleted:
        current.sessionsCompleted + (record.status === "completed" ? 1 : 0),
      sessionsAbandoned:
        current.sessionsAbandoned + (record.status === "abandoned" ? 1 : 0),
    },
  };
}

function createWorkRecord(
  session: SessionState,
  endedAt: number,
  requestedStatus: "completed" | "abandoned",
): SessionRecord {
  const safeEnd = Math.max(session.phaseStartedAt, endedAt);
  const elapsedMs = safeEnd - session.phaseStartedAt;
  const baseRecord: SessionRecord = {
    id: `${session.sessionId}:${session.phaseStartedAt}`,
    startedAt: session.phaseStartedAt,
    endedAt: safeEnd,
    plannedMs: session.phasePlannedMs,
    extendedMs: Math.max(0, session.extendedMs),
    elapsedMs,
    status: requestedStatus,
    lockLevel: session.lockLevel,
    ...(session.taskId ? { taskId: session.taskId } : {}),
    blockedAttempts: session.blockedAttempts,
    gaps: session.gaps.filter(
      (gap) => gap.to > session.phaseStartedAt && gap.from < safeEnd,
    ),
    ...(session.clockSkewDetected ? { clockSkewDetected: true } : {}),
  };

  if (
    requestedStatus === "completed" &&
    coveredGapMs(baseRecord) > session.phasePlannedMs / 2
  ) {
    return { ...baseRecord, status: "interrupted" };
  }
  return baseRecord;
}

function appendMissedTimeGap(
  session: SessionState,
  now: number,
  until: number,
): SessionState {
  const lastHeartbeatAt = session.lastHeartbeatAt;
  if (
    lastHeartbeatAt <= 0 ||
    now - lastHeartbeatAt <= HEARTBEAT_GAP_THRESHOLD_MS
  ) {
    return session;
  }
  const from = Math.max(lastHeartbeatAt, session.phaseStartedAt);
  const to = Math.min(until, session.phaseEndsAt);
  if (to <= from) return session;

  const gaps = [...session.gaps, { from, to }].sort((a, b) => a.from - b.from);
  const merged: SessionState["gaps"] = [];
  for (const gap of gaps) {
    const previous = merged[merged.length - 1];
    if (previous && gap.from <= previous.to) {
      previous.to = Math.max(previous.to, gap.to);
    } else {
      merged.push({ ...gap });
    }
  }
  return { ...session, gaps: merged };
}

function coveredGapMs(record: SessionRecord): number {
  return record.gaps.reduce((total, gap) => {
    const from = Math.max(record.startedAt, gap.from);
    const to = Math.min(record.endedAt, gap.to);
    return total + Math.max(0, to - from);
  }, 0);
}

function idleSession(now: number): SessionState {
  return {
    status: "idle",
    sessionId: "",
    phaseStartedAt: 0,
    phaseEndsAt: 0,
    phasePlannedMs: 0,
    plannedWorkMs: 0,
    extendedMs: 0,
    cycle: 0,
    lockLevel: "none",
    taskId: null,
    blockedAttempts: 0,
    lastHeartbeatAt: now,
    gaps: [],
    stopChallengeStartedAt: null,
    clockSkewDetected: false,
  };
}

function localDateKey(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
