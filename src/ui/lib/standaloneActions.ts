import type { StandaloneMessage } from "../../background/messages.ts";
import type { StandaloneActionResult } from "../../background/standaloneActions.ts";

export async function sendStandaloneMessage(
  message: StandaloneMessage,
): Promise<StandaloneActionResult> {
  if (
    typeof chrome === "undefined" ||
    !chrome.runtime?.sendMessage ||
    !chrome.runtime.id
  ) {
    return {
      ok: false,
      code: "EXTENSION_UNAVAILABLE",
      message: "Open this page from the FocusGate extension to manage a block.",
    };
  }
  try {
    const response = await chrome.runtime.sendMessage(message);
    if (
      response &&
      typeof response === "object" &&
      "ok" in response &&
      typeof response.ok === "boolean"
    ) {
      return response as StandaloneActionResult;
    }
  } catch {
    // The staged worker remains inactive until the WP5 runtime cutover.
  }
  return {
    ok: false,
    code: "STANDALONE_ACTION_FAILED",
    message: "FocusGate could not update the standalone block. Reopen the extension and try again.",
  };
}
