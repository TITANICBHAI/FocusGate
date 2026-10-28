import { useCallback, useMemo, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import type { StorageKey } from "../hooks/storageStore.ts";
import { uiStorageStore } from "../hooks/storageStore.ts";

interface StorageGateProps {
  keys: readonly StorageKey[];
  children: ReactNode;
}

export function StorageGate({ keys, children }: StorageGateProps) {
  const keySignature = keys.join("\u0000");
  const stableKeys = useMemo(
    () => [...new Set(keys)],
    [keySignature],
  );
  const subscribe = useCallback(
    (listener: () => void) =>
      uiStorageStore.subscribeMany(stableKeys, listener),
    [stableKeys],
  );
  const getSnapshot = useCallback(
    () => uiStorageStore.getGateSnapshot(stableKeys),
    [stableKeys],
  );
  useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const state = uiStorageStore.getGateState(stableKeys);
  if (state.error) {
    return (
      <main className="storage-gate-error" role="alert">
        <h1>FocusGate could not load your data</h1>
        <p>{state.error}</p>
      </main>
    );
  }
  if (!state.ready) {
    return (
      <main className="storage-gate-skeleton" aria-busy="true" aria-label="Loading">
        <span className="skeleton skeleton-title" />
        <span className="skeleton skeleton-card" />
        <span className="skeleton skeleton-card" />
      </main>
    );
  }
  return children;
}
