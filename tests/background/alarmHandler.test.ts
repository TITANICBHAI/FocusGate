import { describe, expect, it } from "vitest";
import { createAlarmHandler } from "../../src/background/alarmHandler.ts";
import { MIDNIGHT_ALARM } from "../../src/background/alarms.ts";
import { computeBlockPlan } from "../../src/shared/plan.ts";
import { createDefaultState } from "../../src/shared/defaults.ts";
import { localDateKey } from "../../src/shared/time.ts";
import type { AppState } from "../../src/shared/types.ts";

function createHarness(
  initialState: AppState = createDefaultState(),
  extras: {
    reflection?: { notifyEndOfDay(now: number): Promise<void> };
    achievements?: { evaluate(now: number): Promise<void> };
  } = {},
) {
  let state = structuredClone(initialState);
  let now = 100_000;
  const calls: string[] = [];
  const errors: string[] = [];
  const handler = createAlarmHandler({
    getState: async () => structuredClone(state),
    ensureAlarms: async (_state, plan, at) => {
      calls.push(`ensure:${at}:${plan.nextBoundaryAt}`);
    },
    session: {
      handleAlarm: async (name) => {
        calls.push(`session:${name}`);
      },
    },
    attention: {
      sample: async () => {
        calls.push("attention");
      },
    },
    auditOpenTabs: async (_state, at) => {
      calls.push(`audit:${at}`);
    },
    reconcile: async (reason) => {
      calls.push(`reconcile:${reason}`);
    },
    handleWeeklyReport: async () => {
      calls.push("weekly-report");
    },
    handleMidnight: async () => {
      calls.push("midnight");
    },
    ...(extras.reflection ? { reflection: extras.reflection } : {}),
    ...(extras.achievements ? { achievements: extras.achievements } : {}),
    now: () => now,
    onEffectError: (effect) => errors.push(effect),
  });

  return {
    handler,
    calls,
    errors,
    setNow: (value: number) => {
      now = value;
    },
    setState: (value: AppState) => {
      state = structuredClone(value);
    },
  };
}

describe("staged alarm handler", () => {
  it("re-arms schedules, samples attention, and audits open tabs on active ticks", async () => {
    const state = createDefaultState();
    state.alwaysBlockedSites = ["blocked.example"];
    const harness = createHarness(state);

    expect(await harness.handler("tick")).toBe(true);
    expect(harness.calls).toEqual([
      `ensure:100000:${computeBlockPlan(state, 100_000).nextBoundaryAt}`,
      "session:tick",
      "attention",
      "audit:100000",
    ]);
  });

  it("skips the open-tab audit when no blocking is active", async () => {
    const harness = createHarness();

    expect(await harness.handler("tick")).toBe(true);
    expect(harness.calls).not.toContain("audit:100000");
    expect(harness.calls).toContain("attention");
  });

  it("runs the safety audit for an allowance-only exhausted block", async () => {
    const state = createDefaultState();
    state.allowances["limited.example"] = {
      mode: "time_budget",
      limitMin: 1,
      duringBlocks: false,
    };
    state.usage["limited.example"] = {
      dateKey: localDateKey(new Date(100_000)),
      usedMs: 60_000,
      opens: 1,
      windowStartMs: 0,
      lastActiveAt: 0,
    };
    const harness = createHarness(state);

    await harness.handler("tick");
    expect(harness.calls).toContain("audit:100000");
  });

  it("routes boundary, phase, weekly-report, and midnight alarms", async () => {
    const state = createDefaultState();
    const harness = createHarness(state);
    const ensureCall = `ensure:100000:${computeBlockPlan(state, 100_000).nextBoundaryAt}`;

    await harness.handler("boundary");
    await harness.handler("session_phase_end");
    await harness.handler("weekly_report");
    await harness.handler("midnight");
    expect(harness.calls).toEqual([
      ensureCall,
      "reconcile:boundary",
      ensureCall,
      "session:session_phase_end",
      ensureCall,
      "weekly-report",
      ensureCall,
      "midnight",
      "reconcile:midnight",
    ]);
    expect(await harness.handler("unknown")).toBe(false);
  });

  it("runs the reflection and achievement hooks at midnight when present", async () => {
    const hookCalls: string[] = [];
    const harness = createHarness(createDefaultState(), {
      reflection: {
        notifyEndOfDay: async () => {
          hookCalls.push("reflection");
        },
      },
      achievements: {
        evaluate: async () => {
          hookCalls.push("achievements");
        },
      },
    });

    expect(await harness.handler(MIDNIGHT_ALARM)).toBe(true);
    expect(harness.calls).toContain("midnight");
    expect(hookCalls).toEqual(["reflection", "achievements"]);
    expect(harness.errors).toEqual([]);
  });

  it("continues the recognized handler when alarm re-arming fails", async () => {
    const harness = createHarness();
    const failing = createAlarmHandler({
      getState: async () => createDefaultState(),
      ensureAlarms: async () => {
        throw new Error("alarm API unavailable");
      },
      session: { handleAlarm: async (name) => harness.calls.push(`session:${name}`) },
      attention: { sample: async () => harness.calls.push("attention") },
      auditOpenTabs: async () => harness.calls.push("audit"),
      reconcile: async (reason) => harness.calls.push(`reconcile:${reason}`),
      handleWeeklyReport: async () => harness.calls.push("weekly-report"),
      handleMidnight: async () => harness.calls.push("midnight"),
      now: () => 100_000,
      onEffectError: (effect) => harness.errors.push(effect),
    });

    expect(await failing("session_phase_end")).toBe(true);
    expect(harness.errors).toContain("alarm-setup");
    expect(harness.calls).toContain("session:session_phase_end");
  });
});
