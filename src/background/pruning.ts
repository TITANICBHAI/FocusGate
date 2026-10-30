import {
  pruneDayStats,
  pruneRecentBlocks,
  pruneSessionHistory,
} from "../shared/stats.ts";
import type { AppState } from "../shared/types.ts";

export interface PruningServiceDependencies {
  store: {
    readState(): Promise<AppState>;
    writeState(patch: Partial<AppState>): Promise<void>;
  };
  now(): number;
  onError?(error: unknown): void;
}

export interface PruningService {
  /** WP8.4: enforce the history/statistics caps at local midnight. */
  prune(): Promise<void>;
}

/**
 * Staged WP8.4 service: caps sessionHistory at 500 entries, dayStats at 400
 * local days, and recentBlocks at 200 records. Writes only when something
 * was actually removed.
 */
export function createPruningService(
  dependencies: PruningServiceDependencies,
): PruningService {
  return {
    async prune() {
      let state: AppState;
      try {
        state = await dependencies.store.readState();
      } catch (error) {
        dependencies.onError?.(error);
        return;
      }

      const patch: Partial<AppState> = {};
      const history = pruneSessionHistory(state.sessionHistory);
      if (history.length !== state.sessionHistory.length) {
        patch.sessionHistory = history;
      }
      const dayStats = pruneDayStats(state.dayStats);
      if (Object.keys(dayStats).length !== Object.keys(state.dayStats).length) {
        patch.dayStats = dayStats;
      }
      const recentBlocks = pruneRecentBlocks(state.recentBlocks);
      if (recentBlocks.length !== state.recentBlocks.length) {
        patch.recentBlocks = recentBlocks;
      }

      if (Object.keys(patch).length === 0) return;
      try {
        await dependencies.store.writeState(patch);
      } catch (error) {
        dependencies.onError?.(error);
      }
    },
  };
}
