import { formatClockTime } from "../../shared/clockFormat.ts";
import { normalizeDomain } from "../../shared/domains.ts";
import { computeBlockPlan } from "../../shared/plan.ts";
import { isWorkPhaseLive } from "../../shared/sessionClock.ts";
import type { AppState } from "../../shared/types.ts";
import { weakeningLockReason } from "./guardState.ts";
import { scheduleStatus } from "./scheduleStatus.ts";
import { statusLine } from "./scheduleSummary.ts";

/**
 * `standing` is blocking that needs no session: the Always list, keywords that
 * are on all the time, and sites past their limit. It is amber like the rest
 * of "blocking now", but it has no timer and no lock.
 */
export type StatusTone = "idle" | "standing" | "focus" | "schedule" | "locked" | "break";

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
const keywords = (count: number): string => `${count} ${count === 1 ? "keyword" : "keywords"}`;

/** "a", "a and b", "a, b and c". */
function joinAnd(parts: readonly string[]): string {
  if (parts.length <= 1) return parts.join("");
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

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

  // A limit either ran out (the site is blocked now) or is still watching.
  const secondary: string[] = [];
  let limitsReached = 0;
  let limitsWatching = 0;
  for (const domain of Object.keys(state.allowances)) {
    const normalized = normalizeDomain(domain);
    if (!normalized) continue;
    if (plan.blocked.get(normalized)?.kind === "allowance") {
      secondary.push(`${normalized} reached its daily limit.`);
      limitsReached += 1;
    } else {
      limitsWatching += 1;
    }
  }
  // Count what the person added, not every address an entry covers: one
  // youtube.com entry also blocks youtu.be, and the You tab counts entries too.
  const alwaysCount = state.alwaysBlockedSites.filter(
    (entry) => normalizeDomain(entry) !== null,
  ).length;
  const keywordCount = plan.keywords.length;

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
    // A break opens the Focus list. The Always list and keywords do not stop.
    if (alwaysCount > 0) {
      secondary.push(`The Always list is still blocking ${sites(alwaysCount)}.`);
    }
    if (keywordCount > 0) {
      secondary.push(
        `${keywords(keywordCount)} ${keywordCount === 1 ? "is" : "are"} still blocking pages.`,
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

  // Rules that are set up but not blocking yet are worth a line each, so the
  // strip never reads as if they were not there.
  const waiting: string[] = [];
  if (limitsWatching > 0) {
    waiting.push(`Limits are watching ${sites(limitsWatching)}.`);
  }
  const duringBlocks = state.keywords.filter((rule) => rule.when !== "always").length;
  if (duringBlocks > 0) {
    waiting.push(
      `${keywords(duringBlocks)} ${duringBlocks === 1 ? "applies" : "apply"} only during focus sessions and schedules.`,
    );
  }
  secondary.push(...waiting);

  // Nothing session-like is running, yet the Always list, keywords that are on
  // all the time and sites past their limit can all be blocking.
  if (blockedCount + keywordCount > 0) {
    const standingSites = alwaysCount + limitsReached;
    const what = [
      ...(standingSites > 0 ? [sites(standingSites)] : []),
      ...(keywordCount > 0 ? [keywords(keywordCount)] : []),
    ];
    const from = [
      ...(alwaysCount > 0 ? ["Always list"] : []),
      ...(keywordCount > 0 ? ["keywords"] : []),
      ...(limitsReached > 0 ? ["limits"] : []),
    ];
    if (state.blockedSites.length > 0) {
      secondary.push("Start a focus session to block your Focus list too.");
    }
    return make("standing", `Blocking ${joinAnd(what)}.`, `From your ${joinAnd(from)}.`);
  }

  const headline = "Nothing is blocking right now.";
  if (state.schedules.length > 0) {
    return make("idle", headline, statusLine(status, nowMs, locale));
  }
  return state.blockedSites.length > 0
    ? make(
        "idle",
        headline,
        "Start a focus session, or add a schedule to block automatically.",
        { label: "Add a schedule", target: "schedule" },
      )
    : make("idle", headline, "Add sites to your Focus list to block them in a session.", {
        label: "Add sites",
        target: "rules",
      });
}

/** The labelled pill in the header: what is happening, in a word or two. */
export interface HeaderPill {
  label: string;
  tone: StatusTone;
}
