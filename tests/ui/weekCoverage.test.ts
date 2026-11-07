import { describe, expect, it } from "vitest";
import { weekCoverage } from "../../src/ui/lib/weekCoverage.ts";
import type { Schedule } from "../../src/shared/types.ts";

function schedule(overrides: Partial<Schedule>): Schedule {
  return {
    id: "s",
    name: "S",
    enabled: true,
    days: [1, 2, 3, 4, 5],
    start: "09:00",
    end: "12:00",
    sites: [],
    keywords: [],
    useGlobalLists: true,
    ...overrides,
  };
}

describe("weekCoverage", () => {
  it("covers Monday to Friday for a weekday schedule", () => {
    const week = weekCoverage([schedule({})]);
    expect(week).toHaveLength(7);
    for (const day of [1, 2, 3, 4, 5]) {
      expect(week[day]).toEqual([{ startMin: 540, endMin: 720 }]);
    }
    expect(week[0]).toEqual([]);
    expect(week[6]).toEqual([]);
  });

  it("splits an overnight schedule across midnight on every day", () => {
    const week = weekCoverage([
      schedule({ days: [0, 1, 2, 3, 4, 5, 6], start: "22:00", end: "06:30" }),
    ]);
    for (let day = 0; day < 7; day += 1) {
      expect(week[day]).toEqual([
        { startMin: 0, endMin: 390 },
        { startMin: 1320, endMin: 1440 },
      ]);
    }
  });

  it("carries an overnight schedule into the following day only", () => {
    const week = weekCoverage([schedule({ days: [6], start: "22:00", end: "06:30" })]);
    expect(week[6]).toEqual([{ startMin: 1320, endMin: 1440 }]);
    expect(week[0]).toEqual([{ startMin: 0, endMin: 390 }]);
    expect(week[1]).toEqual([]);
  });

  it("reads 24:00 as the end of the day", () => {
    const week = weekCoverage([schedule({ days: [1], start: "18:00", end: "24:00" })]);
    expect(week[1]).toEqual([{ startMin: 1080, endMin: 1440 }]);
  });

  it("merges overlapping and touching spans", () => {
    const week = weekCoverage([
      schedule({ id: "a", days: [1], start: "09:00", end: "12:00" }),
      schedule({ id: "b", days: [1], start: "11:00", end: "14:00" }),
      schedule({ id: "c", days: [1], start: "14:00", end: "15:00" }),
    ]);
    expect(week[1]).toEqual([{ startMin: 540, endMin: 900 }]);
  });

  it("ignores disabled, empty-window and unreadable schedules", () => {
    const week = weekCoverage([
      schedule({ id: "off", enabled: false }),
      schedule({ id: "same", start: "09:00", end: "09:00" }),
      schedule({ id: "bad", start: "nine", end: "12:00" }),
    ]);
    expect(week.every((day) => day.length === 0)).toBe(true);
  });
});
