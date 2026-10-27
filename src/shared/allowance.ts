import { localDateKey, startOfNextLocalDay } from "./time.ts";
import type { Allowance, UsageRecord } from "./types.ts";

export const VISIT_GAP_MS = 2 * 60_000;
export const VISIT_MAX_MS = 30 * 60_000;
export const MAX_DELTA_MS = 90_000;

export function freshUsage(dateKey: string): UsageRecord {
  return { dateKey, usedMs: 0, opens: 0, windowStartMs: 0, lastActiveAt: 0 };
}

export function normalizeRecord(
  record: UsageRecord | undefined,
  allowance: Allowance,
  now: number,
): UsageRecord {
  const today = localDateKey(new Date(now));
  if (!record) return freshUsage(today);
  if (allowance.mode === "interval") {
    const expired =
      record.windowStartMs > 0 &&
      now >= record.windowStartMs + allowance.everyMin * 60_000;
    return expired ? freshUsage(today) : { ...record };
  }
  return record.dateKey === today ? { ...record } : freshUsage(today);
}

export function visitInProgress(
  record: UsageRecord | undefined,
  now: number,
): boolean {
  if (!record || record.lastActiveAt <= 0) return false;
  const since = now - record.lastActiveAt;
  return (
    since >= 0 &&
    since <= VISIT_GAP_MS &&
    record.windowStartMs > 0 &&
    now - record.windowStartMs < VISIT_MAX_MS
  );
}

export function isExhausted(
  record: UsageRecord | undefined,
  allowance: Allowance,
  now: number,
): boolean {
  const current = normalizeRecord(record, allowance, now);
  switch (allowance.mode) {
    case "time_budget":
      return current.usedMs >= allowance.limitMin * 60_000;
    case "count":
      return current.opens >= allowance.maxOpens && !visitInProgress(current, now);
    case "interval":
      return (
        current.windowStartMs > 0 &&
        now < current.windowStartMs + allowance.everyMin * 60_000 &&
        current.usedMs >= allowance.allowMin * 60_000
      );
  }
}

export function applyAttention(
  record: UsageRecord | undefined,
  allowance: Allowance,
  now: number,
  deltaMs: number,
): UsageRecord {
  const current = normalizeRecord(record, allowance, now);
  const newVisit = !visitInProgress(current, now);
  if (
    (allowance.mode === "interval" || allowance.mode === "count") &&
    newVisit
  ) {
    current.windowStartMs = now;
  }
  current.usedMs += Math.min(Math.max(0, deltaMs), MAX_DELTA_MS);
  if (newVisit) current.opens += 1;
  current.lastActiveAt = now;
  return current;
}

export function nextResetAt(
  record: UsageRecord,
  allowance: Allowance,
  now: number,
): number {
  if (allowance.mode === "interval") {
    return record.windowStartMs > 0
      ? record.windowStartMs + allowance.everyMin * 60_000
      : now;
  }
  return startOfNextLocalDay(now);
}

export function remainingBudget(
  record: UsageRecord | undefined,
  allowance: Allowance,
  now: number,
): number {
  const current = normalizeRecord(record, allowance, now);
  if (allowance.mode === "count") {
    return Math.max(0, allowance.maxOpens - current.opens);
  }
  const limit =
    allowance.mode === "time_budget"
      ? allowance.limitMin * 60_000
      : allowance.allowMin * 60_000;
  return Math.max(0, limit - current.usedMs);
}
