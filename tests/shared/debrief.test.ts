import { describe, expect, it } from "vitest";
import { sessionDebrief } from "../../src/shared/debrief.ts";
import type { SessionRecord } from "../../src/shared/types.ts";

function record(overrides: Partial<SessionRecord>): SessionRecord {
  return {
    id: "record-1",
    startedAt: 0,
    endedAt: 25 * 60_000,
    plannedMs: 25 * 60_000,
    elapsedMs: 25 * 60_000,
    status: "completed",
    lockLevel: "none",
    blockedAttempts: 0,
    gaps: [],
    ...overrides,
  };
}

describe("sessionDebrief", () => {
  it("celebrates a clean session without a pace line", () => {
    expect(sessionDebrief(record({}))).toEqual({
      blockedAttempts: 0,
      headline: "Clean session — no blocked attempts",
    });
  });

  it("counts blocked attempts", () => {
    const debrief = sessionDebrief(record({ blockedAttempts: 3 }));
    expect(debrief.headline).toBe("3 blocked attempts");
    expect(debrief.pace).toBeUndefined();
  });

  it("reports finishing early", () => {
    const debrief = sessionDebrief(record({ elapsedMs: 19 * 60_000 }));
    expect(debrief.pace).toBe("finished 6 min early");
  });

  it("measures over-time against the extended plan, not the original one", () => {
    const onTimeAfterExtension = sessionDebrief(
      record({ extendedMs: 15 * 60_000, elapsedMs: 40 * 60_000 }),
    );
    expect(onTimeAfterExtension.pace).toBeUndefined();

    const over = sessionDebrief(
      record({ extendedMs: 15 * 60_000, elapsedMs: 45 * 60_000 }),
    );
    expect(over.pace).toBe("ran 5 min over");
  });
});
