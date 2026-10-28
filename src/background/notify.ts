import type { AppState } from "../shared/types.ts";

export type SessionNotice =
  | { kind: "focus_started"; durationMin: number }
  | { kind: "session_completed"; elapsedMs: number }
  | { kind: "session_interrupted" }
  | { kind: "break_ended" }
  | { kind: "session_extended"; minutes: number }
  | { kind: "session_locked" };

export interface NotificationOptions {
  type: "basic";
  iconUrl: string;
  title: string;
  message: string;
}

export interface NotificationApi {
  create(
    id: string,
    options: NotificationOptions,
  ): string | Promise<string> | void;
}

export interface ActionBadgeApi {
  setBadgeText(details: { text: string }): void | Promise<void>;
  setBadgeBackgroundColor?(details: { color: string }): void | Promise<void>;
  setTitle?(details: { title: string }): void | Promise<void>;
}

export async function showSessionNotice(
  notifications: NotificationApi,
  notice: SessionNotice,
  iconUrl = "icon.png",
): Promise<void> {
  const message = noticeMessage(notice);
  await notifications.create(`focusgate-${notice.kind}`, {
    type: "basic",
    iconUrl,
    title: "FocusGate",
    message,
  });
}

export async function updateActionBadge(
  action: ActionBadgeApi,
  state: AppState,
  now: number,
): Promise<void> {
  const session = state.session;
  const remainingMs = Math.max(0, session.phaseEndsAt - now);
  const text =
    session.status === "idle"
      ? state.standalone.active && now < state.standalone.until
        ? "ON"
        : ""
      : remainingMs <= 60_000
        ? "<1"
        : String(Math.ceil(remainingMs / 60_000));

  await action.setBadgeText({ text });
  const color =
    session.status === "work"
      ? "#10b981"
      : session.status === "idle"
        ? "#10b981"
        : "#3b82f6";
  await action.setBadgeBackgroundColor?.({ color });

  const title =
    session.status === "idle"
      ? state.standalone.active && now < state.standalone.until
        ? "FocusGate — Block now is active"
        : "FocusGate"
      : `FocusGate — ${formatRemaining(remainingMs)} ${
          session.status === "work" ? "focus" : "break"
        }`;
  await action.setTitle?.({ title });
}

function noticeMessage(notice: SessionNotice): string {
  switch (notice.kind) {
    case "focus_started":
      return `Focus started — ${notice.durationMin} min.`;
    case "session_completed":
      return `${formatDuration(notice.elapsedMs)} done — nice work.`;
    case "session_interrupted":
      return "The session ended while FocusGate was inactive.";
    case "break_ended":
      return "Break over.";
    case "session_extended":
      return `Focus extended by ${notice.minutes} min.`;
    case "session_locked":
      return "This session is locked.";
  }
}

function formatRemaining(milliseconds: number): string {
  const seconds = Math.ceil(milliseconds / 1_000);
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function formatDuration(milliseconds: number): string {
  const minutes = Math.max(1, Math.round(milliseconds / 60_000));
  return `${minutes} min`;
}
