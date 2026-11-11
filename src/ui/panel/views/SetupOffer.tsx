import { useState } from "react";
import type { AppState } from "../../../shared/types.ts";
import { Button, Card } from "../../components/primitives.tsx";
import { useHiddenHints } from "../../hooks/useHiddenHints.ts";
import { openExtensionPage } from "../../lib/extensionPages.ts";
import { SETUP_OFFER_HINT_ID, SETUP_PAGE, wantsSetupOffer } from "../../lib/setupOffer.ts";

/**
 * The side panel is narrow, so setup is offered in a full tab. The buttons are
 * not primary: Start stays the one primary action on the Focus screen.
 */
export function SetupOfferCard({
  onOpen,
  onDismiss,
  failed,
}: {
  onOpen(): void;
  onDismiss(): void;
  failed: boolean;
}) {
  return (
    <Card title="Set up FocusGate in full screen" className="fg-setup-offer">
      <p className="fg-muted">
        The full-screen setup has more room to pick sites to block, add a password if you want one
        and check browser access. It takes about a minute.
      </p>
      <div className="fg-setup-offer__actions">
        <Button onClick={onOpen}>Open full-screen setup</Button>
        <Button variant="quiet" onClick={onDismiss}>
          Not now
        </Button>
      </div>
      <p className="fg-muted">You can run setup later from the You tab.</p>
      {failed && (
        <p className="fg-muted" role="status">
          Setup could not be opened. Try again.
        </p>
      )}
    </Card>
  );
}

/**
 * Shown on the Focus tab to someone with nothing set up. It is gone for good
 * once setup is opened or put off (or finished in the full-screen page), and
 * by itself once there is a rule or a password.
 */
export function SetupOffer({ state }: { state: AppState }) {
  const hints = useHiddenHints();
  const [failed, setFailed] = useState(false);
  if (!wantsSetupOffer(state, hints.isHidden(SETUP_OFFER_HINT_ID))) return null;

  async function open(): Promise<void> {
    if (await openExtensionPage(SETUP_PAGE)) {
      setFailed(false);
      hints.setHidden(SETUP_OFFER_HINT_ID, true);
    } else {
      setFailed(true);
    }
  }

  return (
    <SetupOfferCard
      failed={failed}
      onOpen={() => void open()}
      onDismiss={() => hints.setHidden(SETUP_OFFER_HINT_ID, true)}
    />
  );
}
