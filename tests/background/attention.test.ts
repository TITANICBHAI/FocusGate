import { describe, expect, it, vi } from "vitest";
import { createAttentionTracker } from "../../src/background/attention.ts";
import type {
  AttentionDependencies,
  AttentionEventSource,
  FocusedWindowSnapshot,
  IdleState,
} from "../../src/background/attention.ts";
import { createDefaultState } from "../../src/shared/defaults.ts";
import type { AppState } from "../../src/shared/types.ts";

function createHarness(initialState: AppState = createDefaultState()) {
  let now = 10_000;
  let state = structuredClone(initialState);
  state.allowances["example.com"] ??= {
    mode: "time_budget",
    limitMin: 1,
    duringBlocks: false,
  };
  let checkpoint: Awaited<
    ReturnType<AttentionDependencies["getCheckpoint"]>
  > = null;
  let window: FocusedWindowSnapshot | null = {
    focused: true,
    tabs: [{ active: true, url: "https://www.example.com/path" }],
  };
  let idleState: IdleState = "active";
  const writes: AppState["usage"][] = [];
  const reconciles: string[] = [];
  const windowReads = vi.fn(async () => window);
  const dependencies: AttentionDependencies = {
    getState: async () => structuredClone(state),
    getCheckpoint: async () => structuredClone(checkpoint),
    setCheckpoint: async (value) => {
      checkpoint = structuredClone(value);
    },
    getLastFocusedWindow: windowReads,
    getIdleState: async (interval) => {
      expect(interval).toBe(60);
      return idleState;
    },
    writeUsage: async (usage) => {
      writes.push(structuredClone(usage));
      state = { ...state, usage: structuredClone(usage) };
    },
    now: () => now,
    reconcile: async (reason) => {
      reconciles.push(reason);
    },
  };
  const tracker = createAttentionTracker(dependencies);

  return {
    tracker,
    state: () => state,
    writes,
    reconciles,
    windowReads,
    setNow: (value: number) => {
      now = value;
    },
    setWindow: (value: FocusedWindowSnapshot | null) => {
      window = value;
    },
    setIdleState: (value: IdleState) => {
      idleState = value;
    },
    setState: (value: AppState) => {
      state = structuredClone(value);
    },
  };
}

function createSignal() {
  const listeners = new Set<() => void>();
  const source: AttentionEventSource = {
    addListener: (listener) => listeners.add(listener),
    removeListener: (listener) => listeners.delete(listener),
  };
  return {
    source,
    emit: () => [...listeners].forEach((listener) => listener()),
    count: () => listeners.size,
  };
}

describe("allowance attention sampler", () => {
  it("credits focused, active time and reconciles when the cap is reached", async () => {
    const harness = createHarness();
    const first = await harness.tracker.sample();
    expect(first).toMatchObject({ domain: "example.com", attentive: true });

    harness.setNow(70_000);
    const second = await harness.tracker.sample();

    expect(second).toMatchObject({
      domain: "example.com",
      attentive: false,
      creditedMs: 60_000,
      exhaustionChanged: true,
    });
    expect(harness.state().usage["example.com"]?.usedMs).toBe(60_000);
    expect(harness.reconciles).toEqual(["allowance"]);

    harness.setNow(130_000);
    expect(await harness.tracker.sample()).toMatchObject({
      attentive: false,
      creditedMs: 0,
      exhaustionChanged: false,
    });
    expect(harness.state().usage["example.com"]?.usedMs).toBe(60_000);
  });

  it("does not charge idle or unfocused time, then resumes on an attentive sample", async () => {
    const harness = createHarness();
    harness.setIdleState("idle");
    await harness.tracker.sample();

    harness.setNow(70_000);
    expect(await harness.tracker.sample()).toMatchObject({
      attentive: false,
      creditedMs: 0,
    });
    expect(harness.state().usage["example.com"]).toBeUndefined();

    harness.setIdleState("active");
    harness.setWindow({
      focused: false,
      tabs: [{ active: true, url: "https://example.com/" }],
    });
    await harness.tracker.sample();
    harness.setNow(130_000);
    await harness.tracker.sample();
    expect(harness.state().usage["example.com"]).toBeUndefined();

    harness.setWindow({
      focused: true,
      tabs: [{ active: true, url: "https://example.com/" }],
    });
    await harness.tracker.sample();
    harness.setNow(190_000);
    await harness.tracker.sample();
    expect(harness.state().usage["example.com"]?.usedMs).toBe(60_000);
  });

  it("credits an audible active tab even when its window is unfocused", async () => {
    const harness = createHarness();
    harness.setWindow({
      focused: false,
      tabs: [
        { active: true, audible: true, url: "https://example.com/video" },
      ],
    });
    harness.setIdleState("locked");
    await harness.tracker.sample();

    harness.setNow(70_000);
    await harness.tracker.sample();

    expect(harness.state().usage["example.com"]?.usedMs).toBe(60_000);
  });

  it("uses only the active tab and matches subdomains and alias groups", async () => {
    const harness = createHarness();
    harness.setWindow({
      focused: true,
      tabs: [
        { active: false, url: "https://example.com/background" },
        { active: true, url: "https://example.com/video" },
      ],
    });
    expect((await harness.tracker.sample()).domain).toBe("example.com");

    harness.setWindow({
      focused: true,
      tabs: [{ active: true, url: "https://notexample.com/" }],
    });
    expect((await harness.tracker.sample()).domain).toBeNull();
  });

  it("meters during-block exemptions, but never credits blocked or always-blocked use", async () => {
    const blockedState = createDefaultState();
    blockedState.session.status = "work";
    blockedState.blockedSites = ["example.com"];
    blockedState.allowances["example.com"] = {
      mode: "time_budget",
      limitMin: 1,
      duringBlocks: false,
    };
    const blocked = createHarness(blockedState);
    expect((await blocked.tracker.sample()).attentive).toBe(false);
    blocked.setNow(70_000);
    await blocked.tracker.sample();
    expect(blocked.state().usage["example.com"]).toBeUndefined();

    const meteredState = structuredClone(blockedState);
    meteredState.allowances["example.com"]!.duringBlocks = true;
    const metered = createHarness(meteredState);
    await metered.tracker.sample();
    metered.setNow(70_000);
    expect(await metered.tracker.sample()).toMatchObject({
      attentive: false,
      creditedMs: 60_000,
    });
    expect(metered.state().usage["example.com"]?.usedMs).toBe(60_000);

    const alwaysBlockedState = structuredClone(meteredState);
    alwaysBlockedState.alwaysBlockedSites = ["example.com"];
    const alwaysBlocked = createHarness(alwaysBlockedState);
    expect((await alwaysBlocked.tracker.sample()).attentive).toBe(false);
  });

  it("tracks count visits and starts interval windows at the sampled boundary", async () => {
    const countState = createDefaultState();
    countState.allowances["example.com"] = {
      mode: "count",
      maxOpens: 2,
      duringBlocks: false,
    };
    const count = createHarness(countState);
    await count.tracker.sample();
    count.setNow(70_000);
    await count.tracker.sample();
    expect(count.state().usage["example.com"]?.opens).toBe(1);

    count.setWindow({
      focused: false,
      tabs: [{ active: true, url: "https://example.com/" }],
    });
    await count.tracker.sample();
    count.setNow(220_000);
    await count.tracker.sample();
    count.setWindow({
      focused: true,
      tabs: [{ active: true, url: "https://example.com/" }],
    });
    await count.tracker.sample();
    count.setNow(280_000);
    await count.tracker.sample();
    expect(count.state().usage["example.com"]?.opens).toBe(2);

    count.setWindow({
      focused: false,
      tabs: [{ active: true, url: "https://example.com/" }],
    });
    await count.tracker.sample();
    count.setNow(430_000);
    expect((await count.tracker.sample()).attentive).toBe(false);
    expect(count.state().usage["example.com"]?.opens).toBe(2);

    const intervalState = createDefaultState();
    intervalState.allowances["example.com"] = {
      mode: "interval",
      allowMin: 1,
      everyMin: 5,
      duringBlocks: false,
    };
    const interval = createHarness(intervalState);
    await interval.tracker.sample();
    interval.setNow(70_000);
    await interval.tracker.sample();
    expect(interval.state().usage["example.com"]).toMatchObject({
      usedMs: 60_000,
      windowStartMs: 10_000,
    });

    interval.setNow(310_000);
    await interval.tracker.sample();
    interval.setNow(370_000);
    expect(await interval.tracker.sample()).toMatchObject({
      attentive: false,
      creditedMs: 60_000,
    });
    expect(interval.state().usage["example.com"]).toMatchObject({
      usedMs: 60_000,
      windowStartMs: 310_000,
    });
  });

  it("samples on every injected event source and removes listeners on dispose", async () => {
    const harness = createHarness();
    const sources = [
      createSignal(),
      createSignal(),
      createSignal(),
      createSignal(),
      createSignal(),
    ];
    const dispose = harness.tracker.attach({
      tick: sources[0]!.source,
      tabActivated: sources[1]!.source,
      windowFocusChanged: sources[2]!.source,
      mainFrameCommitted: sources[3]!.source,
      idleStateChanged: sources[4]!.source,
    });

    for (const signal of sources) {
      signal.emit();
      await harness.tracker.whenIdle();
    }
    expect(harness.windowReads).toHaveBeenCalledTimes(5);
    expect(sources.every((signal) => signal.count() === 1)).toBe(true);

    dispose();
    expect(sources.every((signal) => signal.count() === 0)).toBe(true);
  });
});
