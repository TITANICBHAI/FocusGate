import { describe, expect, it } from "vitest";
import { createDefaultState } from "../../src/shared/defaults.ts";
import { guard, type GuardAction, type GuardState } from "../../src/shared/gating.ts";

type GuardActionClass =
  | "strengthen"
  | "weaken"
  | "end"
  | "password"
  | "wipe"
  | "task";

// Deliberately independent of gating.ts so a misclassified action fails this matrix.
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

type MatrixState = "idle" | "normal" | "strict" | "commitment" | "standalone";
const matrixStates: MatrixState[] = [
  "idle",
  "normal",
  "strict",
  "commitment",
  "standalone",
];

function stateFor(matrixState: MatrixState, hasPassword: boolean): GuardState {
  const defaults = createDefaultState();
  const state: GuardState = {
    session: defaults.session,
    standalone: defaults.standalone,
    hasPassword,
    now: 1_000,
  };
  if (matrixState === "normal" || matrixState === "standalone") {
    state.session = {
      ...defaults.session,
      status: "work",
      lockLevel: "none",
      taskId: "task-1",
      phaseEndsAt: 10_000,
    };
  } else if (matrixState === "strict" || matrixState === "commitment") {
    state.session = {
      ...defaults.session,
      status: "work",
      lockLevel: matrixState,
      taskId: "task-1",
      phaseEndsAt: 10_000,
    };
  }
  if (matrixState === "standalone") {
    state.standalone = {
      ...defaults.standalone,
      active: true,
      startsAt: 1_000,
      until: 10_000,
    };
  }
  return state;
}

function expectedResult(
  actionClass: GuardActionClass,
  matrixState: MatrixState,
  hasPassword: boolean,
): string {
  const isProtected =
    matrixState === "strict" ||
    matrixState === "commitment" ||
    matrixState === "standalone";
  switch (actionClass) {
    case "strengthen":
      return "allow";
    case "weaken":
      return isProtected ? "locked" : hasPassword ? "password" : "allow";
    case "end":
      if (matrixState === "idle" || matrixState === "commitment") return "locked";
      if (matrixState === "strict") return hasPassword ? "password" : "phrase";
      return "confirm";
    case "password":
      return isProtected ? "locked" : hasPassword ? "password" : "allow";
    case "wipe":
      return isProtected ? "locked" : hasPassword ? "password" : "confirm";
    case "task":
      return matrixState === "strict" || matrixState === "commitment"
        ? "locked"
        : "allow";
  }
}

describe("Appendix E.4 guard matrix", () => {
  it("covers every action × state × password-set combination", () => {
    const actions = Object.keys(ACTION_CLASS) as GuardAction[];
    expect(actions).toHaveLength(37);

    for (const action of actions) {
      for (const matrixState of matrixStates) {
        for (const hasPassword of [false, true]) {
          const label = `${action} / ${matrixState} / password=${hasPassword}`;
          const actual = guard(action, stateFor(matrixState, hasPassword));
          expect(actual.result, label).toBe(
            expectedResult(ACTION_CLASS[action], matrixState, hasPassword),
          );
          if (
            actual.result === "locked" &&
            (matrixState === "strict" ||
              matrixState === "commitment" ||
              matrixState === "standalone") &&
            action !== "stop_session"
          ) {
            expect(actual.reason, label).toContain("Locked until");
            expect(actual.until, label).toBe(10_000);
          }
        }
      }
    }
  });

  it("treats standalone start and expiry as boundaries, not active locks", () => {
    const future = stateFor("idle", false);
    future.standalone = {
      ...createDefaultState().standalone,
      active: true,
      startsAt: 2_000,
      until: 10_000,
    };
    expect(guard("remove_site", future).result).toBe("allow");

    const expired = stateFor("idle", false);
    expired.standalone = {
      ...createDefaultState().standalone,
      active: true,
      startsAt: 0,
      until: 1_000,
    };
    expect(guard("remove_site", expired).result).toBe("allow");
  });

  it("only locks task deletion when it is linked to a strict or commitment session", () => {
    const strict = stateFor("strict", false);
    expect(guard("delete_linked_task", { ...strict, taskId: "task-1" }).result).toBe(
      "locked",
    );
    expect(guard("delete_linked_task", { ...strict, taskId: "other" }).result).toBe(
      "allow",
    );
  });

  it("keeps the strict stop phrase and the normal stop confirmation precise", () => {
    expect(guard("stop_session", stateFor("strict", false))).toEqual({
      result: "phrase",
      phrase: "I GIVE UP",
      waitMs: 15_000,
    });
    expect(guard("stop_session", stateFor("normal", false))).toEqual({
      result: "confirm",
    });
  });
});
