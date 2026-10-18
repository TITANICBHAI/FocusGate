import { createDefaultState, DEFAULT_STATE } from "./defaults.ts";
import {
  isBackupExpired,
  LEGACY_KEYS_TO_REMOVE,
  migrateV1,
} from "./migrate.ts";
import type { AppState, StateChanges, StateKey } from "./types.ts";

type StateListener = (changes: StateChanges, areaName: string) => void;

let readiness: Promise<void> | undefined;
let writeQueue: Promise<void> = Promise.resolve();

function localStorageArea(): typeof chrome.storage.local {
  if (typeof chrome === "undefined" || !chrome.storage?.local) {
    throw new Error("FocusGate requires the browser extension storage API.");
  }
  return chrome.storage.local;
}

function runAsSingleWriter<T>(operation: () => Promise<T>): Promise<T> {
  const result = writeQueue.then(operation, operation);
  writeQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

async function initializeState(): Promise<void> {
  const area = localStorageArea();
  const raw = (await area.get(null)) as Record<string, unknown>;
  const version = raw.schemaVersion;

  if (typeof version === "number" && version > 2) {
    throw new Error(
      `FocusGate storage schema ${version} is newer than this extension supports.`,
    );
  }

  if (version !== 2) {
    const migration = migrateV1(raw, Date.now());
    if (migration.set.backup_v1) {
      await area.set({ backup_v1: migration.set.backup_v1 });
    }
    await area.set(migration.set);
    if (migration.remove.length > 0) await area.remove([...migration.remove]);
    return;
  }

  await area.remove([...LEGACY_KEYS_TO_REMOVE]);
  if (isBackupExpired(raw.backup_v1, Date.now())) {
    await area.remove("backup_v1");
  }
}

/**
 * Resolves once storage is initialized and any legacy v1 state has been migrated.
 * Concurrent callers share the same in-flight promise.
 */
export function ready(): Promise<void> {
  if (!readiness) {
    readiness = initializeState().catch((error: unknown) => {
      readiness = undefined;
      throw error;
    });
  }
  return readiness;
}

/**
 * Reads the full typed v2 state in one storage.local.get call.
 */
export async function getState(): Promise<AppState> {
  await ready();
  const stored = (await localStorageArea().get(DEFAULT_STATE)) as Partial<AppState>;
  return {
    ...createDefaultState(),
    ...stored,
    schemaVersion: 2,
  };
}

/**
 * Writes a partial state update as a single storage.local.set operation.
 */
export async function patch(partial: Partial<AppState>): Promise<void> {
  await ready();
  await runAsSingleWriter(async () => {
    await localStorageArea().set(partial);
  });
}

/**
 * Serializes read-modify-write updates so concurrent callers cannot overwrite
 * one another with stale values.
 */
export async function update<K extends StateKey>(
  key: K,
  updater: (current: AppState[K]) => AppState[K],
): Promise<AppState[K]> {
  await ready();
  return runAsSingleWriter(async () => {
    const defaults = createDefaultState();
    const stored = (await localStorageArea().get({
      [key]: defaults[key],
    })) as Partial<AppState>;
    const current = (stored[key] ?? defaults[key]) as AppState[K];
    const next = updater(structuredClone(current));
    await localStorageArea().set({ [key]: next });
    return next;
  });
}

/**
 * Subscribes to changes for known v2 state keys and returns an unsubscribe
 * callback. Changes in other storage areas and unrelated keys are ignored.
 */
export function onStateChanged(listener: StateListener): () => void {
  if (typeof chrome === "undefined" || !chrome.storage?.onChanged) {
    throw new Error("FocusGate requires the browser extension storage API.");
  }

  const wrapped: Parameters<typeof chrome.storage.onChanged.addListener>[0] = (
    changes,
    areaName,
  ) => {
    if (areaName !== "local") return;
    const stateChanges: StateChanges = {};
    for (const [key, change] of Object.entries(changes)) {
      if (key in DEFAULT_STATE) {
        (stateChanges as Record<string, unknown>)[key] = change;
      }
    }
    if (Object.keys(stateChanges).length > 0) listener(stateChanges, areaName);
  };

  chrome.storage.onChanged.addListener(wrapped);
  return () => chrome.storage.onChanged.removeListener(wrapped);
}
