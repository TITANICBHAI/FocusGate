import { describe, expect, it } from "vitest";
import {
  isScheduleActiveAt,
  localDateKey,
  nextScheduleBoundary,
  parseHHMM,
} from "../../src/shared/time.ts";
import type { Schedule } from "../../src/shared/types.ts";

const schedule = (overrides: Partial<Schedule> = {}): Schedule => ({
  id: "s1",
  name: "Work",
  enabled: true,
  days: [1, 2, 3, 4, 5],
  start: "09:00",
  end: "17:00",
  sites: ["example.com"],
  keywords: [],
  useGlobalLists: false,
  ...overrides,
});

describe("schedule time helpers", () => {
  it("parses valid local times and the end-of-day sentinel", () => {
    expect(parseHHMM("09:05")).toBe(545);
    expect(parseHHMM("24:00")).toBe(1440);
    expect(() => parseHHMM("24:01")).toThrow(RangeError);
  });

  it("uses an end-exclusive same-day window and treats equal times as empty", () => {
    const rule = schedule({ days: [1] });
    expect(isScheduleActiveAt(rule, new Date(2026, 9, 26, 9, 0))).toBe(true);
    expect(isScheduleActiveAt(rule, new Date(2026, 9, 26, 16, 59))).toBe(true);
    expect(isScheduleActiveAt(rule, new Date(2026, 9, 26, 17, 0))).toBe(false);
    expect(
      isScheduleActiveAt(
        schedule({ days: [1], start: "09:00", end: "09:00" }),
        new Date(2026, 9, 26, 9, 0),
      ),
    ).toBe(false);
  });

  it("attributes an overnight morning segment to the previous weekday", () => {
    const rule = schedule({ days: [1], start: "22:00", end: "06:00" });
    expect(isScheduleActiveAt(rule, new Date(2026, 9, 27, 2, 0))).toBe(true);
    expect(isScheduleActiveAt(rule, new Date(2026, 9, 27, 22, 0))).toBe(false);
  });

  it("finds the next boundary across the end of the week and rolls 24:00", () => {
    const rule = schedule({
      days: [6],
      start: "23:00",
      end: "24:00",
    });
    const now = new Date(2026, 9, 31, 23, 30);
    const boundary = nextScheduleBoundary([rule], now);
    expect(boundary).toBe(new Date(2026, 10, 1, 0, 0).getTime());
  });

  it("uses local calendar dates around midnight", () => {
    expect(localDateKey(new Date(2026, 9, 26, 23, 59))).toBe("2026-10-26");
    expect(localDateKey(new Date(2026, 9, 27, 0, 0))).toBe("2026-10-27");
  });

  it("evaluates a wall-clock schedule through a spring-forward gap", () => {
    const previousTimezone = process.env.TZ;
    process.env.TZ = "America/New_York";
    try {
      const rule = schedule({
        days: [0],
        start: "02:30",
        end: "04:00",
      });
      const beforeGap = new Date(2026, 2, 8, 1, 30);
      const next = nextScheduleBoundary([rule], beforeGap);
      expect(next).not.toBeNull();
      expect(new Date(next!).getHours()).toBe(3);
      expect(new Date(next!).getMinutes()).toBe(30);
      expect(isScheduleActiveAt(rule, new Date(2026, 2, 8, 3, 35))).toBe(true);
    } finally {
      if (previousTimezone === undefined) delete process.env.TZ;
      else process.env.TZ = previousTimezone;
    }
  });

  it("evaluates a wall-clock schedule through a fall-back overlap", () => {
    const previousTimezone = process.env.TZ;
    process.env.TZ = "America/New_York";
    try {
      const rule = schedule({
        days: [0],
        start: "01:30",
        end: "02:30",
      });
      const beforeOverlap = new Date(2026, 10, 1, 0, 45);
      const next = nextScheduleBoundary([rule], beforeOverlap);
      expect(next).toBe(new Date(2026, 10, 1, 1, 30).getTime());
      expect(
        isScheduleActiveAt(rule, new Date("2026-11-01T05:45:00Z")),
      ).toBe(true);
      expect(
        isScheduleActiveAt(rule, new Date("2026-11-01T06:45:00Z")),
      ).toBe(true);
    } finally {
      if (previousTimezone === undefined) delete process.env.TZ;
      else process.env.TZ = previousTimezone;
    }
  });
});
