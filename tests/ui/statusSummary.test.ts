import { describe, expect, it } from "vitest";
import { createDefaultState } from "../../src/shared/defaults.ts";
import { localDateKey } from "../../src/shared/time.ts";
import type { AppState, Schedule } from "../../src/shared/types.ts";
import { describeNow } from "../../src/ui/lib/statusSummary.ts";

const L = "en-US";
const NOW = new Date(2026, 10, 3, 11, 0).getTime(); // Tuesday 11:00
const at = (hour: number, minute = 0) => new Date(2026, 10, 3, hour, minute).getTime();

function stateWith(overrides: Partial<AppState> = {}): AppState {
  return { ...createDefaultState(), ...overrides };
}

function session(
  lockLevel: "none" | "strict" | "commitment",
  status: "work" | "shortBreak" | "longBreak" = "work",
  endsAt = at(12, 48),
): AppState["session"] {
  return {
    ...createDefaultState().session,
    status,
    sessionId: "s",
    phaseStartedAt: NOW - 60_000,
    phaseEndsAt: endsAt,
    phasePlannedMs: endsAt - NOW,
    plannedWorkMs: endsAt - NOW,
    lockLevel,
  };
}

const sched = (overrides: Partial<Schedule> = {}): Schedule => ({
  id: "s1",
  name: "Study hours",
  enabled: true,
  days: [0, 1, 2, 3, 4, 5, 6],
  start: "09:00",
  end: "12:00",
  sites: [],
  keywords: [],
  useGlobalLists: true,
  ...overrides,
});

const TWO = ["example.com", "example.org"];

describe("describeNow: idle", () => {
  it("says nothing is blocked yet when there is nothing configured", () => {
    expect(describeNow(stateWith(), NOW, L)).toEqual({
      tone: "idle",
      headline: "Nothing is blocked yet.",
      detail: "Add sites in Rules, then start a focus session.",
      secondary: [],
      canEdit: "all",
      cta: { label: "Add sites", target: "rules" },
    });
  });

  it("reports the Always list when it is the only thing blocking", () => {
    const summary = describeNow(stateWith({ alwaysBlockedSites: ["a.test", "b.test", "c.test"] }), NOW, L);
    expect(summary).toMatchObject({
      tone: "idle",
      headline: "The Always list is blocking 3 sites.",
      detail: "Start a focus session to block your Focus list too.",
    });
    expect(
      describeNow(stateWith({ alwaysBlockedSites: ["a.test"] }), NOW, L).headline,
    ).toBe("The Always list is blocking 1 site.");
  });

  it("says nothing is blocking right now and offers a schedule", () => {
    expect(describeNow(stateWith({ blockedSites: TWO }), NOW, L)).toMatchObject({
      tone: "idle",
      headline: "Nothing is blocking right now.",
      detail: "Start a focus session, or add a schedule to block automatically.",
      cta: { label: "Add a schedule", target: "schedule" },
    });
  });

  it("does not offer a schedule when one exists but is not running", () => {
    const summary = describeNow(
      stateWith({ blockedSites: TWO, schedules: [sched({ start: "18:00", end: "20:00" })] }),
      NOW,
      L,
    );
    expect(summary.headline).toBe("Nothing is blocking right now.");
    expect(summary.cta).toBeUndefined();
  });
});

describe("describeNow: focus session", () => {
  it("lock none", () => {
    expect(describeNow(stateWith({ blockedSites: TWO, session: session("none") }), NOW, L)).toMatchObject({
      tone: "focus",
      headline: "Focus session is on.",
      detail: "Ends 12:48 PM. Blocking 2 sites. You can edit rules and stop any time.",
      canEdit: "all",
    });
  });

  it("uses the singular for one site", () => {
    const summary = describeNow(
      stateWith({ blockedSites: ["example.com"], session: session("none") }),
      NOW,
      L,
    );
    expect(summary.detail).toBe("Ends 12:48 PM. Blocking 1 site. You can edit rules and stop any time.");
  });

  it("strict", () => {
    expect(describeNow(stateWith({ blockedSites: TWO, session: session("strict") }), NOW, L)).toMatchObject({
      tone: "locked",
      headline: "Strict focus session is on.",
      detail: "Ends 12:48 PM. Rules can only get stricter until then.",
      canEdit: "stricter-only",
    });
  });

  it("commitment", () => {
    expect(describeNow(stateWith({ blockedSites: TWO, session: session("commitment") }), NOW, L)).toMatchObject({
      tone: "locked",
      headline: "Commitment session is on.",
      detail: "Ends 12:48 PM. There is no early stop, and rules can only get stricter.",
      canEdit: "stricter-only",
    });
  });

  it("treats a work phase whose end time has passed as idle", () => {
    const summary = describeNow(
      stateWith({ blockedSites: TWO, session: session("strict", "work", NOW - 1) }),
      NOW,
      L,
    );
    expect(summary.tone).toBe("idle");
    expect(summary.canEdit).toBe("all");
  });
});

describe("describeNow: break, Block now and schedule", () => {
  it("break", () => {
    expect(
      describeNow(stateWith({ blockedSites: TWO, session: session("none", "shortBreak", at(12, 53)) }), NOW, L),
    ).toMatchObject({
      tone: "break",
      headline: "On a break.",
      detail: "Focus sites are open until 12:53 PM.",
    });
  });

  it("Block now", () => {
    const state = stateWith({
      standalone: {
        ...createDefaultState().standalone,
        active: true,
        startsAt: NOW - 1_000,
        until: at(13, 15),
        sites: TWO,
      },
    });
    expect(describeNow(state, NOW, L)).toMatchObject({
      tone: "locked",
      headline: "Block now is on.",
      detail: "2 sites are blocked until 1:15 PM. There is no early stop.",
      canEdit: "stricter-only",
    });
  });

  it("Block now with one site", () => {
    const state = stateWith({
      standalone: {
        ...createDefaultState().standalone,
        active: true,
        startsAt: NOW - 1_000,
        until: at(13, 15),
        sites: ["example.com"],
      },
    });
    expect(describeNow(state, NOW, L).detail).toBe("1 site is blocked until 1:15 PM. There is no early stop.");
  });

  it("schedule", () => {
    expect(
      describeNow(stateWith({ blockedSites: TWO, schedules: [sched()] }), NOW, L),
    ).toMatchObject({
      tone: "schedule",
      headline: "Schedule is on: Study hours.",
      detail: "Blocking 2 sites until 12:00 PM.",
      canEdit: "all",
    });
  });
});

describe("describeNow: limits", () => {
  it("adds a line for an exhausted allowance without changing the headline", () => {
    const state = stateWith({
      blockedSites: ["example.net"],
      allowances: { "example.com": { mode: "time_budget", limitMin: 1, duringBlocks: false } },
      usage: {
        "example.com": {
          dateKey: localDateKey(new Date(NOW)),
          usedMs: 60_000,
          opens: 0,
          windowStartMs: 0,
          lastActiveAt: NOW,
        },
      },
    });
    const summary = describeNow(state, NOW, L);
    expect(summary.secondary).toEqual(["example.com reached its daily limit."]);
    expect(summary.tone).toBe("idle");
  });
});
