import type { SessionState } from "./types.ts";

/**
 * A work phase counts as live only until its end time. A stored `work` status
 * whose `phaseEndsAt` has passed (the alarm has not fired yet, or the browser
 * was closed) is expired and must not block or lock anything.
 *
 * Matches the recovery rule in `session.ts`, which treats `now >= phaseEndsAt`
 * as elapsed.
 */
export function isWorkPhaseLive(session: SessionState, now: number): boolean {
  return session.status === "work" && session.phaseEndsAt > now;
}
