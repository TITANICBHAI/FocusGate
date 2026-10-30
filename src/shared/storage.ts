import { createDefaultState, DEFAULT_STATE } from "./defaults.ts";
import {
  isBackupExpired,
  LEGACY_KEYS_TO_REMOVE,
  migrateV1,
} from "./migrate.ts";
import type { AppState, StateChanges, StateKey } from "./types.ts";

type StateListener = (changes: StateChanges, areaName: string) => void;

interface StorageAreaLike {
  get(
    keys: string | string[] | Record<string, unknown> | null,
  ): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(keys: string | string[]): Promise<void>;
}

interface StorageChangeLike {
  oldValue?: unknown;
  newValue?: unknown;
}

interface StorageOnChangedLike {
  addListener(
    listener: (
      changes: Record<string, StorageChangeLike>,
      areaName: string,
    ) => void,
  ): void;
  removeListener(
    listener: (
      changes: Record<string, StorageChangeLike>,
      areaName: string,
    ) => void,
  ): void;
}

interface ChromeStorageLike {
  storage?: {
    local?: StorageAreaLike;
    onChanged?: StorageOnChangedLike;
  };
}

function browserStorage(): ChromeStorageLike["storage"] {
  return (globalThis as { chrome?: ChromeStorageLike }).chrome?.storage;
}

let readiness: Promise<void> | undefined;
let writeQueue: Promise<void> = Promise.resolve();

function localStorageArea(): StorageAreaLike {
  const area = browserStorage()?.local;
  if (!area) {
    throw new Error("FocusGate requires the browser extension storage API.");
  }
  return area;
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
    await area.set(migration.set as Record<string, unknown>);
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
  const onChanged = browserStorage()?.onChanged;
  if (!onChanged) {
    throw new Error("FocusGate requires the browser extension storage API.");
  }

  const wrapped = (
    changes: Record<string, StorageChangeLike>,
    areaName: string,
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

  onChanged.addListener(wrapped);
  return () => onChanged.removeListener(wrapped);
}
