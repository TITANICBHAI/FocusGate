import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { WeekBars, weekSummary } from "../../src/ui/components/WeekBars.tsx";

// Mon 2 Nov 2026 to Sun 8 Nov 2026
const points = [
  { dateKey: "2026-11-02", minutes: 0 },
  { dateKey: "2026-11-03", minutes: 45 },
  { dateKey: "2026-11-04", minutes: 20 },
  { dateKey: "2026-11-05", minutes: 0 },
  { dateKey: "2026-11-06", minutes: 10 },
  { dateKey: "2026-11-07", minutes: 15 },
  { dateKey: "2026-11-08", minutes: 30 },
];

describe("weekSummary", () => {
  it("states the total and the best day in words", () => {
    expect(weekSummary(points, "en-US")).toBe(
      "Focus minutes for the last 7 days: 120 minutes in total. Highest day: Tue with 45 minutes.",
    );
  });

  it("says so when there was no focus", () => {
    expect(weekSummary(points.map((p) => ({ ...p, minutes: 0 })), "en-US")).toBe(
      "Focus minutes for the last 7 days: none recorded.",
    );
  });
});

describe("WeekBars", () => {
  const html = renderToStaticMarkup(
    <WeekBars points={points} todayKey="2026-11-08" locale="en-US" />,
  );

  it("labels the whole chart with the summary", () => {
    expect(html).toContain(
      'aria-label="Focus minutes for the last 7 days: 120 minutes in total. Highest day: Tue with 45 minutes."',
    );
  });

  it("shows a weekday label under every bar", () => {
    for (const day of ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]) {
      expect(html).toContain(`>${day}<`);
    }
  });

  it("makes each bar focusable with its exact minutes", () => {
    expect(html.match(/tabindex="0"/g) ?? []).toHaveLength(7);
    expect(html).toContain('aria-label="Tue 3 Nov: 45 minutes"');
    expect(html).toContain('aria-label="Mon 2 Nov: no focus"');
    expect(html).toContain('aria-label="Sun 8 Nov, today: 30 minutes"');
  });

  it("prints a value only on the tallest bar and on today's bar", () => {
    const values = html.match(/class="fg-weekbars__value">([^<]+)</g) ?? [];
    expect(values).toHaveLength(2);
    expect(values.join("")).toContain(">45m<");
    expect(values.join("")).toContain(">30m<");
  });

  it("marks today's bar", () => {
    expect(html.match(/fg-weekbars__item--today/g) ?? []).toHaveLength(1);
  });

  it("keeps its list role, so the day items sit inside a list (axe: listitem)", () => {
    expect(html).toMatch(/^<ol /);
    expect(html).not.toMatch(/<ol [^>]*role=/);
    expect(html).toContain('aria-label="Focus minutes for the last 7 days');
  });
});
