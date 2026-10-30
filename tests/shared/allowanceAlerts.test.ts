import { describe, expect, it } from "vitest";
import { allowanceAlertUpdates } from "../../src/shared/allowanceAlerts.ts";
import { freshUsage } from "../../src/shared/allowance.ts";
import type { Allowance, UsageRecord } from "../../src/shared/types.ts";

// 2026-10-31 at UTC noon keeps the local calendar day stable across zones.
const NOW = Date.UTC(2026, 9, 31, 12);

function localDateKey(now: number): string {
  const date = new Date(now);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

const budget: Allowance = { mode: "time_budget", limitMin: 60, duringBlocks: true };

function usage(usedMs: number, flags: Partial<UsageRecord> = {}): UsageRecord {
  return { ...freshUsage(localDateKey(NOW)), usedMs, ...flags };
}

describe("allowanceAlertUpdates", () => {
  it("returns no alerts without usage records or for non-time-budget modes", () => {
    expect(allowanceAlertUpdates({}, {}, NOW)).toEqual({
      alerts: [],
      usage: {},
      changed: false,
    });

    const count: Allowance = { mode: "count", maxOpens: 5, duringBlocks: true };
    const outcome = allowanceAlertUpdates(
      { "example.com": count },
      { "example.com": usage(0) },
      NOW,
    );
    expect(outcome.alerts).toEqual([]);
    expect(outcome.changed).toBe(false);
  });

  it("stays quiet while the budget is above the threshold", () => {
    const outcome = allowanceAlertUpdates(
      { "example.com": budget },
      { "example.com": usage(30 * 60_000) },
      NOW,
    );
    expect(outcome.alerts).toEqual([]);
    expect(outcome.changed).toBe(false);
  });

  it("fires the heads-up once at the five-minute/10% threshold", () => {
    // 60-minute budget with 56 minutes used → 4 minutes left, under the
    // 6-minute threshold (10% of the budget).
    const first = allowanceAlertUpdates(
      { "example.com": budget },
      { "example.com": usage(56 * 60_000) },
      NOW,
    );
    expect(first.alerts).toEqual([
      { domain: "example.com", kind: "heads-up", minutesLeft: 4 },
    ]);
    expect(first.changed).toBe(true);
    expect(first.usage["example.com"]?.headsUpNotifiedAt).toBe(NOW);

    const second = allowanceAlertUpdates(
      { "example.com": budget },
      first.usage,
      NOW + 1,
    );
    expect(second.alerts).toEqual([]);
    expect(second.changed).toBe(false);
  });

  it("fires the exhaustion alert once and lets the flags reset with the budget", () => {
    const first = allowanceAlertUpdates(
      { "example.com": budget },
      { "example.com": usage(60 * 60_000) },
      NOW,
    );
    expect(first.alerts).toEqual([
      { domain: "example.com", kind: "exhausted", resetsAt: expect.any(Number) },
    ]);
    expect(first.alerts[0]?.resetsAt).toBeGreaterThan(NOW);

    const second = allowanceAlertUpdates(
      { "example.com": budget },
      first.usage,
      NOW + 1,
    );
    expect(second.alerts).toEqual([]);

    // A fresh day starts with zero usage, so no alert fires and the flags
    // are gone until the thresholds are crossed again.
    const nextDay = allowanceAlertUpdates(
      { "example.com": budget },
      {
        ...first.usage,
        "example.com": {
          ...first.usage["example.com"]!,
          dateKey: "2026-10-01",
        },
      },
      NOW,
    );
    expect(nextDay.alerts).toEqual([]);
    expect(nextDay.usage["example.com"]?.headsUpNotifiedAt).toBeUndefined();
    expect(nextDay.usage["example.com"]?.exhaustedNotifiedAt).toBeUndefined();
  });

  it("prefers the exhaustion alert once the budget is spent", () => {
    const outcome = allowanceAlertUpdates(
      { "example.com": budget },
      { "example.com": usage(61 * 60_000, { headsUpNotifiedAt: NOW }) },
      NOW,
    );
    expect(outcome.alerts).toEqual([
      { domain: "example.com", kind: "exhausted", resetsAt: expect.any(Number) },
    ]);
  });
});
