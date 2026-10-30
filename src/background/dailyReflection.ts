import { localDateKey } from "../shared/time.ts";
import type { AppState } from "../shared/types.ts";
import type { SessionNotice } from "./notify.ts";

export interface DailyReflectionDependencies {
  store: { readState(): Promise<AppState> };
  notify(notice: SessionNotice): Promise<void>;
  now(): number;
  onError?(error: unknown): void;
}

export interface DailyReflectionService {
  /** WP7-B5: remind at local midnight when the day has no reflection yet. */
  notifyEndOfDay(now: number): Promise<void>;
}

/**
 * Staged WP7-B5 service: one end-of-day reflection reminder per day, only
 * when the setting is on and the day has neither a mood nor a note.
 */
export function createDailyReflectionService(
  dependencies: DailyReflectionDependencies,
): DailyReflectionService {
  return {
    async notifyEndOfDay(now) {
      let state: AppState;
      try {
        state = await dependencies.store.readState();
      } catch (error) {
        dependencies.onError?.(error);
        return;
      }

      if (!state.settings.notifications.endOfDay) return;
      const today = state.dayStats[localDateKey(now)];
      if (today?.mood !== undefined || (today?.note ?? "").length > 0) return;

      try {
        await dependencies.notify({ kind: "end_of_day_reflection" });
      } catch (error) {
        dependencies.onError?.(error);
      }
    },
  };
}
