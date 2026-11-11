import { normalizeDomain } from "../../shared/domains.ts";
import type { AppState } from "../../shared/types.ts";

/** The id the nudge is hidden by (see hiddenHints). */
export const PASSWORD_NUDGE_HINT_ID = "rules-password";

/** How many rules a password would protect: the Focus and Always lists, keywords, schedules and limits. */
export function protectedRuleCount(state: AppState): number {
  const sites = (list: readonly string[]) =>
    list.filter((entry) => normalizeDomain(entry) !== null).length;
  return (
    sites(state.blockedSites) +
    sites(state.alwaysBlockedSites) +
    state.keywords.length +
    state.schedules.length +
    Object.keys(state.allowances).length
  );
}

/** Nudge only when there is something to protect, no password yet, and it was not hidden. */
export function wantsPasswordNudge(state: AppState, hidden: boolean): boolean {
  return !hidden && state.password === null && protectedRuleCount(state) > 0;
}
