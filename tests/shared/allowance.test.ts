import { describe, expect, it } from "vitest";
import {
  applyAttention,
  freshUsage,
  isExhausted,
  MAX_DELTA_MS,
  nextResetAt,
  normalizeRecord,
  remainingBudget,
  VISIT_GAP_MS,
  VISIT_MAX_MS,
} from "../../src/shared/allowance.ts";
import type { Allowance } from "../../src/shared/types.ts";

const timeBudget: Allowance = {
  mode: "time_budget",
  limitMin: 2,
  duringBlocks: true,
};

describe("allowance ledger", () => {
  it("caps attention deltas so sleep cannot charge hours", () => {
    const record = applyAttention(undefined, timeBudget, 1_000, 4 * 60_000);
    expect(record.usedMs).toBe(MAX_DELTA_MS);
    expect(record.opens).toBe(1);
    expect(isExhausted(record, timeBudget, 91_000)).toBe(false);
  });

  it("resets daily budgets at local midnight", () => {
    const beforeMidnight = new Date(2026, 9, 26, 23, 59).getTime();
    const afterMidnight = new Date(2026, 9, 27, 0, 1).getTime();
    const record = applyAttention(undefined, timeBudget, beforeMidnight, 60_000);
    const normalized = normalizeRecord(record, timeBudget, afterMidnight);
    expect(normalized.usedMs).toBe(0);
    expect(normalized.dateKey).toBe("2026-10-27");
    expect(nextResetAt(normalized, timeBudget, afterMidnight)).toBe(
      new Date(2026, 9, 28, 0, 0).getTime(),
    );
  });

  it("resets interval windows by elapsed time, independently of midnight", () => {
    const allowance: Allowance = {
      mode: "interval",
      allowMin: 1,
      everyMin: 5,
      duringBlocks: true,
    };
    const start = new Date(2026, 9, 26, 23, 58).getTime();
    const record = applyAttention(undefined, allowance, start, 60_000);
    expect(isExhausted(record, allowance, start + 60_000)).toBe(true);
    expect(nextResetAt(record, allowance, start + 60_000)).toBe(
      start + 5 * 60_000,
    );
    expect(normalizeRecord(record, allowance, start + 5 * 60_000).usedMs).toBe(0);
  });

  it("counts visits after a two-minute gap and allows a visit to finish", () => {
    const allowance: Allowance = {
      mode: "count",
      maxOpens: 2,
      duringBlocks: false,
    };
    let record = applyAttention(undefined, allowance, 10_000, 30_000);
    record = applyAttention(record, allowance, 70_000, 30_000);
    expect(record.opens).toBe(1);
    record = applyAttention(record, allowance, 10_000 + VISIT_GAP_MS + 1, 10_000);
    expect(record.opens).toBe(2);
    expect(isExhausted(record, allowance, record.lastActiveAt + 1_000)).toBe(false);
    expect(isExhausted(record, allowance, record.lastActiveAt + VISIT_GAP_MS + 1)).toBe(
      true,
    );
    expect(remainingBudget(record, allowance, record.lastActiveAt)).toBe(0);
  });

  it("starts a new visit after a long continuous visit", () => {
    const allowance: Allowance = {
      mode: "count",
      maxOpens: 2,
      duringBlocks: false,
    };
    const first = applyAttention(undefined, allowance, 10_000, 10_000);
    const next = applyAttention(
      first,
      allowance,
      10_000 + VISIT_MAX_MS,
      10_000,
    );
    expect(next.opens).toBe(2);
  });

  it("uses fresh zero records consistently", () => {
    expect(freshUsage("2026-10-27")).toEqual({
      dateKey: "2026-10-27",
      usedMs: 0,
      opens: 0,
      windowStartMs: 0,
      lastActiveAt: 0,
    });
  });
});
