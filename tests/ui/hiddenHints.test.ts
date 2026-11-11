import { describe, expect, it } from "vitest";
import { readHiddenHints, setHintHidden } from "../../src/ui/lib/hiddenHints.ts";
import type { HintStore } from "../../src/ui/lib/hiddenHints.ts";

function fakeStore(initial: Record<string, string> = {}): HintStore & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => {
      data[key] = value;
    },
  };
}

const throwing: HintStore = {
  getItem() {
    throw new Error("storage is blocked");
  },
  setItem() {
    throw new Error("storage is blocked");
  },
};

describe("hidden hints", () => {
  it("starts with nothing hidden", () => {
    expect([...readHiddenHints(fakeStore())]).toEqual([]);
  });

  it("remembers a hidden hint in the store and shows it again when asked", () => {
    const store = fakeStore();
    setHintHidden("lock-strict", true, store);
    expect(readHiddenHints(store).has("lock-strict")).toBe(true);
    expect(readHiddenHints(store).has("lock-none")).toBe(false);
    expect(JSON.parse(store.data["focusgate.hidden-hints"] ?? "null")).toEqual(["lock-strict"]);

    setHintHidden("lock-strict", false, store);
    expect(readHiddenHints(store).has("lock-strict")).toBe(false);
  });

  it("keeps each hint on its own, so hiding one does not hide another", () => {
    const store = fakeStore();
    setHintHidden("lock-none", true, store);
    setHintHidden("lock-commitment", true, store);
    expect([...readHiddenHints(store)].sort()).toEqual(["lock-commitment", "lock-none"]);
  });

  it("does not lose a change made in another window", () => {
    const store = fakeStore();
    setHintHidden("from-panel", true, store);
    setHintHidden("from-dashboard", true, store);
    expect([...readHiddenHints(store)].sort()).toEqual(["from-dashboard", "from-panel"]);
  });

  it("ignores damaged data instead of failing", () => {
    expect([...readHiddenHints(fakeStore({ "focusgate.hidden-hints": "{not json" }))]).toEqual([]);
    expect([...readHiddenHints(fakeStore({ "focusgate.hidden-hints": '{"a":1}' }))]).toEqual([]);
    expect([
      ...readHiddenHints(fakeStore({ "focusgate.hidden-hints": '["ok", 3, null, "also-ok"]' })),
    ]).toEqual(["ok", "also-ok"]);
  });

  it("still works for this visit when the browser will not store anything", () => {
    setHintHidden("blocked-store", true, throwing);
    expect(readHiddenHints(throwing).has("blocked-store")).toBe(true);
    setHintHidden("no-store", true, undefined);
    expect(readHiddenHints(undefined).has("no-store")).toBe(true);
    setHintHidden("blocked-store", false, throwing);
    expect(readHiddenHints(throwing).has("blocked-store")).toBe(false);
  });
});
