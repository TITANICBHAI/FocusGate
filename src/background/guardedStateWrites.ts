import { guard } from "../shared/gating.ts";
import {
  classifyStateMutation,
  type GuardedStateKey,
} from "../shared/guardMutations.ts";
import { verifyPassword as verifyPasswordDefault } from "../shared/password.ts";
import type { AppState, PasswordState } from "../shared/types.ts";

export interface GuardedStateWriteStore {
  readState(): Promise<AppState>;
  writeState(patch: Partial<AppState>): Promise<void>;
}

export type GuardedStateWriteResult =
  | { ok: true }
  | { ok: false; code: string; message: string };

export interface GuardedStateWriteDependencies {
  store: GuardedStateWriteStore;
  now(): number;
  verifyPassword?: typeof verifyPasswordDefault;
}

export interface GuardedStateWriteService {
  write(input: {
    key: GuardedStateKey;
    value: unknown;
    currentPassword?: string;
  }): Promise<GuardedStateWriteResult>;
}

function samePassword(left: PasswordState, right: PasswordState): boolean {
  if (left === null || right === null) return left === right;
  if (left.algo !== right.algo || left.hash !== right.hash) return false;
  if (left.algo === "sha256-legacy" || right.algo === "sha256-legacy") {
    return left.algo === right.algo;
  }
  return left.iter === right.iter && left.salt === right.salt;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validValue(key: GuardedStateKey, value: unknown): boolean {
  switch (key) {
    case "blockedSites":
    case "alwaysBlockedSites":
    case "exceptions":
    case "keywords":
    case "schedules":
    case "tasks":
    case "customPresets":
      return Array.isArray(value);
    case "aliasExclusions":
    case "allowances":
    case "settings":
      return isRecord(value);
  }
}

function guardContext(state: AppState, now: number) {
  return {
    session: state.session,
    standalone: state.standalone,
    hasPassword: state.password !== null,
    now,
  };
}

function failed(code: string, message: string): GuardedStateWriteResult {
  return { ok: false, code, message };
}

export function createGuardedStateWriteService(
  dependencies: GuardedStateWriteDependencies,
): GuardedStateWriteService {
  let queue: Promise<void> = Promise.resolve();
  const verifyPassword = dependencies.verifyPassword ?? verifyPasswordDefault;

  function exclusive<T>(operation: () => Promise<T>): Promise<T> {
    const result = queue.then(operation, operation);
    queue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  return {
    write: (input) =>
      exclusive(async () => {
        if (!validValue(input.key, input.value)) {
          return failed("INVALID_STATE_WRITE", "This settings change is invalid.");
        }
        const initial = await dependencies.store.readState();
        const candidate = { ...initial, [input.key]: input.value } as AppState;
        const actions = classifyStateMutation(
          initial,
          candidate,
          dependencies.now(),
        );
        let passwordVerified = false;

        for (const action of actions) {
          const decision = guard(action, guardContext(initial, dependencies.now()));
          if (decision.result === "locked") {
            return failed("LOCKED", decision.reason);
          }
          if (decision.result === "password") {
            if (!initial.password) {
              return failed(
                "PASSWORD_REQUIRED",
                "Enter your current password to continue.",
              );
            }
            if (!input.currentPassword) {
              return failed(
                "PASSWORD_REQUIRED",
                "Enter your current password to continue.",
              );
            }
            try {
              const verification = await verifyPassword(
                input.currentPassword,
                initial.password,
              );
              if (!verification.valid) {
                return failed("BAD_PASSWORD", "That password is not correct.");
              }
              passwordVerified = true;
            } catch {
              return failed(
                "PASSWORD_VERIFICATION_FAILED",
                "The password could not be verified.",
              );
            }
          }
          if (decision.result === "confirm" || decision.result === "phrase") {
            return failed(
              "CONFIRMATION_REQUIRED",
              "This change needs a separate confirmation.",
            );
          }
        }

        const latest = await dependencies.store.readState();
        if (
          JSON.stringify(initial[input.key]) !== JSON.stringify(latest[input.key]) ||
          !samePassword(initial.password, latest.password)
        ) {
          return failed(
            "STATE_CHANGED",
            "Settings changed in another view. Review them and try again.",
          );
        }
        const latestCandidate = {
          ...latest,
          [input.key]: input.value,
        } as AppState;
        const latestActions = classifyStateMutation(
          latest,
          latestCandidate,
          dependencies.now(),
        );
        for (const action of latestActions) {
          const decision = guard(action, guardContext(latest, dependencies.now()));
          if (decision.result === "locked") {
            return failed("LOCKED", decision.reason);
          }
          if (decision.result === "password" && !passwordVerified) {
            return failed(
              "PASSWORD_REQUIRED",
              "Enter your current password to continue.",
            );
          }
        }

        await dependencies.store.writeState({
          [input.key]: input.value,
        } as Partial<AppState>);
        return { ok: true };
      }),
  };
}
