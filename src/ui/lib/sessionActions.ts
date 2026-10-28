import type { SessionMessage } from "../../background/messages.ts";
import type { SessionState } from "../../shared/types.ts";

export type SessionReply =
  | { ok: true; session: SessionState }
  | {
      ok: false;
      code?: string;
      message?: string;
      waitMs?: number;
    };

export async function sendSessionMessage(
  message: SessionMessage,
): Promise<SessionReply> {
  if (
    typeof chrome === "undefined" ||
    !chrome.runtime?.sendMessage ||
    !chrome.runtime.id
  ) {
    return {
      ok: false,
      code: "EXTENSION_UNAVAILABLE",
      message: "Open this page from the FocusGate extension to control a session.",
    };
  }
  try {
    return (await chrome.runtime.sendMessage(message)) as SessionReply;
  } catch {
    return {
      ok: false,
      code: "SESSION_ACTION_FAILED",
      message: "The session action could not be completed. Try again.",
    };
  }
}
