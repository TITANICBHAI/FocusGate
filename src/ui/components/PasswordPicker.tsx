import { useState } from "react";
import { PASSWORD_MAX_LENGTH } from "../../shared/password.ts";
import {
  confirmHelper,
  emptyPasswordDraft,
  generatedPasswordDraft,
  passwordHelper,
  typedPasswordDraft,
} from "../lib/passwordDraft.ts";
import type { PasswordDraft } from "../lib/passwordDraft.ts";
import { spokenPassword } from "../lib/spokenPassword.ts";
import { Button, PasswordField } from "./primitives.tsx";

/** A password shown in plain sight, and read to a screen reader one character at a time. */
export function PasswordReveal({ label, password }: { label: string; password: string }) {
  return (
    <div className="fg-password-reveal" role="status">
      <span className="fg-password-reveal__label">{label}</span>
      <span className="fg-password-reveal__value" aria-hidden="true">
        {password}
      </span>
      <span className="fg-sr-only">{spokenPassword(password)}</span>
    </div>
  );
}

/**
 * Choosing a password: type your own twice, or generate one and see it.
 *
 * A generated password is shown in plain sight, once, with a way to copy it. Only a
 * scrambled copy is kept, so the screen says to write it down. Typing in either
 * field goes back to choosing your own.
 */
export function PasswordPicker({
  idPrefix,
  draft,
  onChange,
  passwordLabel = "Password",
  disabled = false,
}: {
  idPrefix: string;
  draft: PasswordDraft;
  onChange(draft: PasswordDraft): void;
  /** "New password" when this replaces an existing one. */
  passwordLabel?: string;
  disabled?: boolean;
}) {
  const [copyResult, setCopyResult] = useState<{ password: string; ok: boolean } | null>(null);
  const [generateFailed, setGenerateFailed] = useState(false);
  // A different password on screen has not been copied yet.
  const thisCopy = copyResult !== null && copyResult.password === draft.password ? copyResult : null;

  function generate() {
    try {
      onChange(generatedPasswordDraft());
      setGenerateFailed(false);
    } catch {
      setGenerateFailed(true);
    }
  }

  async function copy() {
    let ok = false;
    try {
      await navigator.clipboard.writeText(draft.password);
      ok = true;
    } catch {
      ok = false;
    }
    setCopyResult({ password: draft.password, ok });
  }

  if (draft.generated) {
    return (
      <div className="fg-stack fg-password-picker">
        <PasswordReveal label="Your new password" password={draft.password} />
        <p className="fg-muted">
          Write it down or save it now. FocusGate keeps only a scrambled copy, so it will not
          show this password again.
        </p>
        <div className="fg-password-picker__actions">
          <Button onClick={() => void copy()} disabled={disabled}>
            {thisCopy?.ok ? "Copied" : "Copy password"}
          </Button>
          <Button variant="quiet" onClick={generate} disabled={disabled}>
            Generate another
          </Button>
          <Button variant="quiet" onClick={() => onChange(emptyPasswordDraft())} disabled={disabled}>
            Choose my own instead
          </Button>
        </div>
        {thisCopy !== null && !thisCopy.ok && (
          <p className="fg-muted" role="status">
            Copying did not work here. Write the password down instead.
          </p>
        )}
        {generateFailed && (
          <p className="fg-muted" role="status">
            A password could not be generated in this browser. Choose your own instead.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="fg-stack fg-password-picker">
      <PasswordField
        id={`${idPrefix}-new`}
        label={passwordLabel}
        helper={passwordHelper(draft.password)}
        value={draft.password}
        onChange={(value) => onChange(typedPasswordDraft(draft, "password", value))}
        autoComplete="new-password"
        maxLength={PASSWORD_MAX_LENGTH}
        disabled={disabled}
      />
      <PasswordField
        id={`${idPrefix}-confirm`}
        label="Confirm password"
        helper={confirmHelper(draft)}
        value={draft.confirmation}
        onChange={(value) => onChange(typedPasswordDraft(draft, "confirmation", value))}
        autoComplete="new-password"
        maxLength={PASSWORD_MAX_LENGTH}
        disabled={disabled}
      />
      <div className="fg-password-picker__actions">
        <Button onClick={generate} disabled={disabled}>
          Generate a password
        </Button>
      </div>
      {generateFailed && (
        <p className="fg-muted" role="status">
          A password could not be generated in this browser. Type your own instead.
        </p>
      )}
    </div>
  );
}
