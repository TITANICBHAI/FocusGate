import {
  isExhausted,
  nextResetAt,
  normalizeRecord,
  remainingBudget,
} from "./allowance.ts";
import type { Allowance, UsageRecord } from "./types.ts";

export type AllowanceAlertKind = "heads-up" | "exhausted";

export interface AllowanceAlert {
  domain: string;
  kind: AllowanceAlertKind;
  /** Whole minutes left in the budget, for heads-up alerts. */
  minutesLeft?: number;
  /** When the budget resets, for exhaustion alerts. */
  resetsAt?: number;
}

export interface AllowanceAlertOutcome {
  alerts: AllowanceAlert[];
  /** Usage records with the once-per-window notification flags applied. */
  usage: Record<string, UsageRecord>;
  changed: boolean;
}

/**
 * WP7-B7: computes heads-up and exhaustion alerts for time-budget
 * allowances and stamps the usage records so each alert fires at most once
 * per budget window. The flags reset together with the usage record.
 */
export function allowanceAlertUpdates(
  allowances: Record<string, Allowance>,
  usage: Record<string, UsageRecord>,
  now: number,
): AllowanceAlertOutcome {
  const alerts: AllowanceAlert[] = [];
  const next: Record<string, UsageRecord> = { ...usage };
  let changed = false;

  for (const [domain, allowance] of Object.entries(allowances)) {
    if (allowance.mode !== "time_budget") continue;
    const stored = usage[domain];
    if (!stored) continue;

    const normalized = normalizeRecord(stored, allowance, now);
    const remainingMs = remainingBudget(stored, allowance, now);
    const thresholdMs = Math.max(
      5 * 60_000,
      Math.round((allowance.limitMin * 60_000) * 0.1),
    );

    if (isExhausted(normalized, allowance, now)) {
      if (normalized.exhaustedNotifiedAt === undefined) {
        alerts.push({
          domain,
          kind: "exhausted",
          resetsAt: nextResetAt(normalized, allowance, now),
        });
        next[domain] = { ...normalized, exhaustedNotifiedAt: now };
        changed = true;
      }
      continue;
    }

    if (remainingMs <= thresholdMs && normalized.headsUpNotifiedAt === undefined) {
      alerts.push({
        domain,
        kind: "heads-up",
        minutesLeft: Math.max(1, Math.ceil(remainingMs / 60_000)),
      });
      next[domain] = { ...normalized, headsUpNotifiedAt: now };
      changed = true;
    }
  }

  return { alerts, usage: next, changed };
}
