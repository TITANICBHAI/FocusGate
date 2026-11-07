import { describe, expect, it } from "vitest";
import { activeScheduleAt, scheduleStatus } from "../../src/ui/lib/scheduleStatus.ts";
import type { Schedule } from "../../src/shared/types.ts";

const overnightSchedule: Schedule = {
  id: "overnight",
  name: "Night shift",
  enabled: true,
  days: [1],
  start: "22:00",
  end: "02:00",
  sites: ["example.com"],
  keywords: [],
  useGlobalLists: true,
};

describe("popup schedule status", () => {
  it("keeps an overnight schedule active after midnight on its selected day", () => {
    const mondayNight = new Date(2026, 9, 26, 23, 0);
    const tuesdayMorning = new Date(mondayNight);
    tuesdayMorning.setDate(tuesdayMorning.getDate() + 1);
    tuesdayMorning.setHours(1, 0, 0, 0);

    expect(activeScheduleAt([overnightSchedule], mondayNight.getTime())).toBe(
      overnightSchedule,
    );
    expect(
      activeScheduleAt([overnightSchedule], tuesdayMorning.getTime()),
    ).toBe(overnightSchedule);
  });

  it("treats the schedule end as exclusive and ignores disabled schedules", () => {
    const tuesdayEnd = new Date(2026, 9, 27, 2, 0);
    expect(activeScheduleAt([overnightSchedule], tuesdayEnd.getTime())).toBeNull();
    expect(
      activeScheduleAt(
        [{ ...overnightSchedule, enabled: false }],
        new Date(2026, 9, 26, 23, 0).getTime(),
      ),
    ).toBeNull();
  });
});

describe("scheduleStatus", () => {
  const make = (overrides: Partial<Schedule>): Schedule => ({
    ...overnightSchedule,
    id: "x",
    name: "X",
    days: [0, 1, 2, 3, 4, 5, 6],
    ...overrides,
  });
  const at = (day: number, hour: number, minute = 0) =>
    new Date(2026, 10, day, hour, minute).getTime(); // Nov 3, 2026 is a Tuesday

  it("reports no schedules and all off", () => {
    expect(scheduleStatus([], at(3, 10))).toEqual({ kind: "none", reason: "no-schedules" });
    expect(scheduleStatus([make({ enabled: false })], at(3, 10))).toEqual({
      kind: "none",
      reason: "all-off",
    });
  });

  it("extends the end across overlapping schedules", () => {
    const a = make({ id: "a", start: "09:00", end: "12:00" });
    const b = make({ id: "b", start: "11:00", end: "14:00" });
    const status = scheduleStatus([a, b], at(3, 11, 30));
    expect(status).toMatchObject({ kind: "active", endsAt: at(3, 14) });
  });

  it("extends the end across back-to-back schedules", () => {
    const a = make({ id: "a", start: "09:00", end: "12:00" });
    const b = make({ id: "b", start: "12:00", end: "14:00" });
    expect(scheduleStatus([a, b], at(3, 10))).toMatchObject({
      kind: "active",
      endsAt: at(3, 14),
    });
  });

  it("handles overnight windows on both sides of midnight", () => {
    const night = make({ id: "n", start: "22:00", end: "06:30" });
    expect(scheduleStatus([night], at(3, 23))).toMatchObject({
      kind: "active",
      endsAt: at(4, 6, 30),
    });
    expect(scheduleStatus([night], at(4, 5))).toMatchObject({
      kind: "active",
      endsAt: at(4, 6, 30),
    });
  });

  it("finds the next start, skipping days the schedule does not run", () => {
    const weekdays = make({ id: "w", days: [1, 2, 3, 4, 5], start: "09:00", end: "12:00" });
    // Saturday Nov 7 10:00 -> Monday Nov 9 09:00
    expect(scheduleStatus([weekdays], at(7, 10))).toMatchObject({
      kind: "next",
      startsAt: at(9, 9),
    });
  });

  it("picks the earliest next start across schedules and ignores disabled ones", () => {
    const late = make({ id: "l", start: "20:00", end: "21:00" });
    const early = make({ id: "e", start: "18:00", end: "19:00" });
    const off = make({ id: "o", start: "11:00", end: "12:00", enabled: false });
    expect(scheduleStatus([late, early, off], at(3, 10))).toMatchObject({
      kind: "next",
      startsAt: at(3, 18),
    });
  });

  it("never reports a disabled schedule as active", () => {
    const off = make({ start: "09:00", end: "12:00", enabled: false });
    expect(scheduleStatus([off], at(3, 10)).kind).toBe("none");
  });

  it("treats a schedule with no days or equal start and end as unable to start", () => {
    expect(scheduleStatus([make({ days: [] })], at(3, 10))).toEqual({
      kind: "none",
      reason: "all-off",
    });
    expect(scheduleStatus([make({ start: "09:00", end: "09:00" })], at(3, 10))).toEqual({
      kind: "none",
      reason: "all-off",
    });
  });
});
