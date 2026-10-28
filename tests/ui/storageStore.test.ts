import { describe, expect, it, vi } from "vitest";
import { DEFAULT_STATE } from "../../src/shared/defaults.ts";
import type { AppState } from "../../src/shared/types.ts";
import {
  createBrowserStorageBackend,
  StorageStore,
} from "../../src/ui/hooks/storageStore.ts";
import type {
  StorageBackend,
  StorageKey,
  StorageRuntime,
} from "../../src/ui/hooks/storageStore.ts";

function createBackend(seed: Partial<AppState> = {}) {
  const values = new Map<string, unknown>(Object.entries(seed));
  const listeners = new Set<
    (key: StorageKey, value: unknown) => void
  >();
  const backend: StorageBackend = {
    read: vi.fn(async (key) => values.get(key)),
    write: vi.fn(async (key, value) => {
      values.set(key, value);
      listeners.forEach((listener) => listener(key, value));
    }),
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  return {
    backend,
    values,
    emit(key: StorageKey, value: unknown) {
      values.set(key, value);
      listeners.forEach((listener) => listener(key, value));
    },
  };
}

function flushMicrotasks() {
  return new Promise<void>((resolve) => setTimeout(resolve, 0));
}

describe("staged UI storage store", () => {
  it("keeps the storage gate closed until every key is hydrated", async () => {
    let resolveSession!: (value: unknown) => void;
    const sessionRead = new Promise<unknown>((resolve) => {
      resolveSession = resolve;
    });
    const { backend } = createBackend();
    backend.read = vi.fn(async (key) =>
      key === "session" ? sessionRead : DEFAULT_STATE[key],
    );
    const store = new StorageStore(backend);
    const unsubscribe = store.subscribeMany(
      ["session", "settings"],
      vi.fn(),
    );

    expect(store.getSnapshot("session").ready).toBe(false);
    expect(store.getGateState(["session", "settings"]).ready).toBe(false);
    await flushMicrotasks();
    expect(store.getSnapshot("settings").ready).toBe(true);
    expect(store.getGateState(["session", "settings"]).ready).toBe(false);

    resolveSession({ ...DEFAULT_STATE.session, status: "work" });
    await flushMicrotasks();
    expect(store.getSnapshot("session").value.status).toBe("work");
    expect(store.getGateState(["session", "settings"]).ready).toBe(true);
    unsubscribe();
  });

  it("applies updater functions to the latest stored value", async () => {
    const { backend, values } = createBackend({
      blockedSites: ["reddit.com"],
    });
    const store = new StorageStore(backend);
    const unsubscribe = store.subscribe("blockedSites", vi.fn());
    await flushMicrotasks();

    // Simulate another page writing after this store's last notification.
    values.set("blockedSites", ["reddit.com", "youtube.com"]);
    const next = await store.set("blockedSites", (latest) => [
      ...latest,
      "news.ycombinator.com",
    ]);

    expect(next).toEqual([
      "reddit.com",
      "youtube.com",
      "news.ycombinator.com",
    ]);
    expect(store.getSnapshot("blockedSites").value).toEqual(next);
    unsubscribe();
  });

  it("does not let a delayed initial read overwrite a newer write", async () => {
    const { backend, values } = createBackend();
    let resolveInitialRead!: (value: unknown) => void;
    const initialRead = new Promise<unknown>((resolve) => {
      resolveInitialRead = resolve;
    });
    let blockedSitesReads = 0;
    backend.read = vi.fn(async (key) => {
      if (key === "blockedSites" && blockedSitesReads++ === 0) {
        return initialRead;
      }
      return values.get(key);
    });

    const store = new StorageStore(backend);
    const unsubscribe = store.subscribe("blockedSites", vi.fn());
    await store.set("blockedSites", ["reddit.com"]);

    expect(store.getSnapshot("blockedSites")).toMatchObject({
      value: ["reddit.com"],
      ready: true,
      error: null,
    });

    resolveInitialRead(["stale.example"]);
    await flushMicrotasks();

    expect(store.getSnapshot("blockedSites")).toMatchObject({
      value: ["reddit.com"],
      ready: true,
      error: null,
    });
    unsubscribe();
  });

  it("does not let a delayed initial read error replace a newer write", async () => {
    const { backend, values } = createBackend();
    let rejectInitialRead!: (error: Error) => void;
    const initialRead = new Promise<unknown>((_resolve, reject) => {
      rejectInitialRead = reject;
    });
    let blockedSitesReads = 0;
    backend.read = vi.fn(async (key) => {
      if (key === "blockedSites" && blockedSitesReads++ === 0) {
        return initialRead;
      }
      return values.get(key);
    });

    const store = new StorageStore(backend);
    const unsubscribe = store.subscribe("blockedSites", vi.fn());
    await store.set("blockedSites", ["reddit.com"]);

    rejectInitialRead(new Error("late storage read failure"));
    await flushMicrotasks();

    expect(store.getSnapshot("blockedSites")).toMatchObject({
      value: ["reddit.com"],
      ready: true,
      error: null,
    });
    unsubscribe();
  });

  it("updates subscribers when browser storage changes externally", async () => {
    const { backend, emit } = createBackend();
    const store = new StorageStore(backend);
    const onChange = vi.fn();
    const unsubscribe = store.subscribe("settings", onChange);
    await flushMicrotasks();
    onChange.mockClear();

    const updated = { ...DEFAULT_STATE.settings, theme: "light" as const };
    emit("settings", updated);

    expect(store.getSnapshot("settings").value.theme).toBe("light");
    expect(onChange).toHaveBeenCalledOnce();
    unsubscribe();
  });

  it("uses localStorage only when extension storage is absent", async () => {
    const values = new Map<string, string>();
    const local = {
      getItem: vi.fn((key: string) => values.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => values.set(key, value)),
    };
    const runtime: StorageRuntime = {
      getExtensionArea: () => null,
      getLocalStorage: () => local,
      subscribeExtensionChanges: () => () => undefined,
      subscribeLocalChanges: () => () => undefined,
    };
    const backend = createBrowserStorageBackend(runtime);
    const stored = { ...DEFAULT_STATE.session, status: "work" as const };
    await backend.write("session", stored);
    expect(await backend.read("session")).toEqual(stored);
    expect(local.setItem).toHaveBeenCalledOnce();

    const brokenRuntime: StorageRuntime = {
      ...runtime,
      getExtensionArea: () => {
        throw new Error("extension storage exists without local area");
      },
      getLocalStorage: vi.fn(() => local),
    };
    await expect(
      createBrowserStorageBackend(brokenRuntime).read("session"),
    ).rejects.toThrow("extension storage exists without local area");
    expect(brokenRuntime.getLocalStorage).not.toHaveBeenCalled();
  });

  it("routes user-editable writes through the guarded background adapter", async () => {
    const { backend } = createBackend({ blockedSites: ["example.com"] });
    backend.writeGuarded = vi.fn(async () => undefined);
    const store = new StorageStore(backend);

    await store.set("blockedSites", (sites) => sites.filter((site) => site !== "example.com"));

    expect(backend.writeGuarded).toHaveBeenCalledWith("blockedSites", []);
    expect(backend.write).not.toHaveBeenCalled();
  });
});
