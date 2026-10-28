import { describe, expect, it } from "vitest";
import { createDefaultState } from "../../src/shared/defaults.ts";
import { weakeningLockReason } from "../../src/ui/lib/guardState.ts";

describe("weakening lock explanation", () => {
  it("shows a local-time reason for strict sessions and standalone blocks", () => {
    const state = createDefaultState();
    state.session = {
      ...state.session,
      status: "work",
      lockLevel: "strict",
      phaseEndsAt: 10_000,
    };
    expect(weakeningLockReason(state, 1_000)).toContain(
      "by your strict session.",
    );

    state.standalone = {
      ...state.standalone,
      active: true,
      startsAt: 0,
      until: 20_000,
    };
    expect(weakeningLockReason(state, 1_000)).toContain(
      "by your standalone block.",
    );
  });

  it("does not lock weakening controls for an unlocked or normal session", () => {
    const state = createDefaultState();
    expect(weakeningLockReason(state, 1_000)).toBeNull();
    state.session = {
      ...state.session,
      status: "work",
      lockLevel: "none",
      phaseEndsAt: 10_000,
    };
    state.password = {
      algo: "pbkdf2-sha256",
      iter: 600_000,
      salt: "test-salt",
      hash: "test-hash",
    };
    expect(weakeningLockReason(state, 1_000)).toBeNull();
  });
});
