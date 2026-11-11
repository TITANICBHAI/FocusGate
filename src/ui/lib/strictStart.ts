import type { PasswordActionResult } from "../../background/passwordActions.ts";
import type { LockLevel } from "../../shared/types.ts";
import { passwordDraftError } from "./passwordDraft.ts";
import type { PasswordDraft } from "./passwordDraft.ts";

/*
 * Starting a Strict session asks about the password first, every time, so a person
 * always knows what stopping early will need. There is one password: the one in
 * Settings. "Use my password" keeps it, "Set a new password" replaces it (and needs the
 * current one), and with none saved they can set one or start with the phrase.
 */

/** Only a Strict session asks: Commit has no early stop, and None needs nothing. */
export function needsPasswordQuestion(lockLevel: LockLevel): boolean {
  return lockLevel === "strict";
}

/** With a password saved: use it ("keep") or replace it ("new"). Ignored when none is saved. */
export type StrictSheetMode = "keep" | "new";

export interface StrictSheetInput {
  hasPassword: boolean;
  mode: StrictSheetMode;
  /** The current password, typed to replace it. */
  currentPassword: string;
  draft: PasswordDraft;
}

export type StrictPasswordChoice =
  | { kind: "keep" }
  | { kind: "skip" }
  | { kind: "set"; password: string; currentPassword?: string };

/** What the main button will do, or null while nothing is ready. */
export function strictSheetChoice(input: StrictSheetInput): StrictPasswordChoice | null {
  if (input.hasPassword && input.mode === "keep") return { kind: "keep" };
  if (passwordDraftError(input.draft) !== null) return null;
  if (!input.hasPassword) return { kind: "set", password: input.draft.password };
  if (input.currentPassword === "") return null;
  return { kind: "set", password: input.draft.password, currentPassword: input.currentPassword };
}

export function strictSheetPrimaryLabel(input: StrictSheetInput): string {
  if (input.hasPassword && input.mode === "keep") return "Use my password and start";
  if (input.hasPassword) {
    return input.draft.generated
      ? "I have saved it, change password and start"
      : "Change password and start";
  }
  return input.draft.generated ? "I have saved it, start" : "Set password and start";
}

export type StrictPasswordOutcome = { ok: true } | { ok: false; message: string };

export type SetPassword = (input: {
  currentPassword?: string;
  newPassword: string;
}) => Promise<PasswordActionResult>;

/** Carries out the choice. Saving a password goes through the background, which checks the current one. */
export async function applyStrictPasswordChoice(
  choice: StrictPasswordChoice,
  hasPassword: boolean,
  setPassword: SetPassword,
): Promise<StrictPasswordOutcome> {
  switch (choice.kind) {
    case "keep":
      return hasPassword
        ? { ok: true }
        : { ok: false, message: "There is no saved password yet. Set one to continue." };
    case "skip":
      return hasPassword
        ? { ok: false, message: "A password is saved, so stopping early will ask for it." }
        : { ok: true };
    case "set": {
      if (hasPassword && !choice.currentPassword) {
        return { ok: false, message: "Enter your current password to set a new one." };
      }
      const result = await setPassword(
        hasPassword && choice.currentPassword
          ? { currentPassword: choice.currentPassword, newPassword: choice.password }
          : { newPassword: choice.password },
      );
      return result.ok
        ? { ok: true }
        : { ok: false, message: result.message || "The password could not be saved." };
    }
  }
}

/**
 * The question before a start, as a promise: `ask` resolves true when the
 * person has settled the password (or no question was needed) and false when they
 * cancelled. `onOpenChange` shows and hides the sheet.
 */
export function createStrictAsk(onOpenChange: (open: boolean) => void): {
  ask(lockLevel: LockLevel): Promise<boolean>;
  finish(proceed: boolean): void;
} {
  let pending: ((proceed: boolean) => void) | null = null;
  return {
    ask(lockLevel) {
      if (!needsPasswordQuestion(lockLevel)) return Promise.resolve(true);
      return new Promise<boolean>((resolve) => {
        const earlier = pending;
        pending = resolve;
        // A new question replaces one nobody answered; the sheet is already open.
        if (earlier) earlier(false);
        else onOpenChange(true);
      });
    },
    finish(proceed) {
      const answer = pending;
      if (!answer) return;
      pending = null;
      onOpenChange(false);
      answer(proceed);
    },
  };
}
