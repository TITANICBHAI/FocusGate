import type { PasswordMessage } from "../../background/messages.ts";
import type { PasswordActionResult } from "../../background/passwordActions.ts";

export async function sendPasswordMessage(
  message: PasswordMessage,
): Promise<PasswordActionResult> {
  if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) {
    return {
      ok: false,
      code: "UNAVAILABLE",
      message: "The password action is unavailable. Reopen FocusGate and try again.",
    };
  }

  try {
    const response: unknown = await chrome.runtime.sendMessage(message);
    if (
      response &&
      typeof response === "object" &&
      "ok" in response &&
      typeof response.ok === "boolean"
    ) {
      return response as PasswordActionResult;
    }
  } catch {
    // Keep runtime errors out of the UI; the user can retry the action.
  }

  return {
    ok: false,
    code: "UNAVAILABLE",
    message: "The password action is unavailable. Reopen FocusGate and try again.",
  };
}
