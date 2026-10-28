import { describe, expect, it } from "vitest";
import {
  auditOpenBlockedTabs,
  createReconciler,
} from "../../src/background/reconcile.ts";
import type {
  ReconcileDependencies,
  ReconcileSnapshot,
  ReconcileTab,
} from "../../src/background/reconcile.ts";
import { createDefaultState } from "../../src/shared/defaults.ts";
import type { AppState } from "../../src/shared/types.ts";

type Rule = chrome.declarativeNetRequest.Rule;

interface HarnessOptions {
  snapshot?: ReconcileSnapshot | null;
  tabs?: ReconcileTab[];
  failInitialBatch?: boolean;
  failRuleIds?: number[];
  holdFirstUpdate?: boolean;
}

function createHarness(
  initialState = createDefaultState(),
  options: HarnessOptions = {},
) {
  let state: AppState = structuredClone(initialState);
  let rules: Rule[] = [];
  let snapshot = structuredClone(options.snapshot ?? null);
  const healthWrites: Array<Partial<AppState["health"]>> = [];
  const updateCalls: Array<{ removeRuleIds: number[]; addRules: Rule[] }> = [];
  const ensured: Array<{ state: AppState; plan: unknown; now: number }> = [];
  const updatedTabs: Array<{ tabId: number; url: string }> = [];
  const recordedBlocks: Array<{
    tabId: number;
    domain: string;
    reason: { kind: string };
  }> = [];
  let stateReads = 0;
  let releaseFirstUpdate: (() => void) | undefined;
  let notifyFirstUpdateStarted: (() => void) | undefined;
  const firstUpdateStarted = new Promise<void>((resolve) => {
    notifyFirstUpdateStarted = resolve;
  });
  const firstUpdateGate = new Promise<void>((resolve) => {
    releaseFirstUpdate = resolve;
  });
  const dependencies: ReconcileDependencies = {
    getState: async () => {
      stateReads += 1;
      return structuredClone(state);
    },
    updateHealth: async (patch) => {
      healthWrites.push(structuredClone(patch));
      state = {
        ...state,
        health: { ...state.health, ...structuredClone(patch) },
      };
    },
    getDynamicRules: async () => structuredClone(rules),
    updateDynamicRules: async (update) => {
      updateCalls.push(structuredClone(update));
      if (
        options.holdFirstUpdate &&
        updateCalls.length === 1
      ) {
        notifyFirstUpdateStarted?.();
        await firstUpdateGate;
      }
      if (options.failInitialBatch && updateCalls.length === 1) {
        throw new Error("batch rejected");
      }
      const failedRule = update.addRules.find((rule) =>
        options.failRuleIds?.includes(rule.id),
      );
      if (failedRule) throw new Error(`rule ${failedRule.id} rejected`);
      rules = [
        ...rules.filter((rule) => !update.removeRuleIds.includes(rule.id)),
        ...structuredClone(update.addRules),
      ];
    },
    getSnapshot: async () => structuredClone(snapshot),
    setSnapshot: async (value) => {
      snapshot = structuredClone(value);
    },
    ensureAlarms: async (nextState, plan, now) => {
      ensured.push({ state: structuredClone(nextState), plan, now });
    },
    listTabs: async () => structuredClone(options.tabs ?? []),
    updateTab: async (tabId, url) => {
      updatedTabs.push({ tabId, url });
    },
    recordBlock: async (tabId, domain, reason) => {
      recordedBlocks.push({ tabId, domain, reason });
    },
    blockedBase: "chrome-extension://test/blocked.html",
    now: () => new Date(2026, 9, 28, 10, 0).getTime(),
  };
  return {
    reconcile: createReconciler(dependencies),
    getState: () => state,
    getRules: () => rules,
    getSnapshot: () => snapshot,
    getHealthWrites: () => healthWrites,
    getUpdateCalls: () => updateCalls,
    getEnsured: () => ensured,
    getUpdatedTabs: () => updatedTabs,
    getRecordedBlocks: () => recordedBlocks,
    getStateReads: () => stateReads,
    auditOpenBlockedTabs: (now?: number) =>
      auditOpenBlockedTabs(dependencies, undefined, now),
    firstUpdateStarted,
    releaseFirstUpdate: () => releaseFirstUpdate?.(),
  };
}

describe("staged blocking reconciler", () => {
  it("installs one rule batch, schedules the next boundary, and writes health", async () => {
    const state = createDefaultState();
    state.alwaysBlockedSites = ["example.com"];
    const harness = createHarness(state);

    await harness.reconcile("startup");

    expect(harness.getUpdateCalls()).toHaveLength(1);
    expect(harness.getRules().map((rule) => rule.id)).toEqual([1]);
    expect(harness.getEnsured()).toHaveLength(1);
    expect(harness.getHealthWrites().at(-1)).toMatchObject({
      lastError: null,
      ruleCount: 1,
      skipped: [],
    });
    expect(harness.getSnapshot()?.blockedDomains).toContain("example.com");
  });

  it("audits only tabs whose domain became blocked in the new plan", async () => {
    const state = createDefaultState();
    state.alwaysBlockedSites = ["old.example", "new.example"];
    const harness = createHarness(state, {
      snapshot: { hash: "previous", blockedDomains: ["old.example"] },
      tabs: [
        { id: 1, url: "https://www.old.example/page" },
        { id: 2, url: "https://sub.new.example/path?q=1" },
        { id: 3, url: "https://free.example/" },
      ],
    });

    await harness.reconcile("storage");

    expect(harness.getUpdatedTabs()).toEqual([
      {
        tabId: 2,
        url: "chrome-extension://test/blocked.html#https://sub.new.example/path?q=1",
      },
    ]);
    expect(harness.getRecordedBlocks()).toMatchObject([
      { tabId: 2, domain: "sub.new.example", reason: { kind: "always" } },
    ]);
  });

  it("safety-audits already-open blocked tabs without reconciling DNR", async () => {
    const state = createDefaultState();
    state.alwaysBlockedSites = ["blocked.example"];
    const harness = createHarness(state, {
      tabs: [
        { id: 4, url: "https://sub.blocked.example/open" },
        { id: 5, url: "https://free.example/" },
      ],
    });

    await harness.auditOpenBlockedTabs();

    expect(harness.getUpdatedTabs()).toEqual([
      {
        tabId: 4,
        url: "chrome-extension://test/blocked.html#https://sub.blocked.example/open",
      },
    ]);
    expect(harness.getRecordedBlocks()).toMatchObject([
      { tabId: 4, domain: "sub.blocked.example", reason: { kind: "always" } },
    ]);
    expect(harness.getUpdateCalls()).toHaveLength(0);
  });

  it("coalesces concurrent reasons into one follow-up reconciliation", async () => {
    const state = createDefaultState();
    state.alwaysBlockedSites = ["example.com"];
    const harness = createHarness(state, { holdFirstUpdate: true });

    const first = harness.reconcile("startup");
    await harness.firstUpdateStarted;
    const second = harness.reconcile("storage");
    const third = harness.reconcile("schedule");
    harness.releaseFirstUpdate();
    await Promise.all([first, second, third]);

    expect(harness.getStateReads()).toBe(2);
    expect(harness.getUpdateCalls()).toHaveLength(2);
  });

  it("isolates rejected rules and reports them without activating runtime hooks", async () => {
    const state = createDefaultState();
    state.alwaysBlockedSites = ["example.com"];
    state.exceptions = ["example.com/docs"];
    const harness = createHarness(state, {
      failInitialBatch: true,
      failRuleIds: [100],
    });

    await harness.reconcile("storage");

    expect(harness.getRules().map((rule) => rule.id)).toEqual([1]);
    expect(harness.getHealthWrites().at(-1)?.lastError).toContain(
      "DNR batch update failed",
    );
    expect(harness.getHealthWrites().at(-1)?.skipped).toContainEqual({
      entry: "example.com/docs",
      reason: "rule 100 rejected",
    });
    expect(harness.getSnapshot()).toBeNull();
  });

  it("keeps valid domains and reports malformed stored entries", async () => {
    const state = createDefaultState();
    state.alwaysBlockedSites = ["valid.example", "bad host"];
    const harness = createHarness(state);

    await harness.reconcile("storage");

    expect(harness.getRules()[0]?.condition.requestDomains).toEqual([
      "valid.example",
    ]);
    expect(harness.getHealthWrites().at(-1)?.skipped).toContainEqual({
      entry: "alwaysBlockedSites[1]: bad host",
      reason: "invalid-domain",
    });
  });
});
