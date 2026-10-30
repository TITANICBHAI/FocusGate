import { guard } from "../shared/gating.ts";
import { sessionDebrief } from "../shared/debrief.ts";
import {
  addRecordToDayStats,
  advanceSession,
  appendSessionRecords,
  createSession,
  endSession,
  recoverSession,
} from "../shared/session.ts";
import { verifyPassword } from "../shared/password.ts";
import type {
  AppState,
  DayStats,
  PasswordState,
  SessionRecord,
  SessionState,
  Task,
} from "../shared/types.ts";
import type { SessionNotice } from "./notify.ts";

export const ALLOWED_EXTENSIONS_MINUTES = [10, 15, 20, 30, 45, 60] as const;
export const MAX_SESSION_DURATION_MIN = 999;
export const MAX_SESSION_PHASE_MS = 24 * 60 * 60 * 1_000;
export const STRICT_STOP_WAIT_MS = 15_000;
export const MAX_SESSION_HISTORY = 500;
export const MAX_LATE_NOTIFICATION_MS = 30 * 60 * 1_000;

export interface SessionStore {
  readState(): Promise<AppState>;
  writeState(patch: Partial<AppState>): Promise<void>;
}

export interface SessionServiceDependencies {
  store: SessionStore;
  now(): number;
  createSessionId(): string;
  ensureAlarms(state: AppState, now: number): Promise<void>;
  updateBadge(state: AppState, now: number): Promise<void>;
  notify(notice: SessionNotice): Promise<void>;
  reconcile(reason: string): Promise<void>;
  verifyPassword(
    input: string,
    record: PasswordState,
  ): ReturnType<typeof verifyPassword>;
  /** WP7-B2: optional achievement evaluator, run after recorded transitions. */
  achievements?: { evaluate(now: number): Promise<void> };
  onEffectError?(effect: string, error: unknown): void;
}

export type SessionActionResult =
  | { ok: true; session: SessionState }
  | {
      ok: false;
      code: string;
      message: string;
      waitMs?: number;
    };

export interface SessionService {
  getState(): Promise<AppState>;
  start(input: {
    durationMin: number;
    lockLevel: AppState["session"]["lockLevel"];
    taskId?: string;
  }): Promise<SessionActionResult>;
  stop(input?: {
    password?: string;
    phrase?: string;
  }): Promise<SessionActionResult>;
  extend(minutes: number): Promise<SessionActionResult>;
  skipBreak(): Promise<SessionActionResult>;
  recover(options?: {
    updateHeartbeat?: boolean;
    reconcile?: boolean;
  }): Promise<AppState>;
  handleAlarm(name: string): Promise<void>;
  toggleFromShortcut(): Promise<
    | { action: "started"; durationMin: number }
    | { action: "stopped" }
    | { action: "locked" }
  >;
}

/**
 * Creates a dormant v2 session service. The v1 worker must not register or call
 * it before the WP5 atomic cutover; all browser dependencies are injected so
 * the state machine can be verified without activating v2 storage consumers.
 */
export function createSessionService(
  dependencies: SessionServiceDependencies,
): SessionService {
  let operationQueue: Promise<void> = Promise.resolve();

  function exclusive<T>(operation: () => Promise<T>): Promise<T> {
    const result = operationQueue.then(operation, operation);
    operationQueue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  async function runEffect(
    name: string,
    operation: () => Promise<void>,
  ): Promise<void> {
    try {
      await operation();
    } catch (error) {
      dependencies.onEffectError?.(name, error);
    }
  }

  async function syncEffects(
    state: AppState,
    now: number,
    reason: string,
    shouldReconcile: boolean,
  ): Promise<void> {
    await Promise.all([
      runEffect("alarms", () => dependencies.ensureAlarms(state, now)),
      runEffect("badge", () => dependencies.updateBadge(state, now)),
      ...(shouldReconcile
        ? [
            runEffect("reconcile", () => dependencies.reconcile(reason)),
          ]
        : []),
    ]);
  }

  async function notifyIfEnabled(
    state: AppState,
    notice: SessionNotice,
  ): Promise<void> {
    if (
      (notice.kind === "session_completed" ||
        notice.kind === "session_interrupted" ||
        notice.kind === "session_extended") &&
      !state.settings.notifications.sessionEnd
    ) {
      return;
    }
    if (notice.kind === "break_ended" && !state.settings.notifications.breakEnd) {
      return;
    }
    await runEffect("notification", () => dependencies.notify(notice));
  }

  function patchForRecords(
    state: AppState,
    session: SessionState,
    records: SessionRecord[],
    completedTaskIds: string[],
    now: number,
  ): Partial<AppState> {
    const patch: Partial<AppState> = { session };
    if (records.length > 0) {
      let dayStats = records.reduce(
        (current, record) => addRecordToDayStats(current, record),
        state.dayStats,
      );
      patch.sessionHistory = appendSessionRecords(
        state.sessionHistory,
        records,
      ).slice(-MAX_SESSION_HISTORY);

      const completedAtByTask = new Map<string, number>();
      for (const record of records) {
        if (record.status === "completed" && record.taskId) {
          completedAtByTask.set(record.taskId, record.endedAt);
        }
      }

      const completedIds = new Set(completedTaskIds);
      let tasksChanged = false;
      const tasks = state.tasks.map((task) => {
        const completedAt = completedAtByTask.get(task.id);
        if (
          completedAt === undefined ||
          !completedIds.has(task.id) ||
          task.completed
        ) {
          return task;
        }
        tasksChanged = true;
        dayStats = incrementTasksCompleted(dayStats, completedAt);
        return { ...task, completed: true, completedAt };
      });

      if (tasksChanged) patch.tasks = tasks;
      patch.dayStats = dayStats;
    }
    if (state.session.status !== "idle" && session.status === "idle") {
      patch.session = { ...session, lastHeartbeatAt: now };
    }
    return patch;
  }

  async function commitSessionTransition(
    before: AppState,
    session: SessionState,
    records: SessionRecord[],
    completedTaskIds: string[],
    now: number,
    reason: string,
    extraPatch: Partial<AppState> = {},
  ): Promise<AppState> {
    const patch = {
      ...patchForRecords(before, session, records, completedTaskIds, now),
      ...extraPatch,
    };
    await dependencies.store.writeState(patch);
    const after = { ...before, ...patch };
    await syncEffects(after, now, reason, true);
    await notifyTransition(before, after, records, now);
    if (dependencies.achievements && records.length > 0) {
      await runEffect("achievements", () =>
        dependencies.achievements!.evaluate(now),
      );
    }
    return after;
  }

  async function notifyTransition(
    before: AppState,
    after: AppState,
    records: SessionRecord[],
    now: number,
  ): Promise<void> {
    const latest = records.at(-1);
    if (latest) {
      const lateBy = now - latest.endedAt;
      if (lateBy <= MAX_LATE_NOTIFICATION_MS) {
        if (latest.status === "completed") {
          await notifyIfEnabled(after, {
            kind: "session_completed",
            elapsedMs: latest.elapsedMs,
            debrief: sessionDebrief(latest),
          });
        } else if (latest.status === "interrupted") {
          await notifyIfEnabled(after, { kind: "session_interrupted" });
        }
      }
    }

    const wasBreak =
      before.session.status === "shortBreak" ||
      before.session.status === "longBreak";
    const isBreak =
      after.session.status === "shortBreak" ||
      after.session.status === "longBreak";
    if (wasBreak && !isBreak) {
      await notifyIfEnabled(after, { kind: "break_ended" });
    }
  }

  async function recoverLocked(options: {
    updateHeartbeat?: boolean;
    reconcile?: boolean;
    forceSync?: boolean;
  } = {}): Promise<AppState> {
    const now = dependencies.now();
    const before = await dependencies.store.readState();
    const recovered = recoverSession(
      before.session,
      now,
      before.settings,
      { updateHeartbeat: options.updateHeartbeat },
    );
    const patch = patchForRecords(
      before,
      recovered.session,
      recovered.records,
      recovered.completedTaskIds,
      now,
    );
    if (options.updateHeartbeat) {
      patch.health = { ...before.health, lastHeartbeatAt: now };
    }

    const sessionChanged =
      JSON.stringify(before.session) !== JSON.stringify(recovered.session);
    const shouldWrite =
      sessionChanged ||
      recovered.records.length > 0 ||
      options.updateHeartbeat === true;

    if (shouldWrite) await dependencies.store.writeState(patch);
    const after = shouldWrite ? { ...before, ...patch } : before;
    const transitioned = recovered.transitions > 0;
    if (shouldWrite || options.forceSync) {
      await syncEffects(
        after,
        now,
        "session-recovery",
        options.reconcile ?? transitioned,
      );
      if (recovered.records.length > 0 || sessionChanged) {
        await notifyTransition(before, after, recovered.records, now);
      }
    }
    return after;
  }

  async function startLocked(
    state: AppState,
    input: {
      durationMin: number;
      lockLevel: AppState["session"]["lockLevel"];
      taskId?: string;
    },
  ): Promise<SessionActionResult> {
    if (
      !Number.isInteger(input.durationMin) ||
      input.durationMin < 1 ||
      input.durationMin > MAX_SESSION_DURATION_MIN
    ) {
      return failure(
        "INVALID_DURATION",
        `Choose a session length from 1 to ${MAX_SESSION_DURATION_MIN} minutes.`,
      );
    }
    if (input.lockLevel === "commitment" && input.durationMin > 240) {
      return failure("COMMITMENT_TOO_LONG", "Use Block now for sessions over 4 hours.");
    }
    if (state.session.status !== "idle") {
      return failure("SESSION_RUNNING", "A focus session is already running.");
    }
    if (input.taskId) {
      const task = state.tasks.find((candidate) => candidate.id === input.taskId);
      if (!task || task.completed) {
        return failure("TASK_UNAVAILABLE", "That task is no longer available.");
      }
    }

    const now = dependencies.now();
    const session = createSession({
      now,
      durationMs: input.durationMin * 60_000,
      lockLevel: input.lockLevel,
      taskId: input.taskId ?? null,
      sessionId: dependencies.createSessionId(),
    });
    await dependencies.store.writeState({ session });
    const after = { ...state, session };
    await syncEffects(after, now, "session-start", true);
    return { ok: true, session };
  }

  async function stopLocked(input: {
    password?: string;
    phrase?: string;
  } = {}): Promise<SessionActionResult> {
    const state = await recoverLocked();
    const now = dependencies.now();
    const decision = guard("stop_session", {
      session: state.session,
      standalone: state.standalone,
      hasPassword: state.password !== null,
      now,
    });
    if (decision.result === "locked") {
      return failure("LOCKED", decision.reason);
    }

    let passwordUpgrade: PasswordState | undefined;
    if (decision.result === "password") {
      if (!input.password) {
        return failure("PASSWORD_REQUIRED", "Enter your password to stop Strict focus.");
      }
      const verification = await dependencies.verifyPassword(
        input.password,
        state.password,
      );
      if (!verification.valid) {
        return failure("BAD_PASSWORD", "That password is not correct.");
      }
      passwordUpgrade = verification.upgradedRecord;
    } else if (decision.result === "phrase") {
      if (input.phrase !== decision.phrase) {
        return failure(
          input.phrase ? "BAD_PHRASE" : "PHRASE_REQUIRED",
          `Type ${decision.phrase} to start the 15-second wait.`,
          decision.waitMs,
        );
      }
      const challengeStartedAt = state.session.stopChallengeStartedAt;
      if (challengeStartedAt === undefined || challengeStartedAt === null) {
        const challenged = {
          ...state.session,
          stopChallengeStartedAt: now,
        };
        await dependencies.store.writeState({ session: challenged });
        await syncEffects({ ...state, session: challenged }, now, "stop-challenge", false);
        return failure("WAIT_REQUIRED", "Wait 15 seconds, then confirm again.", decision.waitMs);
      }
      const remainingWait = Math.max(
        0,
        challengeStartedAt + decision.waitMs - now,
      );
      if (remainingWait > 0) {
        return failure(
          "WAIT_REQUIRED",
          "Wait before confirming that you want to stop.",
          remainingWait,
        );
      }
    }

    const transition = endSession(state.session, now);
    const extraPatch = passwordUpgrade ? { password: passwordUpgrade } : {};
    const after = await commitSessionTransition(
      state,
      transition.session,
      transition.record ? [transition.record] : [],
      [],
      now,
      "session-stop",
      extraPatch,
    );
    return { ok: true, session: after.session };
  }

  return {
    getState: () => dependencies.store.readState(),

    start: (input) =>
      exclusive(async () => {
        const state = await recoverLocked();
        return startLocked(state, input);
      }),

    stop: (input) =>
      exclusive(async () => stopLocked(input)),

    extend: (minutes) =>
      exclusive(async () => {
        const state = await recoverLocked();
        const decision = guard("extend_session", {
          session: state.session,
          standalone: state.standalone,
          hasPassword: state.password !== null,
          now: dependencies.now(),
        });
        if (decision.result !== "allow") {
          return failure(
            decision.result === "locked" ? "LOCKED" : "NOT_ALLOWED",
            decision.result === "locked"
              ? decision.reason
              : "This session cannot be extended.",
          );
        }
        if (
          !ALLOWED_EXTENSIONS_MINUTES.includes(
            minutes as (typeof ALLOWED_EXTENSIONS_MINUTES)[number],
          )
        ) {
          return failure("INVALID_EXTENSION", "Choose one of the available extension amounts.");
        }
        if (state.session.status !== "work") {
          return failure("NOT_WORK_PHASE", "Only a work phase can be extended.");
        }

        const extensionMs = minutes * 60_000;
        const currentPhaseMs =
          state.session.phaseEndsAt - state.session.phaseStartedAt;
        if (currentPhaseMs + extensionMs > MAX_SESSION_PHASE_MS) {
          return failure("SESSION_LIMIT", "A focus phase cannot exceed 24 hours.");
        }

        const now = dependencies.now();
        const session = {
          ...state.session,
          phaseEndsAt: state.session.phaseEndsAt + extensionMs,
          phasePlannedMs: state.session.phasePlannedMs + extensionMs,
          extendedMs: state.session.extendedMs + extensionMs,
          stopChallengeStartedAt: null,
        };
        await dependencies.store.writeState({ session });
        const after = { ...state, session };
        await syncEffects(after, now, "session-extend", true);
        await notifyIfEnabled(after, { kind: "session_extended", minutes });
        return { ok: true, session };
      }),

    skipBreak: () =>
      exclusive(async () => {
        const state = await recoverLocked();
        const decision = guard("skip_break", {
          session: state.session,
          standalone: state.standalone,
          hasPassword: state.password !== null,
          now: dependencies.now(),
        });
        if (decision.result !== "allow") {
          return failure(
            decision.result === "locked" ? "LOCKED" : "NOT_ALLOWED",
            decision.result === "locked"
              ? decision.reason
              : "This break cannot be skipped.",
          );
        }
        if (
          state.session.status !== "shortBreak" &&
          state.session.status !== "longBreak"
        ) {
          return failure("NOT_ON_BREAK", "There is no break to skip.");
        }

        const now = dependencies.now();
        const transition = advanceSession(
          state.session,
          now,
          state.settings,
        );
        const after = await commitSessionTransition(
          state,
          transition.session,
          transition.record ? [transition.record] : [],
          transition.completedTaskId ? [transition.completedTaskId] : [],
          now,
          "break-skip",
        );
        return { ok: true, session: after.session };
      }),

    recover: (options = {}) =>
      exclusive(() =>
        recoverLocked({
          updateHeartbeat: options.updateHeartbeat ?? true,
          reconcile: options.reconcile ?? true,
          forceSync: true,
        }),
      ),

    handleAlarm: (name) =>
      exclusive(async () => {
        if (
          name !== "tick" &&
          name !== "session_phase_end" &&
          name !== "standalone_end"
        ) {
          return;
        }
        await recoverLocked({
          updateHeartbeat: name === "tick",
          reconcile: name !== "tick",
          forceSync: true,
        });
      }),

    toggleFromShortcut: () =>
      exclusive(async () => {
        let state = await recoverLocked();
        const session = state.session;
        if (session.status === "idle") {
          const durationMin = state.settings.defaultDurationMin;
          const started = await startLocked(state, {
            durationMin,
            lockLevel: "none",
          });
          if (!started.ok) return { action: "locked" as const };
          await notifyIfEnabled(state, {
            kind: "focus_started",
            durationMin,
          });
          return { action: "started" as const, durationMin };
        }

        if (session.lockLevel !== "none") {
          await notifyIfEnabled(state, { kind: "session_locked" });
          return { action: "locked" as const };
        }

        state = await stopNormalSessionLocked(state);
        return { action: "stopped" as const };
      }),
  };

  async function stopNormalSessionLocked(state: AppState): Promise<AppState> {
    const now = dependencies.now();
    const transition = endSession(state.session, now);
    return commitSessionTransition(
      state,
      transition.session,
      transition.record ? [transition.record] : [],
      [],
      now,
      "shortcut-stop",
    );
  }
}

function incrementTasksCompleted(
  dayStats: Record<string, DayStats>,
  completedAt: number,
): Record<string, DayStats> {
  const dateKey = localDateKey(completedAt);
  const current = dayStats[dateKey] ?? {
    dateKey,
    focusMs: 0,
    sessionsCompleted: 0,
    sessionsAbandoned: 0,
    blocks: 0,
    blocksByDomain: {},
    tasksCompleted: 0,
  };
  return {
    ...dayStats,
    [dateKey]: { ...current, tasksCompleted: current.tasksCompleted + 1 },
  };
}

function localDateKey(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function failure(
  code: string,
  message: string,
  waitMs?: number,
): SessionActionResult {
  return {
    ok: false,
    code,
    message,
    ...(waitMs !== undefined ? { waitMs } : {}),
  };
}
