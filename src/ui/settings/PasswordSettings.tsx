import { useState } from "react";
import type { FormEvent } from "react";
import { guard } from "../../shared/gating.ts";
import type { AppState } from "../../shared/types.ts";
import { PasswordPicker } from "../components/PasswordPicker.tsx";
import { Button, Card, PasswordField } from "../components/primitives.tsx";
import { sendPasswordMessage } from "../lib/passwordActions.ts";
import { emptyPasswordDraft, passwordDraftError } from "../lib/passwordDraft.ts";
import type { PasswordDraft } from "../lib/passwordDraft.ts";

export function PasswordSettings({ state }: { state: AppState }) {
  const hasPassword = state.password !== null;
  const [currentPassword, setCurrentPassword] = useState("");
  const [draft, setDraft] = useState<PasswordDraft>(emptyPasswordDraft);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const decision = guard("change_password", {
    session: state.session,
    standalone: state.standalone,
    hasPassword: hasPassword,
    now: Date.now(),
  });
  const lockReason =
    decision.result === "locked"
      ? `Password changes are locked until ${new Date(
          decision.until ?? Date.now(),
        ).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}.`
      : "";
  const locked = Boolean(lockReason);
  const draftError = passwordDraftError(draft);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    if (draftError) {
      setMessage(draftError);
      return;
    }

    setBusy(true);
    const result = await sendPasswordMessage({
      type: "password/set",
      ...(hasPassword ? { currentPassword: currentPassword } : {}),
      newPassword: draft.password,
    });
    setBusy(false);
    setMessage(result.ok ? "Password saved." : result.message || "The password could not be saved.");
    if (result.ok) {
      setCurrentPassword("");
      setDraft(emptyPasswordDraft());
    }
  }

  async function removePassword() {
    setMessage("");
    setBusy(true);
    const result = await sendPasswordMessage({
      type: "password/remove",
      currentPassword: currentPassword,
    });
    setBusy(false);
    setMessage(result.ok ? "Password removed." : result.message || "The password could not be removed.");
    if (result.ok) setCurrentPassword("");
  }

  const saveLabel = draft.generated
    ? hasPassword
      ? "I have saved it, change password"
      : "I have saved it, set password"
    : hasPassword
      ? "Change password"
      : "Set password";

  return (
    <Card title="Password">
      <p className="fg-muted">
        A password is needed to remove or relax your rules, to end a Strict session early and to
        reset your data. It does not prevent this extension from being disabled or
        removed.
      </p>
      <ul className="fg-password-covers">
        <li>Removing or loosening sites, keywords, schedules and limits</li>
        <li>Ending a Strict session early</li>
        <li>Changing or removing the password, and resetting your data</li>
      </ul>
      <p className="fg-muted">
        During a Strict or Commit session, or a Block now window, these stay locked even with
        the password.
      </p>
      {hasPassword && (
        <PasswordField
          id="current-password"
          label="Current password"
          helper="Paste is disabled for this verification field."
          value={currentPassword}
          onChange={setCurrentPassword}
          disabled={busy || locked}
          blockPaste
        />
      )}
      <form className="fg-stack" onSubmit={(event) => void submit(event)}>
        <PasswordPicker
          idPrefix="settings-password"
          draft={draft}
          onChange={setDraft}
          passwordLabel={hasPassword ? "New password" : "Password"}
          disabled={busy || locked}
        />
        <Button type="submit" variant="primary" disabled={busy || locked || draftError !== null}>
          {busy ? "Saving…" : saveLabel}
        </Button>
      </form>
      {hasPassword && (
        <Button variant="danger" onClick={() => void removePassword()} disabled={busy || locked}>
          Remove password
        </Button>
      )}
      {lockReason && <p className="fg-note">{lockReason}</p>}
      {decision.result === "password" && (
        <p className="fg-muted">Enter your current password to continue.</p>
      )}
      {message && (
        <p className="fg-muted" role="status">
          {message}
        </p>
      )}
    </Card>
  );
}
