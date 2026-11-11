import type { AppState } from "../../shared/types.ts";
import { setHintHidden } from "./hiddenHints.ts";
import type { HintStore } from "./hiddenHints.ts";
import { protectedRuleCount } from "./passwordNudge.ts";

/** The id the setup offer is dealt with by (see hiddenHints). */
export const SETUP_OFFER_HINT_ID = "setup-offer";

/** The full-screen setup page. */
export const SETUP_PAGE = "onboarding.html";

/** Nothing set up yet: no rules, no password, no session run. */
export function isFirstRun(state: AppState): boolean {
  return (
    protectedRuleCount(state) === 0 &&
    state.password === null &&
    state.sessionHistory.length === 0
  );
}

/** The side panel offers setup once, to someone with nothing set up who has not dealt with it. */
export function wantsSetupOffer(state: AppState, handled: boolean): boolean {
  return !handled && isFirstRun(state);
}

/**
 * Remember that setup was opened, finished or put off. Kept in this browser
 * only, with the hidden hints, and never throws.
 */
export function markSetupHandled(store?: HintStore | null): void {
  setHintHidden(SETUP_OFFER_HINT_ID, true, store);
}
