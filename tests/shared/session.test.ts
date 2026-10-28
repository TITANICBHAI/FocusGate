import { describe, expect, it } from "vitest";
import { createDefaultState } from "../../src/shared/defaults.ts";
import {
  addRecordToDayStats,
  advanceSession,
  appendSessionRecords,
  createSession,
  recoverSession,
  remainingSeconds,
} from "../../src/shared/session.ts";
import type { SessionRecord } from "../../src/shared/types.ts";

describe("session transitions", () => {
  it("creates a timestamp-based work phase and derives remaining time", () => {
    const session = createSession({
      now: 10_000,
      durationMs: 120_000,
      lockLevel: "none",
      taskId: null,
      sessionId: "session-1",
    });

    expect(session.phaseEndsAt).toBe(130_000);
    expect(remainingSeconds(session, 40_001)).toBe(90);
  });

  it("records a completed work phase and follows the configured short/long cycle", () => {
    const settings = createDefaultState().settings;
    const first = createSession({
      now: 1_000,
      durationMs: 60_000,
      lockLevel: "none",
      taskId: "task-1",
      sessionId: "session-2",
    });

    const firstEnd = advanceSession(first, first.phaseEndsAt, settings);
    expect(firstEnd.record?.status).toBe("completed");
    expect(firstEnd.completedTaskId).toBe("task-1");
    expect(firstEnd.session.status).toBe("shortBreak");

    let session = firstEnd.session;
    for (let cycle = 2; cycle <= settings.breaks.cyclesBeforeLong; cycle += 1) {
      session = advanceSession(session, session.phaseEndsAt, {
        ...settings,
        breaks: { ...settings.breaks, autoStartNext: true },
      }).session;
      expect(session.status).toBe("work");
      session = advanceSession(session, session.phaseEndsAt, {
        ...settings,
        breaks: { ...settings.breaks, autoStartNext: true },
      }).session;
    }
    expect(session.status).toBe("longBreak");
  });

  it("marks a phase interrupted when the lost-time gap exceeds half its duration", () => {
    const settings = createDefaultState().settings;
    const session = {
      ...createSession({
        now: 0,
        durationMs: 10 * 60_000,
        lockLevel: "none",
        taskId: null,
        sessionId: "session-3",
      }),
      lastHeartbeatAt: 60_000,
    };

    const result = recoverSession(session, 11 * 60_000, settings);
    expect(result.records).toHaveLength(1);
    expect(result.records[0]?.status).toBe("interrupted");
    expect(result.session.status).toBe("idle");
  });

  it("extends a phase after a backward clock jump and flags its eventual record", () => {
    const settings = createDefaultState().settings;
    const source = {
      ...createSession({
        now: 0,
        durationMs: 10 * 60_000,
        lockLevel: "none",
        taskId: null,
        sessionId: "session-clock-skew",
      }),
      lastHeartbeatAt: 9 * 60_000,
    };

    const recovered = recoverSession(source, 7 * 60_000 + 59_000, settings, {
      updateHeartbeat: true,
    });
    expect(recovered.session.phaseEndsAt).toBe(11 * 60_000 + 1_000);
    expect(recovered.session.clockSkewDetected).toBe(true);
    expect(recovered.session.lastHeartbeatAt).toBe(7 * 60_000 + 59_000);

    const completed = advanceSession(
      recovered.session,
      recovered.session.phaseEndsAt,
      { ...settings, breaks: { ...settings.breaks, enabled: false } },
    );
    expect(completed.record?.clockSkewDetected).toBe(true);
  });

  it("stops missed auto-start cycles after a work phase is interrupted", () => {
    const settings = {
      ...createDefaultState().settings,
      breaks: {
        ...createDefaultState().settings.breaks,
        autoStartNext: true,
        shortMin: 1,
        longMin: 1,
        cyclesBeforeLong: 1,
      },
    };
    const session = createSession({
      now: 1_000,
      durationMs: 30_000,
      lockLevel: "none",
      taskId: null,
      sessionId: "session-4",
    });

    const result = recoverSession(session, 20 * 60_000, settings);
    expect(result.transitions).toBe(1);
    expect(result.records).toHaveLength(1);
    expect(result.records[0]?.status).toBe("interrupted");
    expect(result.session.status).toBe("idle");
  });

  it("caps history at 500 and updates daily focus stats", () => {
    const record: SessionRecord = {
      id: "session-5:1",
      startedAt: new Date(2026, 0, 2, 9).getTime(),
      endedAt: new Date(2026, 0, 2, 9, 25).getTime(),
      plannedMs: 25 * 60_000,
      elapsedMs: 25 * 60_000,
      status: "completed",
      lockLevel: "none",
      blockedAttempts: 0,
      gaps: [],
    };
    const history = appendSessionRecords(
      Array.from({ length: 500 }, (_, index) => ({
        ...record,
        id: `old-${index}`,
      })),
      [record],
    );
    const dayStats = addRecordToDayStats({}, record);

    expect(history).toHaveLength(500);
    expect(history.at(-1)?.id).toBe(record.id);
    expect(Object.values(dayStats)[0]?.focusMs).toBe(25 * 60_000);
    expect(Object.values(dayStats)[0]?.sessionsCompleted).toBe(1);
  });
});
