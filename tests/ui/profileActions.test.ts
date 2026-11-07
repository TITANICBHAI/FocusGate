import { describe, expect, it, vi } from "vitest";
import { createDefaultState } from "../../src/shared/defaults.ts";
import { StorageStore } from "../../src/ui/hooks/storageStore.ts";
import type { StorageBackend } from "../../src/ui/hooks/storageStore.ts";
import {
  applyProfileField,
  saveProfileField,
} from "../../src/ui/lib/profileActions.ts";

function fakeBackend(settings = createDefaultState().settings) {
  const writeGuarded = vi.fn(async () => undefined);
  const write = vi.fn(async () => undefined);
  const backend: StorageBackend = {
    read: vi.fn(async (key) => (key === "settings" ? settings : undefined)),
    write,
    writeGuarded,
    subscribe: () => () => undefined,
  };
  return { backend, writeGuarded, write };
}

describe("applyProfileField", () => {
  it("sets only the named field and cleans it", () => {
    const settings = createDefaultState().settings;
    const next = applyProfileField(settings, "why", "  Finish the thesis  ");
    expect(next.why).toBe("Finish the thesis");
    expect(next.displayName).toBe("");
    expect(next.theme).toBe(settings.theme);
  });

  it("cuts a long name to 24 characters", () => {
    const next = applyProfileField(createDefaultState().settings, "displayName", "a".repeat(40));
    expect(next.displayName).toHaveLength(24);
  });
});

describe("saveProfileField", () => {
  it("writes settings.why through the guarded path, not the direct one", async () => {
    const { backend, writeGuarded, write } = fakeBackend();
    const store = new StorageStore(backend);
    await saveProfileField(store, "why", "Be present");
    expect(write).not.toHaveBeenCalled();
    expect(writeGuarded).toHaveBeenCalledTimes(1);
    const [key, value] = writeGuarded.mock.calls[0] as unknown as [
      string,
      { why: string; displayName: string },
    ];
    expect(key).toBe("settings");
    expect(value.why).toBe("Be present");
    expect(value.displayName).toBe("");
  });

  it("fills the fields when stored settings predate them", async () => {
    const old = { ...createDefaultState().settings } as Record<string, unknown>;
    delete old.displayName;
    delete old.why;
    const { backend, writeGuarded } = fakeBackend(old as never);
    const store = new StorageStore(backend);
    await saveProfileField(store, "displayName", "Asha");
    const value = (writeGuarded.mock.calls[0] as unknown as [string, Record<string, unknown>])[1];
    expect(value.displayName).toBe("Asha");
    expect(value.why).toBe("");
  });
});
