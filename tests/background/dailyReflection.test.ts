import { describe, expect, it } from "vitest";
import { createDailyReflectionService } from "../../src/background/dailyReflection.ts";
import { createDefaultState } from "../../src/shared/defaults.ts";
import { localDateKey } from "../../src/shared/time.ts";
import type { AppState } from "../../src/shared/types.ts";

const NOW = Date.UTC(2026, 9, 31, 12);
const TODAY = "2026-10-31";

function createHarness(initial: AppState) {
  const notices: string[] = [];
  const service = createDailyReflectionService({
    store: { readState: async () => structuredClone(initial) },
    notify: async (notice) => {
      notices.push(notice.kind);
    },
    now: () => NOW,
  });
  return { service, notices };
}

describe("daily reflection service", () => {
  it("reminds at midnight when the setting is on and the day is unreflected", async () => {
    const state = createDefaultState();
    state.settings.notifications.endOfDay = true;
    const harness = createHarness(state);
    await harness.service.notifyEndOfDay(NOW);
    expect(harness.notices).toEqual(["end_of_day_reflection"]);
  });

  it("stays silent when the setting is off", async () => {
    const harness = createHarness(createDefaultState());
    await harness.service.notifyEndOfDay(NOW);
    expect(harness.notices).toEqual([]);
  });

  it("stays silent once the day has a mood", async () => {
    const state = createDefaultState();
    state.settings.notifications.endOfDay = true;
    state.dayStats[TODAY] = {
      dateKey: localDateKey(new Date(NOW)),
      focusMs: 0,
      sessionsCompleted: 0,
      sessionsAbandoned: 0,
      blocks: 0,
      blocksByDomain: {},
      tasksCompleted: 0,
      mood: 4,
    };
    const harness = createHarness(state);
    await harness.service.notifyEndOfDay(NOW);
    expect(harness.notices).toEqual([]);
  });

  it("stays silent once the day has a note", async () => {
    const state = createDefaultState();
    state.settings.notifications.endOfDay = true;
    state.dayStats[TODAY] = {
      dateKey: localDateKey(new Date(NOW)),
      focusMs: 0,
      sessionsCompleted: 0,
      sessionsAbandoned: 0,
      blocks: 0,
      blocksByDomain: {},
      tasksCompleted: 0,
      note: "Deep work all afternoon.",
    };
    const harness = createHarness(state);
    await harness.service.notifyEndOfDay(NOW);
    expect(harness.notices).toEqual([]);
  });
});
