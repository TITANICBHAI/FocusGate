import type { SessionService } from "./session.ts";
import type {
  PasswordActionResult,
  PasswordActionService,
} from "./passwordActions.ts";
import type {
  GuardedStateWriteResult,
  GuardedStateWriteService,
} from "./guardedStateWrites.ts";
import type { GuardedStateKey } from "../shared/guardMutations.ts";
import type {
  StandaloneActionResult,
  StandaloneActionService,
} from "./standaloneActions.ts";
import type {
  DataActionResult,
  DataActionService,
} from "./dataActions.ts";

export type SessionMessage =
  | {
      type: "session/start";
      durationMin: number;
      lockLevel: "none" | "strict" | "commitment";
      taskId?: string;
    }
  | { type: "session/stop"; password?: string; phrase?: string }
  | { type: "session/extend"; minutes: number }
  | { type: "session/skipBreak" };

export type SessionMessageResponse =
  | { ok: true; session: Awaited<ReturnType<SessionService["getState"]>>["session"] }
  | { ok: false; code: string; message: string; waitMs?: number };

export type PasswordMessage =
  | {
      type: "password/set";
      currentPassword?: string;
      newPassword: string;
    }
  | { type: "password/remove"; currentPassword?: string };

export type GuardedStateWriteMessage =
  | {
      type: "state/write";
      key: GuardedStateKey;
      value: unknown;
      currentPassword?: string;
    };

/**
 * Returns a v2 message handler for the eventual WP5 cutover. This module does
 * not register runtime listeners, so the active v1 worker remains untouched.
 */
export function createSessionMessageHandler(
  service: SessionService,
): (message: unknown) => Promise<SessionMessageResponse> {
  return async (message) => {
    if (!isKnownSessionMessageType(message)) {
      return {
        ok: false,
        code: "UNKNOWN_MESSAGE",
        message: "This session action is not supported.",
      };
    }
    if (!isSessionMessage(message)) {
      return {
        ok: false,
        code: "INVALID_MESSAGE",
        message: "Invalid session message.",
      };
    }

    try {
      switch (message.type) {
        case "session/start": {
          const { durationMin, lockLevel, taskId } = message;
          return await service.start({
            durationMin,
            lockLevel,
            ...(taskId !== undefined ? { taskId } : {}),
          });
        }
        case "session/stop": {
          const { password, phrase } = message;
          return await service.stop({
            ...(password !== undefined ? { password } : {}),
            ...(phrase !== undefined ? { phrase } : {}),
          });
        }
        case "session/extend":
          return await service.extend(message.minutes);
        case "session/skipBreak":
          return await service.skipBreak();
      }
    } catch {
      return {
        ok: false,
        code: "SESSION_ACTION_FAILED",
        message: "The session action could not be completed. Try again.",
      };
    }
  };
}

export type StandaloneMessage =
  | { type: "standalone/start"; until: number; sites: string[] }
  | { type: "standalone/extend"; minutes: number }
  | { type: "standalone/addSites"; sites: string[] };

export type DataActionMessage =
  | { type: "backup/import"; json: string }
  | { type: "data/reset"; confirm: string; password?: string };

/**
 * Staged standalone handler. It intentionally has no stop/end message.
 */
export function createStandaloneMessageHandler(
  service: StandaloneActionService,
): (message: unknown) => Promise<StandaloneActionResult> {
  return async (message) => {
    if (!isKnownStandaloneMessageType(message)) {
      return {
        ok: false,
        code: "UNKNOWN_MESSAGE",
        message: "This standalone action is not supported.",
      };
    }
    if (!isStandaloneMessage(message)) {
      return {
        ok: false,
        code: "INVALID_MESSAGE",
        message: "Invalid standalone block action.",
      };
    }
    try {
      switch (message.type) {
        case "standalone/start":
          return await service.start({
            until: message.until,
            sites: message.sites,
          });
        case "standalone/extend":
          return await service.extend(message.minutes);
        case "standalone/addSites":
          return await service.addSites(message.sites);
      }
    } catch {
      return {
        ok: false,
        code: "STANDALONE_ACTION_FAILED",
        message: "The standalone block could not be updated. Try again.",
      };
    }
  };
}

function isStandaloneMessage(message: unknown): message is StandaloneMessage {
  if (!message || typeof message !== "object") return false;
  const candidate = message as Record<string, unknown>;
  if (candidate.type === "standalone/start") {
    return (
      Number.isSafeInteger(candidate.until) &&
      Array.isArray(candidate.sites) &&
      candidate.sites.every((site) => typeof site === "string")
    );
  }
  if (candidate.type === "standalone/extend") {
    return Number.isInteger(candidate.minutes);
  }
  if (candidate.type === "standalone/addSites") {
    return (
      Array.isArray(candidate.sites) &&
      candidate.sites.every((site) => typeof site === "string")
    );
  }
  return false;
}

function isKnownStandaloneMessageType(message: unknown): boolean {
  if (!message || typeof message !== "object") return false;
  const type = (message as Record<string, unknown>).type;
  return (
    type === "standalone/start" ||
    type === "standalone/extend" ||
    type === "standalone/addSites"
  );
}

/**
 * Staged backup/reset handler. It remains unregistered until WP5 cutover.
 */
export function createDataActionMessageHandler(
  service: DataActionService,
): (message: unknown) => Promise<DataActionResult> {
  return async (message) => {
    if (!isKnownDataActionMessageType(message)) {
      return {
        ok: false,
        code: "UNKNOWN_MESSAGE",
        message: "This data action is not supported.",
      };
    }
    if (!isDataActionMessage(message)) {
      return {
        ok: false,
        code: "INVALID_MESSAGE",
        message: "Invalid data action.",
      };
    }
    try {
      if (message.type === "backup/import") {
        return await service.importBackup(message.json);
      }
      return await service.resetData({
        confirm: message.confirm,
        ...(message.password !== undefined
          ? { password: message.password }
          : {}),
      });
    } catch {
      return {
        ok: false,
        code: "DATA_ACTION_FAILED",
        message: "The data action could not be completed. Try again.",
      };
    }
  };
}

function isDataActionMessage(message: unknown): message is DataActionMessage {
  if (!message || typeof message !== "object") return false;
  const candidate = message as Record<string, unknown>;
  if (candidate.type === "backup/import") {
    return typeof candidate.json === "string";
  }
  if (candidate.type === "data/reset") {
    return (
      typeof candidate.confirm === "string" &&
      (candidate.password === undefined ||
        typeof candidate.password === "string")
    );
  }
  return false;
}

function isKnownDataActionMessageType(message: unknown): boolean {
  if (!message || typeof message !== "object") return false;
  const type = (message as Record<string, unknown>).type;
  return type === "backup/import" || type === "data/reset";
}

/**
 * Command callback for the v2 worker. Install it only after the WP5 cutover.
 */
export function createToggleFocusCommandHandler(
  service: SessionService,
): (command: string) => Promise<boolean> {
  return async (command) => {
    if (command !== "toggle-focus") return false;
    try {
      await service.toggleFromShortcut();
    } catch {
      // The service owns and reports browser side-effect failures. A command
      // callback must not leave a rejected promise in Chrome's event dispatch.
    }
    return true;
  };
}

/**
 * Password changes are enforced by the dormant v2 background service. Keep
 * this handler unregistered until the WP5 atomic cutover.
 */
export function createPasswordMessageHandler(
  service: PasswordActionService,
): (message: unknown) => Promise<PasswordActionResult> {
  return async (message) => {
    if (!isKnownPasswordMessageType(message)) {
      return {
        ok: false,
        code: "UNKNOWN_MESSAGE",
        message: "This password action is not supported.",
      };
    }
    if (!isPasswordMessage(message)) {
      return {
        ok: false,
        code: "INVALID_MESSAGE",
        message: "Invalid password message.",
      };
    }

    try {
      switch (message.type) {
        case "password/set":
          return await service.setPassword({
            ...(message.currentPassword !== undefined
              ? { currentPassword: message.currentPassword }
              : {}),
            newPassword: message.newPassword,
          });
        case "password/remove":
          return await service.removePassword({
            ...(message.currentPassword !== undefined
              ? { currentPassword: message.currentPassword }
              : {}),
          });
      }
    } catch {
      return {
        ok: false,
        code: "PASSWORD_ACTION_FAILED",
        message: "The password action could not be completed. Try again.",
      };
    }
  };
}

/**
 * This v2 handler is installed only at the WP5 cutover. It is the sole UI
 * message path for edits to user-configurable state.
 */
export function createGuardedStateWriteMessageHandler(
  service: GuardedStateWriteService,
): (message: unknown) => Promise<GuardedStateWriteResult> {
  return async (message) => {
    if (!isKnownStateWriteMessageType(message)) {
      return {
        ok: false,
        code: "UNKNOWN_MESSAGE",
        message: "This settings change is not supported.",
      };
    }
    if (!isStateWriteMessage(message)) {
      return {
        ok: false,
        code: "INVALID_MESSAGE",
        message: "Invalid settings change.",
      };
    }
    try {
      return await service.write({
        key: message.key,
        value: message.value,
        ...(message.currentPassword !== undefined
          ? { currentPassword: message.currentPassword }
          : {}),
      });
    } catch {
      return {
        ok: false,
        code: "STATE_WRITE_FAILED",
        message: "The settings change could not be saved. Try again.",
      };
    }
  };
}

function isSessionMessage(message: unknown): message is SessionMessage {
  if (!message || typeof message !== "object") return false;
  const candidate = message as Record<string, unknown>;
  switch (candidate.type) {
    case "session/start":
      return (
        Number.isInteger(candidate.durationMin) &&
        (candidate.lockLevel === "none" ||
          candidate.lockLevel === "strict" ||
          candidate.lockLevel === "commitment") &&
        (candidate.taskId === undefined || typeof candidate.taskId === "string")
      );
    case "session/stop":
      return (
        (candidate.password === undefined ||
          typeof candidate.password === "string") &&
        (candidate.phrase === undefined || typeof candidate.phrase === "string")
      );
    case "session/extend":
      return Number.isInteger(candidate.minutes);
    case "session/skipBreak":
      return true;
    default:
      return false;
  }
}

function isKnownSessionMessageType(message: unknown): boolean {
  if (!message || typeof message !== "object") return false;
  const type = (message as Record<string, unknown>).type;
  return (
    type === "session/start" ||
    type === "session/stop" ||
    type === "session/extend" ||
    type === "session/skipBreak"
  );
}

function isPasswordMessage(message: unknown): message is PasswordMessage {
  if (!message || typeof message !== "object") return false;
  const candidate = message as Record<string, unknown>;
  switch (candidate.type) {
    case "password/set":
      return (
        typeof candidate.newPassword === "string" &&
        (candidate.currentPassword === undefined ||
          typeof candidate.currentPassword === "string")
      );
    case "password/remove":
      return (
        candidate.currentPassword === undefined ||
        typeof candidate.currentPassword === "string"
      );
    default:
      return false;
  }
}

function isKnownPasswordMessageType(message: unknown): boolean {
  if (!message || typeof message !== "object") return false;
  const type = (message as Record<string, unknown>).type;
  return type === "password/set" || type === "password/remove";
}

const GUARDED_STATE_KEYS: readonly GuardedStateKey[] = [
  "blockedSites",
  "alwaysBlockedSites",
  "keywords",
  "exceptions",
  "schedules",
  "allowances",
  "tasks",
  "settings",
];

function isStateWriteMessage(
  message: unknown,
): message is GuardedStateWriteMessage {
  if (!message || typeof message !== "object") return false;
  const candidate = message as Record<string, unknown>;
  return (
    candidate.type === "state/write" &&
    typeof candidate.key === "string" &&
    GUARDED_STATE_KEYS.includes(candidate.key as GuardedStateKey) &&
    "value" in candidate &&
    (candidate.currentPassword === undefined ||
      typeof candidate.currentPassword === "string")
  );
}

function isKnownStateWriteMessageType(message: unknown): boolean {
  if (!message || typeof message !== "object") return false;
  return (message as Record<string, unknown>).type === "state/write";
}
