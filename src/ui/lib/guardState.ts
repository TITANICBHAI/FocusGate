import { guard } from "../../shared/gating.ts";
import type { AppState } from "../../shared/types.ts";

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
  if (decision.result !== "locked") return null;
  const standaloneActive =
    state.standalone.active &&
    state.standalone.startsAt <= now &&
    now < state.standalone.until;
  const owner = standaloneActive
    ? "standalone block"
    : `${state.session.lockLevel} session`;
  const until = decision.until
    ? new Date(decision.until).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      })
    : null;
  return until
    ? `Locked until ${until} by your ${owner}.`
    : decision.reason;
}
