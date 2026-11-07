import { describe, expect, it } from "vitest";
import {
  describeTargets,
  formatClock,
  formatRange,
  statusLine,
  summarizeDays,
} from "../../src/ui/lib/scheduleSummary.ts";
import type { Schedule } from "../../src/shared/types.ts";

const L = "en-US";

function schedule(overrides: Partial<Schedule> = {}): Schedule {
  return {
    id: "s1",
    name: "Study hours",
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

const sites = (n: number): string[] =>
  Array.from({ length: n }, (_, index) => `site${index}.com`);

describe("summarizeDays", () => {
  it("names the common groups", () => {
    expect(summarizeDays([0, 1, 2, 3, 4, 5, 6])).toBe("Every day");
    expect(summarizeDays([1, 2, 3, 4, 5])).toBe("Weekdays");
    expect(summarizeDays([6, 0])).toBe("Weekends");
  });

  it("lists other days Monday first", () => {
    expect(summarizeDays([5, 1, 3])).toBe("Mon, Wed, Fri");
    expect(summarizeDays([0, 1])).toBe("Mon, Sun");
  });

  it("says so when there are no days", () => {
    expect(summarizeDays([])).toBe("No days");
  });
});

describe("formatClock and formatRange", () => {
  it("formats 24-hour values in the locale with plain spaces", () => {
    expect(formatClock("09:00", L)).toBe("9:00 AM");
    expect(formatClock("24:00", L)).toBe("12:00 AM");
    expect(formatClock("17:30", L)).toBe("5:30 PM");
  });

  it("formats ranges and marks windows that end the next day", () => {
    expect(formatRange("09:00", "12:00", L)).toBe("9:00 AM – 12:00 PM");
    expect(formatRange("22:00", "06:30", L)).toBe("10:00 PM – 6:30 AM next day");
    expect(formatRange("18:00", "24:00", L)).toBe("6:00 PM – 12:00 AM");
  });
});

describe("describeTargets", () => {
  const list = (n: number) => ({ blockedSites: sites(n) });

  it("describes the Focus list", () => {
    expect(describeTargets(schedule({ useGlobalLists: true, sites: [] }), list(9))).toBe(
      "Blocks your Focus list (9 sites)",
    );
    expect(describeTargets(schedule({ useGlobalLists: true, sites: [] }), list(1))).toBe(
      "Blocks your Focus list (1 site)",
    );
    expect(describeTargets(schedule({ useGlobalLists: true, sites: [] }), list(0))).toBe(
      "Blocks nothing yet. Your Focus list is empty.",
    );
  });

  it("describes a schedule's own sites", () => {
    expect(describeTargets(schedule({ useGlobalLists: false, sites: [] }), list(9))).toBe(
      "Blocks nothing yet. Add sites to this schedule.",
    );
    expect(
      describeTargets(schedule({ useGlobalLists: false, sites: ["a.com", "b.com"] }), list(9)),
    ).toBe("Blocks a.com, b.com");
    expect(
      describeTargets(
        schedule({
          useGlobalLists: false,
          sites: ["a.com", "b.com", "c.com", "d.com", "e.com"],
        }),
        list(9),
      ),
    ).toBe("Blocks a.com, b.com, c.com and 2 more");
  });

  it("describes the Focus list plus extra sites", () => {
    expect(
      describeTargets(schedule({ useGlobalLists: true, sites: ["a.com", "b.com"] }), list(9)),
    ).toBe("Blocks your Focus list and 2 more sites");
    expect(
      describeTargets(schedule({ useGlobalLists: true, sites: ["a.com"] }), list(9)),
    ).toBe("Blocks your Focus list and 1 more site");
  });
});

describe("statusLine", () => {
  const now = new Date(2026, 10, 3, 10, 0).getTime(); // Tuesday
  const at = (day: number, hour: number, minute = 0) =>
    new Date(2026, 10, day, hour, minute).getTime();
  const s = schedule();

  it("says what is on now", () => {
    expect(statusLine({ kind: "active", schedule: s, endsAt: at(3, 12) }, now, L)).toBe(
      "On now: Study hours, until 12:00 PM.",
    );
  });

  it("says what is next: today, tomorrow or a weekday", () => {
    expect(statusLine({ kind: "next", schedule: s, startsAt: at(3, 18) }, now, L)).toBe(
      "Next: Study hours, today 6:00 PM.",
    );
    expect(statusLine({ kind: "next", schedule: s, startsAt: at(4, 9) }, now, L)).toBe(
      "Next: Study hours, tomorrow 9:00 AM.",
    );
    expect(statusLine({ kind: "next", schedule: s, startsAt: at(9, 9) }, now, L)).toBe(
      "Next: Study hours, Mon 9:00 AM.",
    );
  });

  it("handles no schedules and all schedules off", () => {
    expect(statusLine({ kind: "none", reason: "no-schedules" }, now, L)).toBe(
      "No schedules yet.",
    );
    expect(statusLine({ kind: "none", reason: "all-off" }, now, L)).toBe(
      "All schedules are off.",
    );
  });
});
