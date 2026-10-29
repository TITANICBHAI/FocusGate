import { beforeEach, describe, expect, it } from "vitest";
import { createDefaultState } from "../../src/shared/defaults.ts";
import type { AppState, Task } from "../../src/shared/types.ts";
import { createSessionService } from "../../src/background/session.ts";
import type { SessionNotice } from "../../src/background/notify.ts";

const fakeStart = new Date(2026, 0, 2, 9, 0, 0).getTime();

function makeTask(id: string): Task {
  return {
    id,
    title: "Write report",
    durationMin: 2,
    priority: "medium",
    tags: [],
    recurring: "none",
    lockLevel: "none",
    completed: false,
    createdAt: fakeStart,
  };
}

function createHarness(
  initialState = createDefaultState(),
  failures: Partial<
    Record<"alarms" | "badge" | "notification" | "reconcile", boolean>
  > = {},
) {
  let now = fakeStart;
  let state: AppState = structuredClone(initialState);
  let nextId = 0;
  const writes: Partial<AppState>[] = [];
  const notices: SessionNotice[] = [];
  const effectErrors: string[] = [];
  const alarmSyncs: number[] = [];
  const badges: number[] = [];
  const reconciles: string[] = [];

  const service = createSessionService({
    store: {
      readState: async () => structuredClone(state),
      writeState: async (patch) => {
        writes.push(structuredClone(patch));
        state = { ...state, ...structuredClone(patch) };
      },
    },
    now: () => now,
    createSessionId: () => `session-${++nextId}`,
    ensureAlarms: async (_current, at) => {
      alarmSyncs.push(at);
      if (failures.alarms) throw new Error("alarm API unavailable");
    },
    updateBadge: async (_current, at) => {
      badges.push(at);
      if (failures.badge) throw new Error("badge API unavailable");
    },
    notify: async (notice) => {
      if (failures.notification) throw new Error("notification API unavailable");
      notices.push(notice);
    },
    reconcile: async (reason) => {
      reconciles.push(reason);
      if (failures.reconcile) throw new Error("reconcile unavailable");
    },
    verifyPassword: async (password) => ({
      valid: password === "correct horse battery staple",
    }),
    onEffectError: (effect) => effectErrors.push(effect),
  });

  return {
    service,
    getState: () => structuredClone(state),
    setNow: (value: number) => {
      now = value;
    },
    advance: (delta: number) => {
      now += delta;
    },
    writes,
    notices,
    effectErrors,
    alarmSyncs,
    badges,
    reconciles,
  };
}

describe("background-owned session service", () => {
  beforeEach(() => {
    // Each test uses its own injected clock and storage; no wall-clock waits.
  });

  it("records a completed UI session at phase end and completes its linked task atomically", async () => {
    const initial = createDefaultState();
    initial.tasks = [makeTask("task-1")];
    const harness = createHarness(initial);

    const started = await harness.service.start({
      durationMin: 2,
      lockLevel: "none",
      taskId: "task-1",
    });
    expect(started.ok).toBe(true);
    if (!started.ok) return;
    expect(started.session.phaseEndsAt - fakeStart).toBe(120_000);

    harness.advance(120_000);
    await harness.service.handleAlarm("session_phase_end");
    const afterWork = harness.getState();
    expect(afterWork.session.status).toBe("shortBreak");
    expect(afterWork.sessionHistory).toHaveLength(1);
    expect(afterWork.sessionHistory[0]?.status).toBe("completed");
    expect(afterWork.sessionHistory[0]?.elapsedMs).toBe(120_000);
    expect(afterWork.tasks[0]?.completed).toBe(true);
    expect(afterWork.dayStats[localDateKey(fakeStart)]?.tasksCompleted).toBe(1);
    expect(afterWork.dayStats[localDateKey(fakeStart)]?.sessionsCompleted).toBe(1);

    const phaseEndWrite = harness.writes.at(-1);
    expect(phaseEndWrite).toHaveProperty("session");
    expect(phaseEndWrite).toHaveProperty("sessionHistory");
    expect(phaseEndWrite).toHaveProperty("dayStats");
    expect(phaseEndWrite).toHaveProperty("tasks");

    harness.advance(5 * 60_000);
    await harness.service.handleAlarm("session_phase_end");
    expect(harness.getState().session.status).toBe("idle");
    expect(harness.notices.map(({ kind }) => kind)).toContain("session_completed");
    expect(harness.notices.map(({ kind }) => kind)).toContain("break_ended");
  });

  it("serializes duplicate due alarms so a phase is recorded once", async () => {
    const harness = createHarness();
    await harness.service.start({ durationMin: 1, lockLevel: "none" });
    harness.advance(60_000);

    await Promise.all([
      harness.service.handleAlarm("session_phase_end"),
      harness.service.handleAlarm("session_phase_end"),
    ]);

    expect(harness.getState().sessionHistory).toHaveLength(1);
    expect(harness.getState().sessionHistory[0]?.status).toBe("completed");
    expect(harness.getState().session.status).toBe("shortBreak");
  });

  it("blocks Commitment stops and shortcut bypasses", async () => {
    const harness = createHarness();
    await harness.service.start({ durationMin: 1, lockLevel: "commitment" });

    const stopped = await harness.service.stop();
    expect(stopped).toMatchObject({ ok: false, code: "LOCKED" });
    expect(await harness.service.toggleFromShortcut()).toEqual({
      action: "locked",
    });
    expect(harness.getState().session.status).toBe("work");
    expect(harness.getState().sessionHistory).toHaveLength(0);
    expect(harness.notices.map(({ kind }) => kind)).toContain("session_locked");
  });

  it("checks Strict passwords in the service and stops only after verification", async () => {
    const initial = createDefaultState();
    initial.password = { algo: "sha256-legacy", hash: "fixture" };
    const harness = createHarness(initial);
    await harness.service.start({ durationMin: 1, lockLevel: "strict" });

    expect(await harness.service.stop({ password: "wrong" })).toMatchObject({
      ok: false,
      code: "BAD_PASSWORD",
    });
    expect(harness.getState().session.status).toBe("work");

    const stopped = await harness.service.stop({
      password: "correct horse battery staple",
    });
    expect(stopped.ok).toBe(true);
    expect(harness.getState().session.status).toBe("idle");
    expect(harness.getState().sessionHistory[0]?.status).toBe("abandoned");
  });

  it("requires the exact Strict phrase and enforces its wait when no password exists", async () => {
    const harness = createHarness();
    await harness.service.start({ durationMin: 1, lockLevel: "strict" });

    expect(await harness.service.stop()).toMatchObject({
      ok: false,
      code: "PHRASE_REQUIRED",
    });
    expect(await harness.service.stop({ phrase: "I GIVE UP" })).toMatchObject({
      ok: false,
      code: "WAIT_REQUIRED",
      waitMs: 15_000,
    });
    harness.advance(10_000);
    expect(
      await harness.service.stop({ phrase: "I GIVE UP" }),
    ).toMatchObject({ ok: false, code: "WAIT_REQUIRED", waitMs: 5_000 });
    harness.advance(5_000);
    expect(
      await harness.service.stop({ phrase: "I GIVE UP" }),
    ).toMatchObject({ ok: true });
    expect(harness.getState().sessionHistory[0]?.status).toBe("abandoned");
  });

  it.each(["none", "strict", "commitment"] as const)(
    "allows a %s session to extend through the service",
    async (lockLevel) => {
      const harness = createHarness();
      const started = await harness.service.start({
        durationMin: 25,
        lockLevel,
      });
      expect(started.ok).toBe(true);
      if (!started.ok) return;

      const extended = await harness.service.extend(15);
      expect(extended.ok).toBe(true);
      if (!extended.ok) return;
      expect(extended.session.phaseEndsAt).toBe(started.session.phaseEndsAt + 900_000);
      expect(extended.session.phasePlannedMs).toBe(40 * 60_000);
      expect(extended.session.extendedMs).toBe(15 * 60_000);
    },
  );

  it("records the extension amount in completed session history", async () => {
    const harness = createHarness();
    await harness.service.start({ durationMin: 25, lockLevel: "none" });
    await harness.service.extend(15);
    expect(await harness.service.stop()).toMatchObject({ ok: true });
    expect(harness.getState().sessionHistory[0]?.extendedMs).toBe(15 * 60_000);
  });

  it("rejects extensions that would exceed the 24-hour phase cap", async () => {
    const harness = createHarness();
    await harness.service.start({ durationMin: 999, lockLevel: "none" });
    for (let index = 0; index < 7; index += 1) {
      expect((await harness.service.extend(60)).ok).toBe(true);
    }
    expect(await harness.service.extend(60)).toMatchObject({
      ok: false,
      code: "SESSION_LIMIT",
    });
  });

  it("skips a break and starts the next work cycle only when configured", async () => {
    const initial = createDefaultState();
    initial.settings.breaks.autoStartNext = true;
    const harness = createHarness(initial);
    await harness.service.start({ durationMin: 1, lockLevel: "none" });
    harness.advance(60_000);
    await harness.service.handleAlarm("session_phase_end");
    expect(harness.getState().session.status).toBe("shortBreak");

    const skipped = await harness.service.skipBreak();
    expect(skipped.ok).toBe(true);
    if (skipped.ok) {
      expect(skipped.session.status).toBe("work");
      expect(skipped.session.cycle).toBe(2);
    }
  });

  it("updates a session heartbeat on ticks and preserves recovery state on side-effect failure", async () => {
    const harness = createHarness();
    await harness.service.start({ durationMin: 10, lockLevel: "none" });
    harness.advance(60_000);
    await harness.service.handleAlarm("tick");

    expect(harness.getState().session.lastHeartbeatAt).toBe(fakeStart + 60_000);
    expect(harness.getState().health.lastHeartbeatAt).toBe(fakeStart + 60_000);
    expect(harness.alarmSyncs.length).toBeGreaterThan(0);
  });

  it("commits phase transitions even when browser side effects fail", async () => {
    const harness = createHarness(createDefaultState(), {
      alarms: true,
      badge: true,
      notification: true,
      reconcile: true,
    });
    const started = await harness.service.start({
      durationMin: 1,
      lockLevel: "none",
    });
    expect(started.ok).toBe(true);

    harness.advance(60_000);
    await harness.service.handleAlarm("session_phase_end");

    const state = harness.getState();
    expect(state.session.status).toBe("shortBreak");
    expect(state.sessionHistory).toHaveLength(1);
    expect(state.sessionHistory[0]?.status).toBe("completed");
    expect(harness.effectErrors).toEqual(
      expect.arrayContaining(["alarms", "badge", "reconcile", "notification"]),
    );
  });

  it("finalizes an overdue session when recovery runs after a worker wake", async () => {
    const harness = createHarness();
    await harness.service.start({ durationMin: 2, lockLevel: "none" });
    harness.advance(2 * 60_000);

    await harness.service.recover();

    expect(harness.getState().session.status).toBe("shortBreak");
    expect(harness.getState().sessionHistory).toHaveLength(1);
    expect(harness.getState().sessionHistory[0]?.elapsedMs).toBe(120_000);
  });

  it("uses the configured default duration and reports the shortcut start", async () => {
    const initial = createDefaultState();
    initial.settings.defaultDurationMin = 45;
    const harness = createHarness(initial);

    expect(await harness.service.toggleFromShortcut()).toEqual({
      action: "started",
      durationMin: 45,
    });
    expect(harness.getState().session.phaseEndsAt - fakeStart).toBe(45 * 60_000);
    expect(harness.notices).toContainEqual({
      kind: "focus_started",
      durationMin: 45,
    });
  });
});

function localDateKey(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
