import type { SessionRecord } from "./types.ts";

export interface SessionDebrief {
  blockedAttempts: number;
  headline: string;
  /** Present when the session ran over its extended plan or finished early. */
  pace?: string;
}

/**
 * WP7-B1: builds the work-phase debrief shown in the popup and appended to
 * the completion notification.
 */
export function sessionDebrief(record: SessionRecord): SessionDebrief {
  const blockedAttempts = Math.max(0, record.blockedAttempts);
  const headline =
    blockedAttempts === 0
      ? "Clean session — no blocked attempts"
      : `${blockedAttempts} blocked attempt${blockedAttempts === 1 ? "" : "s"}`;

  const extendedMs = Math.max(0, record.extendedMs ?? 0);
  const effectivePlannedMs = Math.max(0, record.plannedMs) + extendedMs;
  const deltaMs = record.elapsedMs - effectivePlannedMs;

  let pace: string | undefined;
  if (deltaMs <= -60_000) {
    pace = `finished ${Math.max(1, Math.round(-deltaMs / 60_000))} min early`;
  } else if (deltaMs >= 60_000) {
    pace = `ran ${Math.max(1, Math.round(deltaMs / 60_000))} min over`;
  }

  return pace === undefined
    ? { blockedAttempts, headline }
    : { blockedAttempts, headline, pace };
}
