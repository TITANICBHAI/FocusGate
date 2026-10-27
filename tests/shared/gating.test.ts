import { describe, expect, it } from "vitest";
import { createDefaultState } from "../../src/shared/defaults.ts";
import { guard, type GuardAction, type GuardState } from "../../src/shared/gating.ts";

const base = (): GuardState => ({
  session: createDefaultState().session,
  standalone: createDefaultState().standalone,
  hasPassword: false,
  now: 1_000,
});

const strengthening: GuardAction[] = [
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
];

const weakening: GuardAction[] = [
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
];

describe("weakening-action guard", () => {
  it("allows every strengthening action in every lock state", () => {
    const states = [base(), base(), base(), base()];
    states[1]!.session = {
      ...createDefaultState().session,
      status: "work",
      lockLevel: "strict",
      phaseEndsAt: 50_000,
    };
    states[2]!.session = {
      ...createDefaultState().session,
      status: "work",
      lockLevel: "commitment",
      phaseEndsAt: 50_000,
    };
    states[3]!.standalone = {
      ...createDefaultState().standalone,
      active: true,
      startsAt: 0,
      until: 50_000,
    };
    for (const action of strengthening) {
      for (const state of states) expect(guard(action, state).result).toBe("allow");
    }
  });

  it("gates every weakening action by password when unlocked and locks it during protection", () => {
    const idleWithPassword = base();
    idleWithPassword.hasPassword = true;
    const strict = base();
    strict.session = {
      ...createDefaultState().session,
      status: "work",
      lockLevel: "strict",
      phaseEndsAt: 50_000,
    };
    const commitment = base();
    commitment.session = {
      ...createDefaultState().session,
      status: "work",
      lockLevel: "commitment",
      phaseEndsAt: 50_000,
    };
    const standalone = base();
    standalone.standalone = {
      ...createDefaultState().standalone,
      active: true,
      startsAt: 0,
      until: 50_000,
    };

    for (const action of weakening) {
      expect(guard(action, base()).result).toBe("allow");
      expect(guard(action, idleWithPassword).result).toBe("password");
      expect(guard(action, strict).result).toBe("locked");
      expect(guard(action, commitment).result).toBe("locked");
      expect(guard(action, standalone).result).toBe("locked");
    }
  });

  it("applies the stop, password, reset, and linked-task rows", () => {
    const normal = base();
    normal.session = {
      ...createDefaultState().session,
      status: "work",
      lockLevel: "none",
      phaseEndsAt: 50_000,
    };
    expect(guard("stop_session", normal).result).toBe("confirm");

    const strict = base();
    strict.session = {
      ...createDefaultState().session,
      status: "work",
      lockLevel: "strict",
      phaseEndsAt: 50_000,
    };
    expect(guard("stop_session", strict)).toEqual({
      result: "phrase",
      phrase: "I GIVE UP",
      waitMs: 15_000,
    });
    strict.hasPassword = true;
    expect(guard("stop_session", strict).result).toBe("password");

    const commitment = base();
    commitment.session = {
      ...createDefaultState().session,
      status: "work",
      lockLevel: "commitment",
      phaseEndsAt: 50_000,
    };
    expect(guard("stop_session", commitment).result).toBe("locked");
    expect(guard("delete_linked_task", commitment).result).toBe("allow");
    commitment.session.taskId = "task-1";
    expect(guard("delete_linked_task", commitment).result).toBe("locked");
    expect(guard("reset_data", base()).result).toBe("confirm");
    expect(guard("change_password", base()).result).toBe("allow");
    expect(guard("remove_password", base()).result).toBe("allow");
  });
});
