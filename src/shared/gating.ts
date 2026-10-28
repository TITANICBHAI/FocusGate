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

type GuardActionClass = "strengthen" | "weaken" | "end" | "password" | "wipe" | "task";

const ACTION_CLASS: Record<GuardAction, GuardActionClass> = {
  add_site: "strengthen",
  add_always_site: "strengthen",
  add_keyword: "strengthen",
  add_schedule: "strengthen",
  turn_filter_on: "strengthen",
  extend_session: "strengthen",
  add_standalone_site: "strengthen",
  extend_standalone: "strengthen",
  add_cap_limit: "strengthen",
  lower_limit: "strengthen",
  remove_exception: "strengthen",
  skip_break: "strengthen",
  import_backup: "strengthen",
  change_theme: "strengthen",
  change_notifications: "strengthen",
  manage_presets: "strengthen",
  edit_unlinked_task: "strengthen",

  remove_site: "weaken",
  remove_always_site: "weaken",
  remove_keyword: "weaken",
  clear_keywords: "weaken",
  weaken_keyword: "weaken",
  remove_schedule_site: "weaken",
  shorten_schedule: "weaken",
  disable_schedule: "weaken",
  delete_schedule: "weaken",
  add_exception: "weaken",
  remove_allowance: "weaken",
  raise_limit: "weaken",
  turn_during_blocks_on: "weaken",
  add_exempt_allowance: "weaken",
  turn_filter_off: "weaken",

  stop_session: "end",
  change_password: "password",
  remove_password: "password",
  reset_data: "wipe",
  delete_linked_task: "task",
};

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

  switch (ACTION_CLASS[action]) {
    case "strengthen":
      return { result: "allow" };
    case "weaken":
      if (source) return locked(source);
      return state.hasPassword ? { result: "password" } : { result: "allow" };
    case "end":
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
    case "password":
      if (source) return locked(source);
      return state.hasPassword ? { result: "password" } : { result: "allow" };
    case "wipe":
      if (source) return locked(source);
      return state.hasPassword
        ? { result: "password" }
        : { result: "confirm" };
    case "task": {
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
    default:
      return assertNever(ACTION_CLASS[action]);
  }
}

export function isGuardLocked(state: GuardState): boolean {
  return lockSource(state) !== null;
}

function assertNever(value: never): never {
  throw new Error(`Unhandled guard action class: ${String(value)}`);
}
