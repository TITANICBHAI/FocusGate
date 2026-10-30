import { describe, expect, it } from "vitest";
import { createPruningService } from "../../src/background/pruning.ts";
import { createDefaultState } from "../../src/shared/defaults.ts";
import type { AppState, SessionRecord } from "../../src/shared/types.ts";

const NOW = Date.UTC(2026, 9, 31, 12);

function stateWithOversizedData(): AppState {
  const state = createDefaultState();
  state.sessionHistory = Array.from({ length: 510 }, (_, index) => ({
    id: `session-${index}`,
    startedAt: index,
    endedAt: index,
    plannedMs: 0,
    elapsedMs: 0,
    status: "completed",
    lockLevel: "none",
    blockedAttempts: 0,
    gaps: [],
  }));
  state.recentBlocks = Array.from({ length: 205 }, (_, index) => ({
    domain: `domain-${index}.example`,
    reason: "legacy",
    at: index,
  }));
  for (let index = 1; index <= 405; index += 1) {
    const date = new Date(NOW - index * 86_400_000);
    const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    state.dayStats[dateKey] = {
      dateKey,
      focusMs: 0,
      sessionsCompleted: 0,
      sessionsAbandoned: 0,
      blocks: 0,
      blocksByDomain: {},
      tasksCompleted: 0,
    };
  }
  return state;
}

function session(id: number): SessionRecord {
  return {
    id: `session-${id}`,
    startedAt: id,
    endedAt: id,
    plannedMs: 0,
    elapsedMs: 0,
    status: "completed",
    lockLevel: "none",
    blockedAttempts: 0,
    gaps: [],
  };
}

describe("pruning service", () => {
  it("caps history, day statistics, and block records at midnight", async () => {
    const harness = createPruningHarness(stateWithOversizedData());
    await harness.service.prune();

    expect(harness.writes).toHaveLength(1);
    expect(harness.state().sessionHistory).toHaveLength(500);
    expect(harness.state().sessionHistory[0]?.id).toBe("session-10");
    expect(Object.keys(harness.state().dayStats)).toHaveLength(400);
    expect(harness.state().recentBlocks).toHaveLength(200);

    await harness.service.prune();
    expect(harness.writes).toHaveLength(1);
  });

  it("writes nothing when everything is already within the caps", async () => {
    const state = createDefaultState();
    state.sessionHistory = [session(1)];
    const harness = createPruningHarness(state);
    await harness.service.prune();
    expect(harness.writes).toEqual([]);
  });
});

function createPruningHarness(initial: AppState) {
  let state = structuredClone(initial);
  const writes: Partial<AppState>[] = [];
  const service = createPruningService({
    store: {
      readState: async () => structuredClone(state),
      writeState: async (patch) => {
        writes.push(structuredClone(patch));
        state = { ...state, ...patch };
      },
    },
    now: () => NOW,
  });
  return { service, state: () => state, writes };
}
