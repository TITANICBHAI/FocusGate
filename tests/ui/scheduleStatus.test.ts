import { describe, expect, it } from "vitest";
import { activeScheduleAt } from "../../src/ui/lib/scheduleStatus.ts";
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
