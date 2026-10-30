import { describe, expect, it } from "vitest";
import { habitStreak } from "../../src/shared/habits.ts";

describe("habitStreak", () => {
  const today = "2026-10-31";

  it("is zero with no check-ins", () => {
    expect(habitStreak([], today)).toBe(0);
  });

  it("counts today's check-in", () => {
    expect(habitStreak([today], today)).toBe(1);
    expect(habitStreak(["2026-10-29", "2026-10-30", today], today)).toBe(3);
  });

  it("stays alive through an unchecked today when yesterday is checked", () => {
    expect(habitStreak(["2026-10-30"], today)).toBe(1);
    expect(habitStreak(["2026-10-28", "2026-10-29", "2026-10-30"], today)).toBe(
      3,
    );
  });

  it("breaks after a missed day", () => {
    expect(habitStreak(["2026-10-29"], today)).toBe(0);
    expect(habitStreak(["2026-10-27", "2026-10-28", "2026-10-29"], today)).toBe(
      0,
    );
  });

  it("ignores duplicates and unsorted input", () => {
    expect(habitStreak([today, "2026-10-30", today, "2026-10-29"], today)).toBe(
      3,
    );
  });
});
