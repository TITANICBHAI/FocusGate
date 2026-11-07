import { guard } from "../../shared/gating.ts";
import type { AppState } from "../../shared/types.ts";

/** The visible reason a weakening change is locked, or null when it is allowed. */
export function weakeningLockReason(
  state: AppState,
  now = Date.now(),
): string | null {
  const decision = guard("remove_site", {
    session: state.session,
    standalone: state.standalone,
    hasPassword: state.password !== null,
    now,
  });
  return decision.result === "locked" ? decision.reason : null;
}
