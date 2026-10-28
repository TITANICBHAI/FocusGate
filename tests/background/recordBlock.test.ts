import { describe, expect, it } from "vitest";
import { createDefaultState } from "../../src/shared/defaults.ts";
import {
  BLOCK_DEDUPE_WINDOW_MS,
  createBlockRecorder,
} from "../../src/background/recordBlock.ts";
import { localDateKey } from "../../src/shared/time.ts";
import type {
  BlockDedupeStore,
  BlockRecorderDependencies,
} from "../../src/background/recordBlock.ts";
import type { AppState } from "../../src/shared/types.ts";

function createHarness(initialState = createDefaultState()) {
  let now = new Date(2026, 9, 28, 10, 0).getTime();
  let state = structuredClone(initialState);
  let dedupeState: Record<string, number> = {};
  const writes: Array<Partial<AppState>> = [];
  const dedupe: BlockDedupeStore = {
    getAll: async () => structuredClone(dedupeState),
    setAll: async (value) => {
      dedupeState = structuredClone(value);
    },
  };
  const dependencies: BlockRecorderDependencies = {
    getState: async () => structuredClone(state),
    write: async (partial) => {
      writes.push(structuredClone(partial));
      state = { ...state, ...structuredClone(partial) };
    },
    dedupe,
    now: () => now,
  };
  return {
    recordBlock: createBlockRecorder(dependencies),
    getState: () => state,
    getWrites: () => writes,
    getDedupe: () => dedupeState,
    setNow: (value: number) => {
      now = value;
    },
  };
}

describe("background block recorder", () => {
  it("atomically updates recent blocks, daily totals, and active-session attempts", async () => {
    const initialState = createDefaultState();
    initialState.session.status = "work";
    const harness = createHarness(initialState);

    const recorded = await harness.recordBlock({
      tabId: 5,
      domain: "https://www.Example.com/path",
      reason: { kind: "session", until: 50_000 },
    });

    expect(recorded).toBe(true);
    expect(harness.getWrites()).toHaveLength(1);
    expect(harness.getState().recentBlocks).toMatchObject([
      { domain: "example.com", reason: "session" },
    ]);
    const today = localDateKey(new Date(2026, 9, 28, 10, 0));
    expect(harness.getState().dayStats[today]).toMatchObject({
      blocks: 1,
      blocksByDomain: { "example.com": 1 },
    });
    expect(harness.getState().session.blockedAttempts).toBe(1);
  });

  it("deduplicates by tab and normalized domain for three seconds", async () => {
    const harness = createHarness();
    const attempt = {
      tabId: 5,
      domain: "example.com",
      reason: { kind: "always" as const },
    };

    expect(await harness.recordBlock(attempt)).toBe(true);
    harness.setNow(
      new Date(2026, 9, 28, 10, 0).getTime() + BLOCK_DEDUPE_WINDOW_MS - 1,
    );
    expect(
      await harness.recordBlock({ ...attempt, domain: "www.example.com" }),
    ).toBe(false);
    expect(await harness.recordBlock({ ...attempt, tabId: 6 })).toBe(true);
    expect(harness.getWrites()).toHaveLength(2);
  });

  it("accepts the same tab/domain again at the end of the dedupe window", async () => {
    const harness = createHarness();
    const startedAt = new Date(2026, 9, 28, 10, 0).getTime();
    const attempt = {
      tabId: 5,
      domain: "example.com",
      reason: { kind: "always" as const },
    };

    await harness.recordBlock(attempt);
    harness.setNow(startedAt + BLOCK_DEDUPE_WINDOW_MS);

    expect(await harness.recordBlock(attempt)).toBe(true);
    expect(harness.getState().recentBlocks).toHaveLength(2);
  });

  it("keeps only the latest 200 records and rejects invalid domains", async () => {
    const initialState = createDefaultState();
    initialState.recentBlocks = Array.from({ length: 200 }, (_, index) => ({
      domain: `site${index}.example`,
      reason: "session",
      at: index,
    }));
    const harness = createHarness(initialState);

    expect(
      await harness.recordBlock({
        tabId: 1,
        domain: "not a domain",
        reason: { kind: "always" },
      }),
    ).toBe(false);
    expect(
      await harness.recordBlock({
        tabId: 1,
        domain: "new.example",
        reason: { kind: "always" },
      }),
    ).toBe(true);
    expect(harness.getState().recentBlocks).toHaveLength(200);
    expect(harness.getState().recentBlocks.at(-1)?.domain).toBe("new.example");
  });
});
