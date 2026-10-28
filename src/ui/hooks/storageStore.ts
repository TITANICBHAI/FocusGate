import { DEFAULT_STATE } from "../../shared/defaults.ts";
import type { AppState } from "../../shared/types.ts";

export type StorageKey = keyof AppState;
export const APP_STATE_KEYS = Object.keys(DEFAULT_STATE) as StorageKey[];

export interface StorageSnapshot<K extends StorageKey = StorageKey> {
  value: AppState[K];
  ready: boolean;
  error: string | null;
  version: number;
}

export interface StorageBackend {
  read(key: StorageKey): Promise<unknown>;
  write(key: StorageKey, value: unknown): Promise<void>;
  subscribe(listener: (key: StorageKey, value: unknown) => void): () => void;
}

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

interface BrowserStorageArea {
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
}

export interface StorageRuntime {
  getExtensionArea(): BrowserStorageArea | null;
  getLocalStorage(): StorageLike | undefined;
  subscribeExtensionChanges(
    listener: (key: StorageKey, value: unknown) => void,
  ): () => void;
  subscribeLocalChanges(
    listener: (key: StorageKey, value: unknown) => void,
  ): () => void;
}

function clone<T>(value: T): T {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
}

function describeError(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "FocusGate could not read browser storage.";
}

export function createBrowserStorageRuntime(): StorageRuntime {
  return {
    getExtensionArea() {
      if (typeof chrome === "undefined" || chrome.storage === undefined) {
        return null;
      }
      if (!chrome.storage.local) {
        throw new Error("FocusGate browser storage is unavailable.");
      }
      return chrome.storage.local;
    },
    getLocalStorage() {
      return typeof localStorage === "undefined" ? undefined : localStorage;
    },
    subscribeExtensionChanges(listener) {
      if (typeof chrome === "undefined" || !chrome.storage?.onChanged) {
        throw new Error("FocusGate storage change events are unavailable.");
      }
      const onChanged: Parameters<
        typeof chrome.storage.onChanged.addListener
      >[0] = (changes, areaName) => {
        if (areaName !== "local") return;
        for (const [key, change] of Object.entries(changes)) {
          if (key in DEFAULT_STATE) {
            listener(key as StorageKey, change.newValue);
          }
        }
      };
      chrome.storage.onChanged.addListener(onChanged);
      return () => chrome.storage.onChanged.removeListener(onChanged);
    },
    subscribeLocalChanges(listener) {
      if (typeof window === "undefined") return () => undefined;
      const onStorage = (event: StorageEvent) => {
        if (!event.key || !(event.key in DEFAULT_STATE)) return;
        let value: unknown;
        try {
          value = event.newValue === null ? undefined : JSON.parse(event.newValue);
        } catch {
          return;
        }
        listener(event.key as StorageKey, value);
      };
      window.addEventListener("storage", onStorage);
      return () => window.removeEventListener("storage", onStorage);
    },
  };
}

export function createBrowserStorageBackend(
  runtime: StorageRuntime = createBrowserStorageRuntime(),
): StorageBackend {
  const readFallback = async (key: StorageKey) => {
    const storage = runtime.getLocalStorage();
    if (!storage) throw new Error("FocusGate local preview storage is unavailable.");
    const serialized = storage.getItem(key);
    return serialized === null ? undefined : JSON.parse(serialized);
  };

  return {
    async read(key) {
      const area = runtime.getExtensionArea();
      if (area) {
        const stored = await area.get(key);
        return stored[key];
      }
      return readFallback(key);
    },
    async write(key, value) {
      const area = runtime.getExtensionArea();
      if (area) {
        await area.set({ [key]: value });
        return;
      }
      const storage = runtime.getLocalStorage();
      if (!storage) throw new Error("FocusGate local preview storage is unavailable.");
      storage.setItem(key, JSON.stringify(value));
    },
    subscribe(listener) {
      return runtime.getExtensionArea()
        ? runtime.subscribeExtensionChanges(listener)
        : runtime.subscribeLocalChanges(listener);
    },
  };
}

export class StorageStore {
  private readonly snapshots = new Map<StorageKey, StorageSnapshot>();
  private readonly listeners = new Map<StorageKey, Set<() => void>>();
  private readonly loads = new Map<StorageKey, Promise<void>>();
  private readonly writes = new Map<StorageKey, Promise<void>>();
  private stopBackendListener: (() => void) | undefined;
  private backendListenerStarted = false;
  private appStateVersion = "";
  private appStateSnapshot: AppState | undefined;

  constructor(private readonly backend: StorageBackend) {}

  getSnapshot<K extends StorageKey>(key: K): StorageSnapshot<K> {
    let snapshot = this.snapshots.get(key);
    if (!snapshot) {
      snapshot = {
        value: clone(DEFAULT_STATE[key]),
        ready: false,
        error: null,
        version: 0,
      } as StorageSnapshot;
      this.snapshots.set(key, snapshot);
    }
    return snapshot as StorageSnapshot<K>;
  }

  subscribe(key: StorageKey, listener: () => void): () => void {
    const listeners = this.listeners.get(key) ?? new Set<() => void>();
    listeners.add(listener);
    this.listeners.set(key, listeners);
    this.startBackendListener(key);
    void this.load(key);

    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) this.listeners.delete(key);
    };
  }

  subscribeMany(keys: readonly StorageKey[], listener: () => void): () => void {
    const unsubscribe = keys.map((key) => this.subscribe(key, listener));
    return () => unsubscribe.forEach((stop) => stop());
  }

  getGateSnapshot(keys: readonly StorageKey[]): string {
    return keys
      .map((key) => {
        const snapshot = this.getSnapshot(key);
        return `${key}:${snapshot.version}:${snapshot.ready ? "1" : "0"}`;
      })
      .join("|");
  }

  getGateState(keys: readonly StorageKey[]): {
    ready: boolean;
    error: string | null;
  } {
    const snapshots = keys.map((key) => this.getSnapshot(key));
    return {
      ready: snapshots.every((snapshot) => snapshot.ready),
      error: snapshots.find((snapshot) => snapshot.error)?.error ?? null,
    };
  }

  getAppStateSnapshot(): AppState {
    const version = this.getGateSnapshot(APP_STATE_KEYS);
    if (this.appStateSnapshot && this.appStateVersion === version) {
      return this.appStateSnapshot;
    }
    const state = Object.fromEntries(
      APP_STATE_KEYS.map((key) => [key, this.getSnapshot(key).value]),
    ) as AppState;
    this.appStateVersion = version;
    this.appStateSnapshot = state;
    return state;
  }

  async set<K extends StorageKey>(
    key: K,
    valueOrUpdater: AppState[K] | ((latest: AppState[K]) => AppState[K]),
  ): Promise<AppState[K]> {
    const previous = this.writes.get(key) ?? Promise.resolve();
    const operation = previous.then(async () => {
      const stored = await this.backend.read(key);
      const current =
        stored === undefined
          ? this.getSnapshot(key).value
          : (stored as AppState[K]);
      const next =
        typeof valueOrUpdater === "function"
          ? (valueOrUpdater as (latest: AppState[K]) => AppState[K])(
              clone(current),
            )
          : valueOrUpdater;
      await this.backend.write(key, next);
      this.publish(key, next, true, null);
      return clone(next);
    });
    this.writes.set(
      key,
      operation.then(
        () => undefined,
        () => undefined,
      ),
    );
    return operation;
  }

  private startBackendListener(key: StorageKey): void {
    if (this.backendListenerStarted) return;
    this.backendListenerStarted = true;
    try {
      this.stopBackendListener = this.backend.subscribe((changedKey, value) => {
        if (!(changedKey in DEFAULT_STATE)) return;
        const resolved =
          value === undefined
            ? clone(DEFAULT_STATE[changedKey])
            : clone(value);
        this.publish(changedKey, resolved, true, null);
      });
    } catch (error) {
      this.backendListenerStarted = false;
      this.publish(key, this.getSnapshot(key).value, false, describeError(error));
    }
  }

  private load(key: StorageKey): Promise<void> {
    const current = this.getSnapshot(key);
    if (current.ready || current.error) return Promise.resolve();
    const existing = this.loads.get(key);
    if (existing) return existing;

    const load = this.backend
      .read(key)
      .then((value) => {
        const resolved =
          value === undefined ? clone(DEFAULT_STATE[key]) : clone(value);
        this.publish(key, resolved, true, null);
      })
      .catch((error: unknown) => {
        this.publish(key, current.value, false, describeError(error));
      })
      .finally(() => {
        this.loads.delete(key);
      });
    this.loads.set(key, load);
    return load;
  }

  private publish(
    key: StorageKey,
    value: unknown,
    ready: boolean,
    error: string | null,
  ): void {
    const previous = this.getSnapshot(key);
    this.snapshots.set(key, {
      value: clone(value),
      ready,
      error,
      version: previous.version + 1,
    } as StorageSnapshot);
    this.listeners.get(key)?.forEach((listener) => listener());
  }
}

export const uiStorageStore = new StorageStore(createBrowserStorageBackend());
