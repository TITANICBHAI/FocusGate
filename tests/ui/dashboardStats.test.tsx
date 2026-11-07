import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DashboardStats } from "../../src/ui/dashboard/DashboardStats.tsx";
import { createDefaultState } from "../../src/shared/defaults.ts";

const NOW = new Date(2026, 10, 4, 12, 0);

function render(): string {
  const state = createDefaultState();
  state.settings.dailyGoalMin = 120;
  state.dayStats["2026-11-04"] = {
    dateKey: "2026-11-04",
    focusMs: 30 * 60_000,
    sessionsCompleted: 1,
    sessionsAbandoned: 0,
    blocks: 2,
    blocksByDomain: {},
    tasksCompleted: 0,
  };
  state.dayStats["2026-11-02"] = {
    dateKey: "2026-11-02",
    focusMs: 60 * 60_000,
    sessionsCompleted: 2,
    sessionsAbandoned: 0,
    blocks: 0,
    blocksByDomain: {},
    tasksCompleted: 0,
  };
  return renderToStaticMarkup(<DashboardStats state={state} now={NOW} />);
}

const count = (html: string, text: string): number => html.split(text).length - 1;

describe("dashboard overview", () => {
  const html = render();

  it("the hero shows today, and only today", () => {
    const hero = html.slice(html.indexOf("fg-hero"), html.indexOf("Statistics range"));
    expect(hero).toContain("30 min");
    expect(hero).toContain("Today");
    expect(hero).toContain("of your 120 min goal");
    expect(hero).not.toContain("1 h 30 min");
    expect(hero).not.toContain("This week");
  });

  it("puts the weekly figure in the chart caption", () => {
    expect(html).toContain("This week: 1 h 30 min");
  });

  it("shows completion rate once and total focus time once", () => {
    expect(count(html, "Completion rate")).toBe(1);
    expect(count(html, "Total focus time")).toBe(1);
  });

  it("explains the focus score with its formula", () => {
    expect(html).toContain("Focus score");
    expect(html).toContain("60 points for your daily goal");
    expect(html).toContain("30 for tasks done");
    expect(html).toContain("10 for a streak");
  });

  it("renames protection gaps and explains them in one line", () => {
    expect(html).not.toContain("Protection gaps");
    expect(html).toContain("Times protection was off");
    expect(html).toContain("FocusGate was not running during a focus session");
  });

  it("has a right rail with the week strip, limits and protection", () => {
    const rail = html.slice(html.indexOf("fg-overview__rail"));
    expect(rail).toContain("Your week at a glance");
    expect(rail).toContain("Allowance usage today");
    expect(rail).toContain("Times protection was off");
  });
});
