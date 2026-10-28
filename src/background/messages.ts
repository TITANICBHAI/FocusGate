import type { SessionService } from "./session.ts";

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

/**
 * Returns a v2 message handler for the eventual WP5 cutover. This module does
 * not register runtime listeners, so the active v1 worker remains untouched.
 */
export function createSessionMessageHandler(
  service: SessionService,
): (message: unknown) => Promise<SessionMessageResponse> {
  return async (message) => {
    if (!isSessionMessage(message)) {
      return {
        ok: false,
        code: "UNKNOWN_MESSAGE",
        message: "This session action is not supported.",
      };
    }

    try {
      switch (message.type) {
        case "session/start":
          return await service.start(message);
        case "session/stop":
          return await service.stop(message);
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
