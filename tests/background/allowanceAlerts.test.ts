import { describe, expect, it } from "vitest";
import { createAllowanceAlertService } from "../../src/background/allowanceAlerts.ts";
import { createDefaultState } from "../../src/shared/defaults.ts";
import type { AppState } from "../../src/shared/types.ts";

const NOW = Date.UTC(2026, 9, 31, 12);

function stateWithBudget(usedMin: number): AppState {
  const state = createDefaultState();
  state.allowances["example.com"] = {
    mode: "time_budget",
    limitMin: 60,
    duringBlocks: true,
  };
  state.usage["example.com"] = {
    dateKey: "2026-10-31",
    usedMs: usedMin * 60_000,
    opens: 1,
    windowStartMs: 0,
    lastActiveAt: NOW,
  };
  return state;
}

function createHarness(initial: AppState) {
  let state = structuredClone(initial);
  const writes: Partial<AppState>[] = [];
  const notices: string[] = [];
  const service = createAllowanceAlertService({
    store: {
      readState: async () => structuredClone(state),
      writeState: async (patch) => {
        writes.push(structuredClone(patch));
        state = { ...state, ...patch };
      },
    },
    notify: async (notice) => {
      notices.push(
        notice.kind === "allowance_heads_up"
          ? `heads-up:${notice.domain}:${notice.minutesLeft}`
          : notice.kind === "allowance_exhausted"
            ? `exhausted:${notice.domain}`
            : notice.kind,
      );
    },
    now: () => NOW,
  });
  return { service, state: () => state, writes, notices };
}

describe("allowance alert service", () => {
  it("fires the heads-up once and stores the flag before notifying", async () => {
    const harness = createHarness(stateWithBudget(56));
    await harness.service.evaluate();

    expect(harness.writes).toHaveLength(1);
    expect(harness.notices).toEqual(["heads-up:example.com:4"]);
    expect(harness.state().usage["example.com"]?.headsUpNotifiedAt).toBe(NOW);

    await harness.service.evaluate();
    expect(harness.writes).toHaveLength(1);
    expect(harness.notices).toHaveLength(1);
  });

  it("fires the exhaustion alert once the budget is spent", async () => {
    const harness = createHarness(stateWithBudget(60));
    await harness.service.evaluate();

    expect(harness.notices).toEqual(["exhausted:example.com"]);
    expect(harness.state().usage["example.com"]?.exhaustedNotifiedAt).toBe(NOW);

    await harness.service.evaluate();
    expect(harness.notices).toHaveLength(1);
  });

  it("respects the allowance-alerts toggle", async () => {
    const state = stateWithBudget(56);
    state.settings.notifications.allowanceAlerts = false;
    const harness = createHarness(state);
    await harness.service.evaluate();
    expect(harness.writes).toEqual([]);
    expect(harness.notices).toEqual([]);
  });

  it("stays quiet while the budget is above the threshold", async () => {
    const harness = createHarness(stateWithBudget(30));
    await harness.service.evaluate();
    expect(harness.writes).toEqual([]);
    expect(harness.notices).toEqual([]);
  });
});
