import { describe, expect, it } from "vitest";
import { buildDoneCard, CHIME_FRESH_MS, DONE_CARD_WINDOW_MS } from "../../src/shared/celebration.ts";
import { createDefaultState } from "../../src/shared/defaults.ts";
import { addRecordToDayStats } from "../../src/shared/session.ts";
import type { AppState, SessionRecord } from "../../src/shared/types.ts";

const MIN = 60_000;
const DAY = 86_400_000;
const T0 = new Date(2026, 10, 11, 10, 0).getTime();

function record(id: string, startedAt: number, overrides: Partial<SessionRecord> = {}): SessionRecord {
  const elapsedMs = overrides.elapsedMs ?? 25 * MIN;
  return {
    id,
    startedAt,
    endedAt: startedAt + elapsedMs,
    plannedMs: 25 * MIN,
    elapsedMs,
    status: "completed",
    lockLevel: "none",
    blockedAttempts: 0,
    gaps: [],
    ...overrides,
  };
}

function stateWith(records: SessionRecord[], goalMin = 60): AppState {
  const state = createDefaultState();
  state.settings.dailyGoalMin = goalMin;
  state.settings.breaks.enabled = false;
  for (const item of records) {
    state.sessionHistory.push(item);
    state.dayStats = addRecordToDayStats(state.dayStats, item);
  }
  return state;
}

const justAfter = (r: SessionRecord) => r.endedAt + 5_000;

describe("when there is a done card", () => {
  it("is none when nothing has been recorded", () => {
    expect(buildDoneCard(createDefaultState(), T0)).toBeNull();
  });

  it("is made for the latest completed session", () => {
    const r = record("s:1", T0);
    const card = buildDoneCard(stateWith([r]), justAfter(r));
    expect(card).toMatchObject({ recordId: "s:1", kind: "completed", headline: "25 min, done" });
  });

  it("is none once a new session is running", () => {
    const r = record("s:1", T0);
    const state = stateWith([r]);
    state.session = { ...state.session, status: "work" };
    expect(buildDoneCard(state, justAfter(r))).toBeNull();
  });

  it("is none for an interrupted session", () => {
    const r = record("s:1", T0, { status: "interrupted" });
    expect(buildDoneCard(stateWith([r]), justAfter(r))).toBeNull();
  });

  it("goes stale after a few hours, and not before", () => {
    const r = record("s:1", T0);
    expect(buildDoneCard(stateWith([r]), r.endedAt + DONE_CARD_WINDOW_MS - 1)).not.toBeNull();
    expect(buildDoneCard(stateWith([r]), r.endedAt + DONE_CARD_WINDOW_MS + 1)).toBeNull();
  });

  it("says hours and minutes for a long session", () => {
    const r = record("s:1", T0, { elapsedMs: 65 * MIN });
    expect(buildDoneCard(stateWith([r]), justAfter(r))?.headline).toBe("1 h 5 min, done");
    const r2 = record("s:2", T0, { elapsedMs: 120 * MIN });
    expect(buildDoneCard(stateWith([r2]), justAfter(r2))?.headline).toBe("2 h, done");
  });

  it("counts the minutes the way the day totals do, leaving out time the browser was closed", () => {
    const r = record("s:1", T0, { gaps: [{ from: T0 + 5 * MIN, to: T0 + 10 * MIN }] });
    expect(buildDoneCard(stateWith([r]), justAfter(r))?.headline).toBe("20 min, done");
  });
});

describe("the one true line", () => {
  it("says the goal was reached when this session took the day to the goal", () => {
    const a = record("s:1", T0, { elapsedMs: 40 * MIN });
    const b = record("s:2", T0 + 50 * MIN);
    const card = buildDoneCard(stateWith([a, b]), justAfter(b));
    expect(card?.line).toBe("That’s your 60 min goal for today.");
    expect(card?.goal).toEqual({ before: 40 / 60, after: 1, reached: true });
  });

  it("does not say it again when the goal was already reached before this session", () => {
    const a = record("s:1", T0, { elapsedMs: 70 * MIN });
    const b = record("s:2", T0 + 80 * MIN);
    const card = buildDoneCard(stateWith([a, b]), justAfter(b));
    expect(card?.goal?.reached).toBe(false);
    expect(card?.line).not.toContain("goal for today");
  });

  it("does not reach the goal because of minutes from a stopped session", () => {
    const stopped = record("s:1", T0, { status: "abandoned", elapsedMs: 40 * MIN });
    const b = record("s:2", T0 + 50 * MIN);
    const card = buildDoneCard(stateWith([stopped, b]), justAfter(b));
    expect(card?.goal).toEqual({ before: 0, after: 25 / 60, reached: false });
    expect(card?.line).toBe("35 min from today’s goal.");
  });

  it("says how far the goal is when it is not reached", () => {
    const r = record("s:1", T0);
    expect(buildDoneCard(stateWith([r]), justAfter(r))?.line).toBe("35 min from today’s goal.");
  });

  it("says back after N days when the last finished session was 3 or more days ago", () => {
    const old = record("s:0", T0 - 5 * DAY);
    const r = record("s:1", T0);
    expect(buildDoneCard(stateWith([old, r], 25), justAfter(r))?.line).not.toBe("Back after 5 days.");
    const card = buildDoneCard(stateWith([old, r], 600), justAfter(r));
    expect(card?.line).toBe("Back after 5 days.");
  });

  it("does not say back after for a gap of 2 days, or for a first session", () => {
    const old = record("s:0", T0 - 2 * DAY);
    const r = record("s:1", T0);
    expect(buildDoneCard(stateWith([old, r], 600), justAfter(r))?.line).not.toMatch(/Back after/);
    expect(buildDoneCard(stateWith([r], 600), justAfter(r))?.line).not.toMatch(/Back after/);
  });

  it("says longest session yet only when it beats at least two earlier ones", () => {
    const a = record("s:1", T0 - 3 * 60 * MIN, { elapsedMs: 25 * MIN });
    const b = record("s:2", T0 - 2 * 60 * MIN, { elapsedMs: 30 * MIN });
    const c = record("s:3", T0, { elapsedMs: 45 * MIN });
    expect(buildDoneCard(stateWith([a, b, c], 600), justAfter(c))?.line).toBe("Your longest session yet.");
    expect(buildDoneCard(stateWith([b, c], 600), justAfter(c))?.line).not.toBe("Your longest session yet.");
  });

  it("says no to N distractions from 3 blocked attempts", () => {
    const r = record("s:1", T0, { blockedAttempts: 4 });
    expect(buildDoneCard(stateWith([r], 600), justAfter(r))?.line).toBe("You said no to 4 distractions.");
    const few = record("s:1", T0, { blockedAttempts: 2 });
    expect(buildDoneCard(stateWith([few], 600), justAfter(few))?.line).not.toMatch(/said no/);
  });

  it("says which session of the day it is from the second one", () => {
    const a = record("s:1", T0 - 60 * MIN);
    const b = record("s:2", T0);
    expect(buildDoneCard(stateWith([a, b], 600), justAfter(b))?.line).toBe("Your 2nd session today.");
    const c = record("s:3", T0 + 60 * MIN);
    expect(buildDoneCard(stateWith([a, b, c], 600), justAfter(c))?.line).toBe("Your 3rd session today.");
  });

  it("uses th for 11th to 13th", () => {
    const list = Array.from({ length: 11 }, (_, i) => record(`s:${i}`, T0 - (11 - i) * 30 * MIN, { elapsedMs: 10 * MIN }));
    const last = list[list.length - 1]!;
    expect(buildDoneCard(stateWith(list, 6000), justAfter(last))?.line).toBe("Your 11th session today.");
  });

  it("moves down the list when the goal is not this session’s, and still has the goal line for a first session that reaches it", () => {
    const a = record("s:1", T0 - 120 * MIN, { elapsedMs: 70 * MIN });
    const r = record("s:2", T0, { elapsedMs: 5 * MIN });
    const card = buildDoneCard(stateWith([a, r]), justAfter(r));
    expect(card?.line).toBe("Your 2nd session today.");
    const solo = stateWith([record("s:1", T0, { elapsedMs: 70 * MIN })]);
    expect(buildDoneCard(solo, T0 + 71 * MIN)).toMatchObject({ line: "That’s your 60 min goal for today." });
  });
});

describe("achievements on the card", () => {
  it("lists the ones unlocked when this session ended, by name", () => {
    const r = record("s:1", T0);
    const state = stateWith([r]);
    state.achievements = [
      { id: "IRON_SESSION", unlockedAt: r.endedAt + 1_000 },
      { id: "BACK_AGAIN", unlockedAt: r.startedAt - DAY },
    ];
    expect(buildDoneCard(state, justAfter(r))?.achievements).toEqual(["Iron Session"]);
  });

  it("has none otherwise", () => {
    const r = record("s:1", T0);
    expect(buildDoneCard(stateWith([r]), justAfter(r))?.achievements).toEqual([]);
  });
});

describe("the break tip", () => {
  it("is there when breaks are on and a break has started, with its real length", () => {
    const r = record("s:1", T0);
    const state = stateWith([r]);
    state.settings.breaks.enabled = true;
    state.session = { ...state.session, status: "shortBreak", phasePlannedMs: 5 * MIN };
    expect(buildDoneCard(state, justAfter(r))?.breakTip).toBe("Break time: 5 min. Look away from the screen for a bit.");
  });

  it("is absent when breaks are off, or no break is running", () => {
    const r = record("s:1", T0);
    const off = stateWith([r]);
    off.session = { ...off.session, status: "shortBreak", phasePlannedMs: 5 * MIN };
    expect(buildDoneCard(off, justAfter(r))?.breakTip).toBeNull();
    const idle = stateWith([r]);
    idle.settings.breaks.enabled = true;
    expect(buildDoneCard(idle, justAfter(r))?.breakTip).toBeNull();
  });
});

describe("a session that was stopped early", () => {
  const stopped = record("s:1", T0, { status: "abandoned", elapsedMs: 12 * MIN, blockedAttempts: 5 });
  const card = buildDoneCard(stateWith([stopped]), justAfter(stopped));

  it("gets a neutral card with the real minutes", () => {
    expect(card).toMatchObject({
      kind: "stopped",
      headline: "You focused for 12 minutes.",
      line: "Pick it up whenever you’re ready.",
    });
  });

  it("gets no celebration: no goal moment, no achievements, no break tip, no stats line", () => {
    expect(card?.goal).toBeNull();
    expect(card?.achievements).toEqual([]);
    expect(card?.breakTip).toBeNull();
  });

  it("says minute, not minutes, for one", () => {
    const one = record("s:1", T0, { status: "abandoned", elapsedMs: 90_000 });
    expect(buildDoneCard(stateWith([one]), justAfter(one))?.headline).toBe("You focused for 1 minute.");
  });

  it("is none when less than a minute was focused", () => {
    const tiny = record("s:1", T0, { status: "abandoned", elapsedMs: 30_000 });
    expect(buildDoneCard(stateWith([tiny]), justAfter(tiny))).toBeNull();
  });
});

describe("the chime window", () => {
  it("is a few minutes, so a card found hours later does not ring", () => {
    expect(CHIME_FRESH_MS).toBeGreaterThanOrEqual(60_000);
    expect(CHIME_FRESH_MS).toBeLessThanOrEqual(10 * 60_000);
    expect(CHIME_FRESH_MS).toBeLessThan(DONE_CARD_WINDOW_MS);
  });
});
