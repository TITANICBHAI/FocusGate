import { InfoNote, Button } from "../../components/primitives.tsx";
import { useHiddenHints } from "../../hooks/useHiddenHints.ts";
import { PASSWORD_NUDGE_HINT_ID, wantsPasswordNudge } from "../../lib/passwordNudge.ts";
import type { AppState } from "../../../shared/types.ts";

/** Opens Settings, where the password is set: a new tab from the panel, the Settings tab in the dashboard. */
function openSettings(inDashboard: boolean): void {
  if (!inDashboard && typeof chrome !== "undefined" && chrome.tabs?.create) {
    chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html#settings") });
    return;
  }
  window.location.hash = "settings";
}

/**
 * Shown above the rules while none of them is protected by a password. It can be
 * hidden for good, and it goes away by itself once a password is set.
 */
export function PasswordNudge({ state, density }: { state: AppState; density: "narrow" | "wide" }) {
  const hints = useHiddenHints();
  if (!wantsPasswordNudge(state, hints.isHidden(PASSWORD_NUDGE_HINT_ID))) return null;
  return (
    <InfoNote
      info={{ open: true, id: "password-nudge", toggle: () => undefined }}
      onDismiss={() => hints.setHidden(PASSWORD_NUDGE_HINT_ID, true)}
      dismissLabel="Hide this hint"
    >
      <strong>No password yet.</strong> Anyone using this browser can remove your sites, keywords,
      schedules and limits. With a password, removing or loosening them asks for it.
      <div className="fg-info-note__actions">
        <Button size="dense" onClick={() => openSettings(density === "wide")}>
          Set a password
        </Button>
      </div>
    </InfoNote>
  );
}
