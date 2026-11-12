import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createDefaultState } from "../../src/shared/defaults.ts";
import { DashboardStats } from "../../src/ui/dashboard/DashboardStats.tsx";
import { TodayWeekSection } from "../../src/ui/panel/views/profile/TodayWeekSection.tsx";
import type { AppState } from "../../src/shared/types.ts";

const NOW = new Date(2026, 10, 11, 12, 0);
const MINUTE = 60_000;

function withStoppedMinutes(): AppState {
  const state = createDefaultState();
  state.settings.dailyGoalMin = 60;
  state.dayStats["2026-11-11"] = {
    dateKey: "2026-11-11",
    focusMs: 50 * MINUTE,
    stoppedMs: 20 * MINUTE,
    sessionsCompleted: 1,
    sessionsAbandoned: 1,
    blocks: 0,
    blocksByDomain: {},
    tasksCompleted: 0,
  };
  return state;
}

describe("the Today row on the You tab", () => {
  const html = renderToStaticMarkup(<TodayWeekSection state={withStoppedMinutes()} now={NOW} />);

  it("still shows every focused minute, stopped ones included", () => {
    expect(html).toContain("50m");
  });

  it("works out the goal from the counted minutes only (30 of 60 is 50%)", () => {
    expect(html).toContain("50%");
    expect(html).not.toContain("83%");
  });

  it("says that 20 minutes were stopped early and are not counted", () => {
    expect(html).toContain("20 min stopped early, not counted toward your goal.");
  });
});

describe("the dashboard overview", () => {
  const html = renderToStaticMarkup(<DashboardStats state={withStoppedMinutes()} now={NOW} />);

  it("shows focused time as 50 min and the goal as 50% of 60 min", () => {
    expect(html).toContain("50 min");
    expect(html).toContain("50% of your 60 min goal");
  });

  it("says what was stopped early", () => {
    expect(html).toContain("20 min stopped early, not counted toward your goal.");
  });
});

describe("a day with nothing stopped", () => {
  it("shows no stopped-early line", () => {
    const state = withStoppedMinutes();
    state.dayStats["2026-11-11"] = { ...state.dayStats["2026-11-11"]!, stoppedMs: 0 };
    const html = renderToStaticMarkup(<TodayWeekSection state={state} now={NOW} />);
    expect(html).not.toContain("stopped early");
  });
});
