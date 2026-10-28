import { useCallback, useSyncExternalStore } from "react";
import type { AppState } from "../../shared/types.ts";
import {
  APP_STATE_KEYS,
  uiStorageStore,
} from "./storageStore.ts";
import type { StorageKey } from "./storageStore.ts";

export function useStorage<K extends StorageKey>(key: K) {
  const subscribe = useCallback(
    (listener: () => void) => uiStorageStore.subscribe(key, listener),
    [key],
  );
  const getSnapshot = useCallback(
    () => uiStorageStore.getSnapshot(key),
    [key],
  );
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const set = useCallback(
    (valueOrUpdater: AppState[K] | ((latest: AppState[K]) => AppState[K])) =>
      uiStorageStore.set(key, valueOrUpdater),
    [key],
  );

  return {
    value: snapshot.value,
    ready: snapshot.ready,
    error: snapshot.error,
    set,
  };
}

export function useAppState(): AppState {
  const subscribe = useCallback(
    (listener: () => void) =>
      uiStorageStore.subscribeMany(APP_STATE_KEYS, listener),
    [],
  );
  const getSnapshot = useCallback(
    () => uiStorageStore.getAppStateSnapshot(),
    [],
  );
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
