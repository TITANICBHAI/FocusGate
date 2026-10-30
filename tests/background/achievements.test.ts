import { describe, expect, it } from "vitest";
import { createAchievementsService } from "../../src/background/achievements.ts";
import { createDefaultState } from "../../src/shared/defaults.ts";
import type { AppState, SessionRecord } from "../../src/shared/types.ts";

const NOW = Date.UTC(2026, 9, 31, 12);

function stateWithHistory(history: SessionRecord[]): AppState {
  const state = createDefaultState();
  state.sessionHistory = history;
  return state;
}

function cleanSession(id: string): SessionRecord {
  return {
    id,
    startedAt: 0,
    endedAt: 0,
    plannedMs: 0,
    elapsedMs: 0,
    status: "completed",
    lockLevel: "none",
    blockedAttempts: 0,
    gaps: [],
  };
}

function createHarness(initial: AppState) {
  let state = structuredClone(initial);
  const writes: Partial<AppState>[] = [];
  const notices: string[] = [];
  const service = createAchievementsService({
    store: {
      readState: async () => structuredClone(state),
      writeState: async (patch) => {
        writes.push(structuredClone(patch));
        state = { ...state, ...patch };
      },
    },
    notify: async (notice) => {
      notices.push(notice.kind === "achievement_unlocked" ? notice.label : notice.kind);
    },
    now: () => NOW,
  });
  return { service, state: () => state, writes, notices };
}

describe("achievements service", () => {
  it("stores and announces the first clean session", async () => {
    const harness = createHarness(stateWithHistory([cleanSession("s1")]));
    await harness.service.evaluate(NOW);

    expect(harness.writes).toHaveLength(1);
    expect(harness.writes[0]?.achievements).toEqual([
      { id: "IRON_SESSION", unlockedAt: NOW },
    ]);
    expect(harness.notices).toEqual(["Iron Session"]);
  });

  it("stays silent when nothing new qualifies", async () => {
    const state = stateWithHistory([cleanSession("s1")]);
    state.achievements = [{ id: "IRON_SESSION", unlockedAt: 1 }];
    const harness = createHarness(state);
    await harness.service.evaluate(NOW);
    expect(harness.writes).toEqual([]);
    expect(harness.notices).toEqual([]);
  });

  it("respects the achievements notification toggle", async () => {
    const state = stateWithHistory([cleanSession("s1")]);
    state.settings.notifications.achievements = false;
    const harness = createHarness(state);
    await harness.service.evaluate(NOW);

    expect(harness.writes).toHaveLength(1);
    expect(harness.notices).toEqual([]);
  });
});
