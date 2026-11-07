import { formatClockTime } from "../../shared/clockFormat.ts";
import { normalizeDomain } from "../../shared/domains.ts";
import { computeBlockPlan } from "../../shared/plan.ts";
import { isWorkPhaseLive } from "../../shared/sessionClock.ts";
import type { AppState } from "../../shared/types.ts";
import { weakeningLockReason } from "./guardState.ts";
import { scheduleStatus } from "./scheduleStatus.ts";

export type StatusTone = "idle" | "focus" | "schedule" | "locked" | "break";

export interface StatusSummary {
  tone: StatusTone;
  headline: string;
  detail: string;
  /** Extra lines, such as a site that reached its daily limit. */
  secondary: string[];
  canEdit: "all" | "stricter-only";
  cta?: { label: string; target: "rules" | "schedule" };
}

const sites = (count: number): string => `${count} ${count === 1 ? "site" : "sites"}`;

function nothingConfigured(state: AppState): boolean {
  return (
    state.blockedSites.length === 0 &&
    state.alwaysBlockedSites.length === 0 &&
    state.keywords.length === 0 &&
    state.schedules.length === 0 &&
    Object.keys(state.allowances).length === 0
  );
}

/** What FocusGate is doing right now, in words the person can act on. */
export function describeNow(
  state: AppState,
  nowMs: number,
  locale?: string,
): StatusSummary {
  const plan = computeBlockPlan(state, nowMs);
  const blockedCount = plan.blocked.size;
  const time = (timestamp: number) => formatClockTime(timestamp, locale);
  const canEdit: StatusSummary["canEdit"] =
    weakeningLockReason(state, nowMs) === null ? "all" : "stricter-only";

  const secondary: string[] = [];
  for (const domain of Object.keys(state.allowances)) {
    const normalized = normalizeDomain(domain);
    if (normalized && plan.blocked.get(normalized)?.kind === "allowance") {
      secondary.push(`${normalized} reached its daily limit.`);
    }
  }

  const make = (
    tone: StatusTone,
    headline: string,
    detail: string,
    cta?: StatusSummary["cta"],
  ): StatusSummary => ({
    tone,
    headline,
    detail,
    secondary,
    canEdit,
    ...(cta ? { cta } : {}),
  });

  const { standalone, session } = state;
  if (standalone.active && standalone.startsAt <= nowMs && nowMs < standalone.until) {
    return make(
      "locked",
      "Block now is on.",
      `${sites(blockedCount)} ${blockedCount === 1 ? "is" : "are"} blocked until ${time(
        standalone.until,
      )}. There is no early stop.`,
    );
  }

  if (isWorkPhaseLive(session, nowMs)) {
    const ends = time(session.phaseEndsAt);
    if (session.lockLevel === "strict") {
      return make(
        "locked",
        "Strict focus session is on.",
        `Ends ${ends}. Rules can only get stricter until then.`,
      );
    }
    if (session.lockLevel === "commitment") {
      return make(
        "locked",
        "Commitment session is on.",
        `Ends ${ends}. There is no early stop, and rules can only get stricter.`,
      );
    }
    return make(
      "focus",
      "Focus session is on.",
      `Ends ${ends}. Blocking ${sites(blockedCount)}. You can edit rules and stop any time.`,
    );
  }

  const status = scheduleStatus(state.schedules, nowMs);

  if (
    (session.status === "shortBreak" || session.status === "longBreak") &&
    session.phaseEndsAt > nowMs
  ) {
    if (status.kind === "active") {
      secondary.push(
        `Schedule is on: ${status.schedule.name}, blocking until ${time(status.endsAt)}.`,
      );
    }
    return make(
      "break",
      "On a break.",
      `Focus sites are open until ${time(session.phaseEndsAt)}.`,
    );
  }

  if (status.kind === "active") {
    return make(
      "schedule",
      `Schedule is on: ${status.schedule.name}.`,
      `Blocking ${sites(blockedCount)} until ${time(status.endsAt)}.`,
    );
  }

  if (nothingConfigured(state)) {
    return make(
      "idle",
      "Nothing is blocked yet.",
      "Add sites in Rules, then start a focus session.",
      { label: "Add sites", target: "rules" },
    );
  }

  const alwaysCount = [...plan.blocked.values()].filter(
    (reason) => reason.kind === "always",
  ).length;
  if (alwaysCount > 0) {
    return make(
      "idle",
      `The Always list is blocking ${sites(alwaysCount)}.`,
      "Start a focus session to block your Focus list too.",
    );
  }

  return make(
    "idle",
    "Nothing is blocking right now.",
    "Start a focus session, or add a schedule to block automatically.",
    state.schedules.length === 0
      ? { label: "Add a schedule", target: "schedule" }
      : undefined,
  );
}

/** The labelled pill in the header: what is happening, in a word or two. */
export interface HeaderPill {
  label: string;
  tone: StatusTone;
}
