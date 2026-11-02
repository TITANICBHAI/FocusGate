import { useState } from "react";
import type { FormEvent } from "react";
import { guard } from "../../shared/gating.ts";
import { generatePassword } from "../../shared/password.ts";
import type { AppState } from "../../shared/types.ts";
import { Button, Card, PasswordField } from "../components/primitives.tsx";
import { sendPasswordMessage } from "../lib/passwordActions.ts";

function passwordGuidance(value: string): string {
  if (!value) {
    return "Use 8–64 characters. A longer, unique passphrase is recommended.";
  }
  if (value.length < 8) {
    return `Add ${8 - value.length} more character${8 - value.length === 1 ? "" : "s"} to meet the minimum.`;
  }
  if (value.length < 16) {
    return "This meets the minimum. A longer, unique password is recommended.";
  }
  return "Good length. Avoid reusing this password on other accounts.";
}

export function passwordFormDisabled(
  password: string,
  confirmation: string,
  busy: boolean,
  locked: boolean,
): boolean {
  return (
    busy ||
    locked ||
    password.length < 8 ||
    password.length > 64 ||
    password !== confirmation
  );
}

export function PasswordSettings({ state }: { state: AppState }) {
  const hasPassword = state.password !== null;
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const decision = guard("change_password", {
    session: state.session,
    standalone: state.standalone,
    hasPassword,
    now: Date.now(),
  });
  const lockReason =
    decision.result === "locked"
      ? `Password changes are locked until ${new Date(
          decision.until ?? Date.now(),
        ).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}.`
      : "";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    if (newPassword.length < 8 || newPassword.length > 64) {
      setMessage("Use a password between 8 and 64 characters.");
      return;
    }
    if (newPassword !== confirmation) {
      setMessage("The new passwords do not match.");
      return;
    }

    setBusy(true);
    const result = await sendPasswordMessage({
      type: "password/set",
      ...(hasPassword ? { currentPassword } : {}),
      newPassword,
    });
    setBusy(false);
    setMessage(
      result.ok
        ? "Password saved."
        : result.message || "The password could not be saved.",
    );
    if (result.ok) {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmation("");
    }
  }

  async function removePassword() {
    setMessage("");
    setBusy(true);
    const result = await sendPasswordMessage({
      type: "password/remove",
      currentPassword,
    });
    setBusy(false);
    setMessage(
      result.ok
        ? "Password removed."
        : result.message || "The password could not be removed.",
    );
    if (result.ok) setCurrentPassword("");
  }

  function generate() {
    try {
      const generated = generatePassword();
      setNewPassword(generated);
      setConfirmation(generated);
      setMessage("Generated password filled in both fields. Save it somewhere safe.");
    } catch {
      setMessage("A secure password could not be generated in this browser.");
    }
  }

  return (
    <Card title="Password protection">
      <p className="fg-muted">
        A password is needed to weaken protection and can confirm ending a Strict
        session early. It does not prevent this extension from being disabled or
        removed.
      </p>
      {hasPassword && (
        <PasswordField
          id="current-password"
          label="Current password"
          helper="Paste is disabled for this verification field."
          value={currentPassword}
          onChange={setCurrentPassword}
          blockPaste
        />
      )}
      <form className="fg-stack" onSubmit={(event) => void submit(event)}>
        <PasswordField
          id="new-password"
          label={hasPassword ? "New password" : "Password"}
          helper={passwordGuidance(newPassword)}
          value={newPassword}
          onChange={setNewPassword}
          autoComplete="new-password"
          maxLength={64}
        />
        <PasswordField
          id="confirm-password"
          label="Confirm password"
          helper="Re-enter the password to confirm it."
          value={confirmation}
          onChange={setConfirmation}
          autoComplete="new-password"
          maxLength={64}
        />
        <Button
          type="button"
          variant="secondary"
          onClick={generate}
          disabled={busy || Boolean(lockReason)}
        >
          Generate (recommended)
        </Button>
        <Button
          type="submit"
          disabled={passwordFormDisabled(
            newPassword,
            confirmation,
            busy,
            Boolean(lockReason),
          )}
        >
          {busy ? "Saving…" : hasPassword ? "Change password" : "Set password"}
        </Button>
      </form>
      {hasPassword && (
        <Button
          variant="danger"
          onClick={() => void removePassword()}
          disabled={busy || Boolean(lockReason)}
        >
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
