import { afterEach, describe, expect, it, vi } from "vitest";
import v1Fixture from "../fixtures/v1-storage.json";

type StorageData = Record<string, unknown>;

function installChrome(initial: StorageData = {}) {
  const data = structuredClone(initial);
  const clone = <T>(value: T): T => structuredClone(value);
  const get = vi.fn(async (keys: unknown = null): Promise<StorageData> => {
    if (keys === null) return clone(data);
    const requested = Array.isArray(keys)
      ? Object.fromEntries(keys.map((key) => [String(key), undefined]))
      : typeof keys === "string"
        ? { [keys]: undefined }
        : (keys as StorageData);
    const result: StorageData = {};
    for (const [key, fallback] of Object.entries(requested)) {
      result[key] = key in data ? clone(data[key]) : clone(fallback);
    }
    return result;
  });
  const set = vi.fn(async (items: StorageData): Promise<void> => {
    Object.assign(data, clone(items));
  });
  const remove = vi.fn(async (keys: string | string[]): Promise<void> => {
    for (const key of Array.isArray(keys) ? keys : [keys]) delete data[key];
  });
  const onChanged = {
    addListener: vi.fn(),
    removeListener: vi.fn(),
  };
  const fakeChrome = {
    storage: {
      local: { get, set, remove },
      onChanged,
    },
  };
  const globalWithChrome = globalThis as typeof globalThis & { chrome?: typeof chrome };
  const previousChrome = globalWithChrome.chrome;
  globalWithChrome.chrome = fakeChrome as unknown as typeof chrome;

  return {
    data,
    get,
    set,
    remove,
    onChanged,
    restore() {
      if (previousChrome) globalWithChrome.chrome = previousChrome;
      else delete globalWithChrome.chrome;
    },
  };
}

afterEach(() => {
  vi.resetModules();
});

describe("shared storage", () => {
  it("shares one v1 migration promise across ten concurrent ready() calls", async () => {
    const fake = installChrome(v1Fixture as StorageData);
    try {
      const storage = await import("../../src/shared/storage.ts");
      await Promise.all(Array.from({ length: 10 }, () => storage.ready()));

      expect(fake.get).toHaveBeenCalledTimes(1);
      expect(fake.set).toHaveBeenCalledTimes(2);
      expect(fake.remove).toHaveBeenCalledTimes(1);
      expect(fake.data.schemaVersion).toBe(2);
      expect(fake.data.backup_v1).toMatchObject({
        createdAt: expect.any(Number),
        values: v1Fixture,
      });
      expect(fake.data.timer_timeLeft).toBeUndefined();
      expect(fake.data.blockedKeywords).toBeUndefined();

      await storage.ready();
      expect(fake.get).toHaveBeenCalledTimes(1);
    } finally {
      fake.restore();
    }
  });

  it("reads all known keys with defaults in one getState() call", async () => {
    const fake = installChrome({ schemaVersion: 2, blockedSites: ["example.com"] });
    try {
      const storage = await import("../../src/shared/storage.ts");
      const state = await storage.getState();

      expect(state.blockedSites).toEqual(["example.com"]);
      expect(state.settings.defaultDurationMin).toBe(25);
      expect(fake.get).toHaveBeenCalledTimes(2);
      expect(fake.get).toHaveBeenNthCalledWith(1, null);
      expect(fake.get.mock.calls[1][0]).toHaveProperty("schemaVersion", 2);
      expect(fake.get.mock.calls[1][0]).toHaveProperty("settings");
    } finally {
      fake.restore();
    }
  });

  it("serializes concurrent read-modify-write updates without losing values", async () => {
    const fake = installChrome({ schemaVersion: 2, blockedSites: [] });
    try {
      const storage = await import("../../src/shared/storage.ts");
      await Promise.all(
        Array.from({ length: 10 }, (_, index) =>
          storage.update("blockedSites", (sites) => [
            ...sites,
            `site-${index}.example`,
          ]),
        ),
      );

      const state = await storage.getState();
      expect(state.blockedSites).toHaveLength(10);
      expect(state.blockedSites).toEqual(
        Array.from({ length: 10 }, (_, index) => `site-${index}.example`),
      );
    } finally {
      fake.restore();
    }
  });

  it("applies patches to only the requested stored keys", async () => {
    const fake = installChrome({ schemaVersion: 2, blockedSites: [] });
    try {
      const storage = await import("../../src/shared/storage.ts");
      await storage.patch({ blockedSites: ["example.com"] });
      expect(fake.data.blockedSites).toEqual(["example.com"]);
      expect(fake.set).toHaveBeenLastCalledWith({
        blockedSites: ["example.com"],
      });
    } finally {
      fake.restore();
    }
  });

  it("filters state-change subscriptions and returns an unsubscribe callback", async () => {
    const fake = installChrome({ schemaVersion: 2 });
    try {
      const storage = await import("../../src/shared/storage.ts");
      const listener = vi.fn();
      const unsubscribe = storage.onStateChanged(listener);
      const registered = fake.onChanged.addListener.mock.calls[0][0] as (
        changes: Record<string, unknown>,
        areaName: string,
      ) => void;

      registered(
        {
          blockedSites: { newValue: ["example.com"] },
          unrelated: { newValue: true },
        },
        "local",
      );
      registered({ blockedSites: { newValue: ["other.example"] } }, "sync");

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(
        { blockedSites: { newValue: ["example.com"] } },
        "local",
      );
      unsubscribe();
      expect(fake.onChanged.removeListener).toHaveBeenCalledWith(registered);
    } finally {
      fake.restore();
    }
  });
});
