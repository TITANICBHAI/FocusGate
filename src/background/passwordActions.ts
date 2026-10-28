import { guard } from "../shared/gating.ts";
import {
  hashPassword as hashPasswordDefault,
  verifyPassword as verifyPasswordDefault,
} from "../shared/password.ts";
import type {
  AppState,
  PasswordRecord,
  PasswordState,
} from "../shared/types.ts";

export type PasswordActionResult =
  | { ok: true; passwordSet: boolean }
  | { ok: false; code: string; message: string };

export interface PasswordActionStore {
  readState(): Promise<AppState>;
  writeState(patch: Partial<AppState>): Promise<void>;
}

export interface PasswordActionDependencies {
  store: PasswordActionStore;
  now(): number;
  hashPassword?(password: string): Promise<PasswordRecord>;
  verifyPassword?: typeof verifyPasswordDefault;
}

export interface PasswordActionService {
  setPassword(input: {
    currentPassword?: string;
    newPassword: string;
  }): Promise<PasswordActionResult>;
  removePassword(input: {
    currentPassword?: string;
  }): Promise<PasswordActionResult>;
}

function samePassword(left: PasswordState, right: PasswordState): boolean {
  if (left === null || right === null) return left === right;
  if (left.algo !== right.algo || left.hash !== right.hash) return false;
  if (left.algo === "sha256-legacy" || right.algo === "sha256-legacy") {
    return left.algo === right.algo;
  }
  return left.iter === right.iter && left.salt === right.salt;
}

function guardState(state: AppState, now: number) {
  return {
    session: state.session,
    standalone: state.standalone,
    hasPassword: state.password !== null,
    now,
  };
}

function lockedResult(reason: string): PasswordActionResult {
  return { ok: false, code: "LOCKED", message: reason };
}

function passwordRequired(): PasswordActionResult {
  return {
    ok: false,
    code: "PASSWORD_REQUIRED",
    message: "Enter your current password to continue.",
  };
}

export function createPasswordActionService(
  dependencies: PasswordActionDependencies,
): PasswordActionService {
  let queue: Promise<void> = Promise.resolve();
  const hashPassword = dependencies.hashPassword ?? hashPasswordDefault;
  const verifyPassword = dependencies.verifyPassword ?? verifyPasswordDefault;

  function exclusive<T>(operation: () => Promise<T>): Promise<T> {
    const result = queue.then(operation, operation);
    queue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  async function verifyCurrentPassword(
    state: AppState,
    input: string | undefined,
  ): Promise<PasswordActionResult | null> {
    if (!state.password) return null;
    if (!input) return passwordRequired();
    try {
      const result = await verifyPassword(input, state.password);
      return result.valid
        ? null
        : {
            ok: false,
            code: "BAD_PASSWORD",
            message: "That password is not correct.",
          };
    } catch {
      return {
        ok: false,
        code: "PASSWORD_VERIFICATION_FAILED",
        message: "The password could not be verified.",
      };
    }
  }

  async function updatePassword(
    nextPassword: string | null,
    currentPassword?: string,
  ): Promise<PasswordActionResult> {
    return exclusive(async () => {
      const initial = await dependencies.store.readState();
      const action = nextPassword === null ? "remove_password" : "change_password";
      const decision = guard(action, guardState(initial, dependencies.now()));
      if (decision.result === "locked") return lockedResult(decision.reason);

      if (decision.result === "password" || initial.password !== null) {
        const verificationFailure = await verifyCurrentPassword(
          initial,
          currentPassword,
        );
        if (verificationFailure) return verificationFailure;
      }

      let nextRecord: PasswordState = null;
      if (nextPassword !== null) {
        if (
          typeof nextPassword !== "string" ||
          nextPassword.length < 8 ||
          nextPassword.length > 64
        ) {
          return {
            ok: false,
            code: "INVALID_PASSWORD",
            message: "Use a password between 8 and 64 characters.",
          };
        }
        try {
          nextRecord = await hashPassword(nextPassword);
        } catch {
          return {
            ok: false,
            code: "PASSWORD_HASH_FAILED",
            message: "The new password could not be saved.",
          };
        }
      }

      const latest = await dependencies.store.readState();
      if (!samePassword(initial.password, latest.password)) {
        return {
          ok: false,
          code: "PASSWORD_STATE_CHANGED",
          message: "Password settings changed. Review them and try again.",
        };
      }
      const latestDecision = guard(
        action,
        guardState(latest, dependencies.now()),
      );
      if (latestDecision.result === "locked") {
        return lockedResult(latestDecision.reason);
      }

      await dependencies.store.writeState({ password: nextRecord });
      return { ok: true, passwordSet: nextRecord !== null };
    });
  }

  return {
    setPassword: ({ currentPassword, newPassword }) =>
      updatePassword(newPassword, currentPassword),
    removePassword: ({ currentPassword }) =>
      updatePassword(null, currentPassword),
  };
}
