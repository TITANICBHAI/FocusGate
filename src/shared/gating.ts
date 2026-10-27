import type { LockLevel, SessionState, StandaloneBlock } from "./types.ts";

export type GuardResult =
  | { result: "allow" }
  | { result: "confirm" }
  | { result: "password" }
  | { result: "phrase"; phrase: "I GIVE UP"; waitMs: number }
  | { result: "locked"; reason: string; until?: number };

export type GuardAction =
  | "add_site"
  | "add_always_site"
  | "add_keyword"
  | "add_schedule"
  | "turn_filter_on"
  | "extend_session"
  | "add_standalone_site"
  | "extend_standalone"
  | "add_cap_limit"
  | "lower_limit"
  | "remove_site"
  | "remove_always_site"
  | "remove_keyword"
  | "clear_keywords"
  | "weaken_keyword"
  | "remove_schedule_site"
  | "shorten_schedule"
  | "disable_schedule"
  | "delete_schedule"
  | "add_exception"
  | "remove_exception"
  | "remove_allowance"
  | "raise_limit"
  | "turn_during_blocks_on"
  | "add_exempt_allowance"
  | "turn_filter_off"
  | "stop_session"
  | "skip_break"
  | "change_password"
  | "remove_password"
  | "reset_data"
  | "delete_linked_task"
  | "import_backup"
  | "change_theme"
  | "change_notifications"
  | "manage_presets"
  | "edit_unlinked_task";

export interface GuardState {
  session: SessionState;
  standalone: StandaloneBlock;
  hasPassword: boolean;
  now: number;
  taskId?: string;
}

interface LockSource {
  level: "standalone" | LockLevel;
  until: number;
}

const STRENGTHENING = new Set<GuardAction>([
  "add_site",
  "add_always_site",
  "add_keyword",
  "add_schedule",
  "turn_filter_on",
  "extend_session",
  "add_standalone_site",
  "extend_standalone",
  "add_cap_limit",
  "lower_limit",
  "remove_exception",
  "skip_break",
  "import_backup",
  "change_theme",
  "change_notifications",
  "manage_presets",
  "edit_unlinked_task",
]);

const WEAKENING = new Set<GuardAction>([
  "remove_site",
  "remove_always_site",
  "remove_keyword",
  "clear_keywords",
  "weaken_keyword",
  "remove_schedule_site",
  "shorten_schedule",
  "disable_schedule",
  "delete_schedule",
  "add_exception",
  "remove_allowance",
  "raise_limit",
  "turn_during_blocks_on",
  "add_exempt_allowance",
  "turn_filter_off",
]);

function lockSource(state: GuardState): LockSource | null {
  if (
    state.standalone.active &&
    state.standalone.startsAt <= state.now &&
    state.now < state.standalone.until
  ) {
    return { level: "standalone", until: state.standalone.until };
  }
  if (
    state.session.status === "work" &&
    (state.session.lockLevel === "strict" ||
      state.session.lockLevel === "commitment")
  ) {
    return {
      level: state.session.lockLevel,
      until: state.session.phaseEndsAt,
    };
  }
  return null;
}

function locked(source: LockSource): GuardResult {
  const name =
    source.level === "standalone" ? "standalone block" : `${source.level} session`;
  return {
    result: "locked",
    reason: `Locked until ${source.until} by your ${name}.`,
    until: source.until,
  };
}

export function guard(action: GuardAction, state: GuardState): GuardResult {
  const source = lockSource(state);

  if (action === "stop_session") {
    if (state.session.status === "idle") {
      return { result: "locked", reason: "There is no running session." };
    }
    if (state.session.lockLevel === "commitment") {
      return locked({ level: "commitment", until: state.session.phaseEndsAt });
    }
    if (state.session.lockLevel === "strict") {
      return state.hasPassword
        ? { result: "password" }
        : { result: "phrase", phrase: "I GIVE UP", waitMs: 15_000 };
    }
    return { result: "confirm" };
  }

  if (action === "change_password" || action === "remove_password") {
    if (source) return locked(source);
    return state.hasPassword ? { result: "password" } : { result: "allow" };
  }

  if (action === "reset_data") {
    if (source) return locked(source);
    return state.hasPassword
      ? { result: "password" }
      : { result: "confirm" };
  }

  if (action === "delete_linked_task") {
    const linked =
      state.session.status === "work" &&
      state.session.taskId !== null &&
      (state.taskId === undefined || state.taskId === state.session.taskId);
    if (
      linked &&
      (state.session.lockLevel === "strict" ||
        state.session.lockLevel === "commitment")
    ) {
      return locked({
        level: state.session.lockLevel,
        until: state.session.phaseEndsAt,
      });
    }
    return { result: "allow" };
  }

  if (STRENGTHENING.has(action)) return { result: "allow" };
  if (WEAKENING.has(action)) {
    if (source) return locked(source);
    return state.hasPassword ? { result: "password" } : { result: "allow" };
  }

  return { result: "allow" };
}

export function isGuardLocked(state: GuardState): boolean {
  return lockSource(state) !== null;
}
