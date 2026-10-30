import { ACHIEVEMENT_DEFINITIONS, evaluateAchievements } from "../shared/achievements.ts";
import type { AppState } from "../shared/types.ts";
import type { SessionNotice } from "./notify.ts";

export interface AchievementsServiceDependencies {
  store: {
    readState(): Promise<AppState>;
    writeState(patch: Partial<AppState>): Promise<void>;
  };
  notify(notice: SessionNotice): Promise<void>;
  now(): number;
  onError?(error: unknown): void;
}

export interface AchievementsService {
  /** WP7-B2: unlock and announce anything the recorded history qualifies for. */
  evaluate(now: number): Promise<void>;
}

/**
 * Staged WP7-B2 service: evaluates achievements after sessions and at local
 * midnight. The storing write happens before the notifications so a crash
 * cannot announce the same unlock twice.
 */
export function createAchievementsService(
  dependencies: AchievementsServiceDependencies,
): AchievementsService {
  return {
    async evaluate(now) {
      let state: AppState;
      try {
        state = await dependencies.store.readState();
      } catch (error) {
        dependencies.onError?.(error);
        return;
      }

      const unlocked = evaluateAchievements({
        sessionHistory: state.sessionHistory,
        dayStats: state.dayStats,
        unlockedIds: state.achievements.map((record) => record.id),
        now,
      });
      if (unlocked.length === 0) return;

      try {
        await dependencies.store.writeState({
          achievements: [...state.achievements, ...unlocked],
        });
      } catch (error) {
        dependencies.onError?.(error);
        return;
      }

      if (!state.settings.notifications.achievements) return;
      for (const record of unlocked) {
        const label =
          ACHIEVEMENT_DEFINITIONS.find(
            (definition) => definition.id === record.id,
          )?.label ?? record.id;
        try {
          await dependencies.notify({ kind: "achievement_unlocked", label });
        } catch (error) {
          dependencies.onError?.(error);
        }
      }
    },
  };
}
