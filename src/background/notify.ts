import type { AppState } from "../shared/types.ts";

export type SessionNotice =
  | { kind: "focus_started"; durationMin: number }
  | {
      kind: "session_completed";
      elapsedMs: number;
      /** WP7-B1 debrief, present when a session record backed the notice. */
      debrief?: { blockedAttempts: number; headline: string; pace?: string };
    }
  | { kind: "session_interrupted" }
  | { kind: "break_ended" }
  | { kind: "session_extended"; minutes: number }
  | { kind: "session_locked" }
  | { kind: "achievement_unlocked"; label: string }
  | { kind: "end_of_day_reflection" }
  | { kind: "allowance_heads_up"; domain: string; minutesLeft: number }
  | { kind: "allowance_exhausted"; domain: string; resetsAt: number };

export interface NotificationOptions {
  type: "basic";
  iconUrl: string;
  title: string;
  message: string;
  buttons?: Array<{ title: string }>;
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

export interface AllowanceBadgeContext {
  domain: string;
  minutesLeft: number;
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

/**
 * The session and standalone-block badges win over the WP7-B7 allowance
 * badge; the allowance context only decorates an otherwise idle toolbar.
 */
export async function updateActionBadge(
  action: ActionBadgeApi,
  state: AppState,
  now: number,
  allowanceBadge?: AllowanceBadgeContext | null,
): Promise<void> {
  const session = state.session;
  const remainingMs = Math.max(0, session.phaseEndsAt - now);
  const standaloneActive =
    state.standalone.active && now < state.standalone.until;
  const text = ((): string => {
    if (session.status !== "idle") {
      return remainingMs <= 60_000
        ? "<1"
        : String(Math.ceil(remainingMs / 60_000));
    }
    if (standaloneActive) return "ON";
    if (allowanceBadge) {
      return String(Math.max(1, allowanceBadge.minutesLeft));
    }
    return "";
  })();

  await action.setBadgeText({ text });
  const color =
    session.status === "work"
      ? "#10b981"
      : session.status === "idle"
        ? allowanceBadge && !standaloneActive
          ? "#f59e0b"
          : "#10b981"
        : "#3b82f6";
  await action.setBadgeBackgroundColor?.({ color });

  const title = ((): string => {
    if (session.status !== "idle") {
      return `FocusGate — ${formatRemaining(remainingMs)} ${
        session.status === "work" ? "focus" : "break"
      }`;
    }
    if (standaloneActive) return "FocusGate — Block now is active";
    if (allowanceBadge) {
      return `FocusGate — ${allowanceBadge.domain}: about ${allowanceBadge.minutesLeft} min left today`;
    }
    return "FocusGate";
  })();
  await action.setTitle?.({ title });
}

function noticeMessage(notice: SessionNotice): string {
  switch (notice.kind) {
    case "focus_started":
      return `Focus started — ${notice.durationMin} min.`;
    case "session_completed": {
      const base = `${formatDuration(notice.elapsedMs)} done — nice work.`;
      if (!notice.debrief) return base;
      const pace = notice.debrief.pace ? ` (${notice.debrief.pace})` : "";
      return `${base} ${notice.debrief.headline}${pace}.`;
    }
    case "session_interrupted":
      return "The session ended while FocusGate was inactive.";
    case "break_ended":
      return "Break over.";
    case "session_extended":
      return `Focus extended by ${notice.minutes} min.`;
    case "session_locked":
      return "This session is locked.";
    case "achievement_unlocked":
      return `Achievement unlocked — ${notice.label}.`;
    case "end_of_day_reflection":
      return "How was your day? Add a mood and a short note before midnight.";
    case "allowance_heads_up":
      return `${notice.domain}: about ${notice.minutesLeft} min of today's budget left.`;
    case "allowance_exhausted":
      return `${notice.domain}: daily limit reached. It resets at ${clockTime(notice.resetsAt)}.`;
  }
}

function clockTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
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
