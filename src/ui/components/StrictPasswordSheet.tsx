import { useState } from "react";
import type { FormEvent } from "react";
import { sendPasswordMessage } from "../lib/passwordActions.ts";
import { emptyPasswordDraft } from "../lib/passwordDraft.ts";
import type { PasswordDraft } from "../lib/passwordDraft.ts";
import {
  applyStrictPasswordChoice,
  strictSheetChoice,
  strictSheetPrimaryLabel,
} from "../lib/strictStart.ts";
import type { StrictPasswordChoice, StrictSheetMode } from "../lib/strictStart.ts";
import { PasswordPicker } from "./PasswordPicker.tsx";
import { Button, PasswordField, Sheet } from "./primitives.tsx";

interface StrictPasswordSheetProps {
  open: boolean;
  /** Whether a password is already saved. */
  hasPassword: boolean;
  onCancel(): void;
  /** The password is settled: start the session. */
  onDone(): void;
  /** For a saved password: start on "use my password" or on "set a new one". */
  initialMode?: StrictSheetMode;
  initialDraft?: PasswordDraft;
}

/**
 * Shown before every Strict session, so the person knows what stopping early
 * will need. With no password saved they can set one (type it, or generate and see
 * it) or start with the phrase. With one saved, one click uses it, or they can
 * replace it with the current password to prove it is them.
 */
export function StrictPasswordSheet(props: StrictPasswordSheetProps) {
  // Mounted only while open, so each question starts from a clean form.
  if (!props.open) return null;
  return <StrictPasswordSheetBody {...props} />;
}

function StrictPasswordSheetBody({
  hasPassword,
  onCancel,
  onDone,
  initialMode = "keep",
  initialDraft,
}: StrictPasswordSheetProps) {
  const [mode, setMode] = useState<StrictSheetMode>(initialMode);
  const [draft, setDraft] = useState<PasswordDraft>(initialDraft ?? emptyPasswordDraft());
  const [currentPassword, setCurrentPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const input = { hasPassword, mode, currentPassword, draft };
  const choice = strictSheetChoice(input);
  const changing = hasPassword && mode === "new";
  const askingForPassword = !hasPassword || changing;

  async function applyChoice(picked: StrictPasswordChoice | null) {
    if (picked === null || busy) return;
    setBusy(true);
    setError("");
    const outcome = await applyStrictPasswordChoice(picked, hasPassword, (message) =>
      sendPasswordMessage({ type: "password/set", ...message }),
    );
    setBusy(false);
    if (outcome.ok) onDone();
    else setError(outcome.message);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void applyChoice(choice);
  }

  return (
    <Sheet
      open
      title={hasPassword ? "Use your password for this session?" : "Protect this session with a password"}
      onClose={() => {
        if (!busy) onCancel();
      }}
      footer={
        <>
          <Button
            variant="primary"
            wide
            type="submit"
            form="strict-password-form"
            disabled={busy || choice === null}
          >
            {busy ? "Saving…" : strictSheetPrimaryLabel(input)}
          </Button>
          {!hasPassword && (
            <Button wide onClick={() => void applyChoice({ kind: "skip" })} disabled={busy}>
              Start without a password
            </Button>
          )}
          {hasPassword && !changing && (
            <Button wide onClick={() => setMode("new")} disabled={busy}>
              Set a new password
            </Button>
          )}
          {changing && (
            <Button wide onClick={() => setMode("keep")} disabled={busy}>
              Use my password instead
            </Button>
          )}
          <Button variant="quiet" wide onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
        </>
      }
    >
      <form id="strict-password-form" className="fg-stack" onSubmit={submit}>
        {hasPassword ? (
          <p className="fg-muted">
            Stopping early will need your password. Use the one you set before, or set a new one.
          </p>
        ) : (
          <p className="fg-muted">
            Stopping early needs the password if you set one. Without one it needs the phrase “I GIVE
            UP” and a 15-second wait.
          </p>
        )}
        {changing && (
          <PasswordField
            id="strict-current-password"
            label="Current password"
            helper="Paste is disabled for this verification field."
            value={currentPassword}
            onChange={(value) => {
              setCurrentPassword(value);
              setError("");
            }}
            disabled={busy}
            blockPaste
          />
        )}
        {askingForPassword && (
          <PasswordPicker
            idPrefix="strict-password"
            draft={draft}
            onChange={(next) => {
              setDraft(next);
              setError("");
            }}
            passwordLabel={changing ? "New password" : "Password"}
            disabled={busy}
          />
        )}
        {error && (
          <p className="fg-field__error" role="alert">
            {error}
          </p>
        )}
      </form>
    </Sheet>
  );
}
