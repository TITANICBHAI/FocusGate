import type { DataActionMessage } from "../../background/messages.ts";
import type { DataActionResult } from "../../background/dataActions.ts";
import { requestGuardPassword } from "./guardPrompts.ts";

async function send(message: DataActionMessage): Promise<DataActionResult> {
  if (
    typeof chrome === "undefined" ||
    !chrome.runtime?.sendMessage ||
    !chrome.runtime.id
  ) {
    return {
      ok: false,
      code: "EXTENSION_UNAVAILABLE",
      message: "Open this page from the FocusGate extension to manage its data.",
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
      return response as DataActionResult;
    }
  } catch {
    // The staged v2 worker is not registered until the WP5 cutover.
  }
  return {
    ok: false,
    code: "DATA_ACTION_FAILED",
    message: "FocusGate could not complete this action. Reopen the extension and try again.",
  };
}

export async function sendDataActionMessage(
  message: DataActionMessage,
): Promise<DataActionResult> {
  const response = await send(message);
  if (
    message.type !== "data/reset" ||
    response.ok ||
    response.code !== "PASSWORD_REQUIRED"
  ) {
    return response;
  }
  const password = await requestGuardPassword(
    response.message ?? "Enter your current password to reset data.",
  );
  if (!password) return response;
  return send({ ...message, password });
}
