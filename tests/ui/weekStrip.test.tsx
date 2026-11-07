import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { WeekStrip } from "../../src/ui/components/WeekStrip.tsx";
import type { Schedule } from "../../src/shared/types.ts";

const weekdays: Schedule = {
  id: "w",
  name: "Work hours",
  enabled: true,
  days: [1, 2, 3, 4, 5],
  start: "09:00",
  end: "12:00",
  sites: [],
  keywords: [],
  useGlobalLists: true,
};

describe("WeekStrip", () => {
  const tuesdayNoon = new Date(2026, 10, 3, 12, 0).getTime();
  const html = renderToStaticMarkup(
    <WeekStrip schedules={[weekdays]} now={tuesdayNoon} locale="en-US" />,
  );

  it("is one labelled group with a text alternative for every day", () => {
    expect(html).toContain('role="group" aria-label="Your week at a glance"');
    expect(html).toContain('aria-label="Monday: blocking 9:00 AM – 12:00 PM"');
    expect(html).toContain('aria-label="Saturday: not blocking"');
    expect(html).toContain('aria-label="Sunday: not blocking"');
  });

  it("lists Monday first and marks only today", () => {
    expect(html.indexOf("Monday")).toBeLessThan(html.indexOf("Sunday"));
    expect(html.match(/fg-strip__now/g)).toHaveLength(1);
  });

  it("shows the hour ticks", () => {
    expect(html).toContain("<span>12a</span><span>6a</span><span>12p</span><span>6p</span><span>12a</span>");
  });
});
