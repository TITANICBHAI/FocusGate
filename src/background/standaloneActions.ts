import {
  isValidStandaloneExpiry,
  MAX_STANDALONE_MINUTES,
  MAX_STANDALONE_SITES,
  MIN_STANDALONE_MINUTES,
  normalizeStandaloneSites,
} from "../shared/standalone.ts";
import type { AppState, StandaloneBlock } from "../shared/types.ts";

export interface StandaloneActionStore {
  readState(): Promise<AppState>;
  writeState(patch: Partial<AppState>): Promise<void>;
}

export interface StandaloneActionResult {
  ok: boolean;
  code?: string;
  message?: string;
  standalone?: StandaloneBlock;
  warning?: string;
}

export interface StandaloneActionService {
  start(input: { until: number; sites: string[] }): Promise<StandaloneActionResult>;
  extend(minutes: number): Promise<StandaloneActionResult>;
  addSites(sites: string[]): Promise<StandaloneActionResult>;
}

export interface StandaloneActionDependencies {
  store: StandaloneActionStore;
  now(): number;
  afterChange?(): Promise<unknown>;
}

function isActive(block: StandaloneBlock, now: number): boolean {
  return block.active && block.startsAt <= now && now < block.until;
}

function validMinutes(minutes: number): boolean {
  return (
    Number.isInteger(minutes) &&
    minutes >= MIN_STANDALONE_MINUTES &&
    minutes <= MAX_STANDALONE_MINUTES
  );
}

/**
 * Standalone controls only start, extend, or add domains. There is deliberately
 * no stop operation in this service or its message contract.
 */
export function createStandaloneActionService(
  dependencies: StandaloneActionDependencies,
): StandaloneActionService {
  let queue = Promise.resolve();

  async function exclusive<T>(operation: () => Promise<T>): Promise<T> {
    const next = queue.then(operation, operation);
    queue = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }

  async function save(
    state: AppState,
    standalone: StandaloneBlock,
  ): Promise<StandaloneActionResult> {
    await dependencies.store.writeState({ standalone });
    try {
      await dependencies.afterChange?.();
      return { ok: true, standalone };
    } catch {
      return {
        ok: true,
        standalone,
        warning:
          "The block was saved, but browser blocking could not be refreshed. Check Protection status.",
      };
    }
  }

  return {
    start: (input) =>
      exclusive(async () => {
        const now = dependencies.now();
        if (!isValidStandaloneExpiry(input.until, now)) {
          return {
            ok: false,
            code: "INVALID_EXPIRY",
            message: "Choose an end time from 5 minutes to 30 days from now.",
          };
        }
        const sites = normalizeStandaloneSites(input.sites);
        if (!sites) {
          return {
            ok: false,
            code: "INVALID_SITES",
            message: "Add at least one valid website, with no more than 500 sites.",
          };
        }
        const state = await dependencies.store.readState();
        if (isActive(state.standalone, now)) {
          return {
            ok: false,
            code: "ALREADY_ACTIVE",
            message: "A standalone block is already active.",
          };
        }
        const standalone: StandaloneBlock = {
          active: true,
          startsAt: now,
          until: input.until,
          sites,
          startedAt: now,
          extendedMs: 0,
          blockedAttempts: 0,
          lastSites: state.standalone.lastSites,
        };
        return save(state, standalone);
      }),

    extend: (minutes) =>
      exclusive(async () => {
        const now = dependencies.now();
        if (!validMinutes(minutes)) {
          return {
            ok: false,
            code: "INVALID_DURATION",
            message: "Choose an extension from 5 minutes to 30 days.",
          };
        }
        const state = await dependencies.store.readState();
        if (!isActive(state.standalone, now)) {
          return {
            ok: false,
            code: "NOT_ACTIVE",
            message: "There is no active standalone block to extend.",
          };
        }
        const until = state.standalone.until + minutes * 60_000;
        if (until - now > MAX_STANDALONE_MINUTES * 60_000) {
          return {
            ok: false,
            code: "MAX_EXPIRY",
            message: "A standalone block cannot extend beyond 30 days from now.",
          };
        }
        const standalone: StandaloneBlock = {
          ...state.standalone,
          until,
          extendedMs: state.standalone.extendedMs + minutes * 60_000,
        };
        return save(state, standalone);
      }),

    addSites: (input) =>
      exclusive(async () => {
        const sites = normalizeStandaloneSites(input);
        if (!sites) {
          return {
            ok: false,
            code: "INVALID_SITES",
            message: "Add at least one valid website, with no more than 500 sites.",
          };
        }
        const now = dependencies.now();
        const state = await dependencies.store.readState();
        if (!isActive(state.standalone, now)) {
          return {
            ok: false,
            code: "NOT_ACTIVE",
            message: "Sites can only be added while a standalone block is active.",
          };
        }
        const merged = [...new Set([...state.standalone.sites, ...sites])];
        if (merged.length > MAX_STANDALONE_SITES) {
          return {
            ok: false,
            code: "TOO_MANY_SITES",
            message: "A standalone block can contain at most 500 sites.",
          };
        }
        if (merged.length === state.standalone.sites.length) {
          return {
            ok: false,
            code: "NO_NEW_SITES",
            message: "Every site is already in this standalone block.",
          };
        }
        return save(state, {
          ...state.standalone,
          sites: merged,
        });
      }),
  };
}
