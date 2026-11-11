import {
  generatePassword,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from "../../shared/password.ts";

/** From this length on, the helper says "Good" instead of "This works". */
const GOOD_PASSWORD_LENGTH = 12;

/**
 * A password being chosen, before it is saved. Used wherever a person sets one:
 * Settings, the Strict-session sheet and setup.
 */
export interface PasswordDraft {
  password: string;
  confirmation: string;
  /** True while the password on screen was generated: it is shown to them, not typed. */
  generated: boolean;
}

export function emptyPasswordDraft(): PasswordDraft {
  return { password: "", confirmation: "", generated: false };
}

/** A random password, already confirmed, ready to be shown and saved. */
export function generatedPasswordDraft(password: string = generatePassword()): PasswordDraft {
  return { password, confirmation: password, generated: true };
}

/** Typing replaces a generated password: what they type is theirs, so it is not "generated" any more. */
export function typedPasswordDraft(
  draft: PasswordDraft,
  field: "password" | "confirmation",
  value: string,
): PasswordDraft {
  return { ...draft, [field]: value, generated: false };
}

/** Why this draft is not ready to save, or null when it is. */
export function passwordDraftError(draft: PasswordDraft): string | null {
  if (draft.password.length < PASSWORD_MIN_LENGTH) {
    return `Use at least ${PASSWORD_MIN_LENGTH} characters.`;
  }
  if (draft.password.length > PASSWORD_MAX_LENGTH) {
    return `Use at most ${PASSWORD_MAX_LENGTH} characters.`;
  }
  if (draft.confirmation !== draft.password) return "The passwords do not match.";
  return null;
}

/** The line under the password field: what is allowed, then how close it is, then how good it is. */
export function passwordHelper(value: string): string {
  if (value.length === 0) {
    return `Use ${PASSWORD_MIN_LENGTH}–${PASSWORD_MAX_LENGTH} characters, or generate one.`;
  }
  if (value.length < PASSWORD_MIN_LENGTH) {
    const missing = PASSWORD_MIN_LENGTH - value.length;
    return `Add ${missing} more character${missing === 1 ? "" : "s"} to reach the minimum of ${PASSWORD_MIN_LENGTH}.`;
  }
  if (value.length > PASSWORD_MAX_LENGTH) return `Use at most ${PASSWORD_MAX_LENGTH} characters.`;
  if (value.length < GOOD_PASSWORD_LENGTH) {
    return "This works. A longer password is harder to guess.";
  }
  return "Good. Make sure you can remember it or have it saved.";
}

/** The line under the confirmation field: asks for it, then says whether it matches. */
export function confirmHelper(draft: PasswordDraft): string {
  if (draft.confirmation === "") return "Type it again to confirm.";
  return draft.confirmation === draft.password ? "The passwords match." : "The passwords do not match.";
}
