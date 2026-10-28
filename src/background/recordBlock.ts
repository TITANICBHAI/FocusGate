import { localDateKey } from "../shared/time.ts";
import { normalizeDomain } from "../shared/domains.ts";
import type { AppState, BlockRecord, DayStats } from "../shared/types.ts";
import type { BlockReason } from "../shared/plan.ts";

export const BLOCK_DEDUPE_WINDOW_MS = 3_000;
export const RECENT_BLOCK_LIMIT = 200;

export interface BlockAttempt {
  tabId: number;
  domain: string;
  reason: BlockReason;
}

export interface BlockDedupeStore {
  getAll(): Promise<Record<string, number>>;
  setAll(value: Record<string, number>): Promise<void>;
}

export interface BlockRecorderDependencies {
  getState(): Promise<AppState>;
  write(
    partial: Pick<AppState, "recentBlocks" | "dayStats" | "session">,
  ): Promise<void>;
  dedupe: BlockDedupeStore;
  now(): number;
}

function emptyDayStats(dateKey: string): DayStats {
  return {
    dateKey,
    focusMs: 0,
    sessionsCompleted: 0,
    sessionsAbandoned: 0,
    blocks: 0,
    blocksByDomain: {},
    tasksCompleted: 0,
  };
}

/**
 * Creates a serialized block-attempt writer. Runtime adapters can back dedupe
 * with storage.session; tests provide an in-memory fake and clock.
 */
export function createBlockRecorder(
  dependencies: BlockRecorderDependencies,
): (attempt: BlockAttempt) => Promise<boolean> {
  let queue: Promise<void> = Promise.resolve();

  return (attempt) => {
    const operation = queue.then(
      () => recordOne(attempt),
      () => recordOne(attempt),
    );
    queue = operation.then(
      () => undefined,
      () => undefined,
    );
    return operation;
  };

  async function recordOne(attempt: BlockAttempt): Promise<boolean> {
    const domain = normalizeDomain(attempt.domain);
    if (
      domain === null ||
      !Number.isInteger(attempt.tabId) ||
      attempt.tabId < 0
    ) {
      return false;
    }

    const now = dependencies.now();
    const key = `${attempt.tabId}:${domain}`;
    const currentDedupe = await dependencies.dedupe.getAll();
    const lastAt = currentDedupe[key];
    if (
      typeof lastAt === "number" &&
      now - lastAt >= 0 &&
      now - lastAt < BLOCK_DEDUPE_WINDOW_MS
    ) {
      return false;
    }

    const state = await dependencies.getState();
    const dateKey = localDateKey(new Date(now));
    const currentDay = state.dayStats[dateKey] ?? emptyDayStats(dateKey);
    const dayStats = {
      ...state.dayStats,
      [dateKey]: {
        ...currentDay,
        blocks: currentDay.blocks + 1,
        blocksByDomain: {
          ...currentDay.blocksByDomain,
          [domain]: (currentDay.blocksByDomain[domain] ?? 0) + 1,
        },
      },
    };
    const record: BlockRecord = {
      domain,
      reason: attempt.reason.kind,
      at: now,
    };
    const session =
      state.session.status === "work"
        ? {
            ...state.session,
            blockedAttempts: state.session.blockedAttempts + 1,
          }
        : state.session;

    await dependencies.write({
      recentBlocks: [...state.recentBlocks, record].slice(-RECENT_BLOCK_LIMIT),
      dayStats,
      session,
    });

    const nextDedupe: Record<string, number> = {};
    for (const [entry, at] of Object.entries(currentDedupe)) {
      const age = now - at;
      if (age >= 0 && age < BLOCK_DEDUPE_WINDOW_MS) {
        nextDedupe[entry] = at;
      }
    }
    nextDedupe[key] = now;
    await dependencies.dedupe.setAll(nextDedupe);
    return true;
  }
}
