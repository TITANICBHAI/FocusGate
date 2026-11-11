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
      tone: "standing",
      headline: "Blocking 3 sites.",
      detail: "From your Always list.",
    });
    expect(
      describeNow(stateWith({ alwaysBlockedSites: ["a.test"] }), NOW, L).headline,
    ).toBe("Blocking 1 site.");
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

const limitOn = (domain: string): AppState["allowances"] => ({
  [domain]: { mode: "time_budget", limitMin: 1, duringBlocks: false },
});
const usedUp = (domain: string): AppState["usage"] => ({
  [domain]: {
    dateKey: localDateKey(new Date(NOW)),
    usedMs: 60_000,
    opens: 0,
    windowStartMs: 0,
    lastActiveAt: NOW,
  },
});

describe("describeNow: limits", () => {
  it("counts a site that ran out of time as blocking, and names it", () => {
    const state = stateWith({
      blockedSites: ["example.net"],
      allowances: limitOn("example.com"),
      usage: usedUp("example.com"),
    });
    const summary = describeNow(state, NOW, L);
    expect(summary.tone).toBe("standing");
    expect(summary.headline).toBe("Blocking 1 site.");
    expect(summary.detail).toBe("From your limits.");
    expect(summary.secondary).toEqual([
      "example.com reached its daily limit.",
      "Start a focus session to block your Focus list too.",
    ]);
  });
});

describe("describeNow: standing rules", () => {
  const keyword = (text: string, when: "always" | "blocks", mode: "block" | "hide" | "both" = "block") => ({
    text,
    mode,
    when,
  });

  it("names the Always list, keywords and limits together and never says nothing is blocking", () => {
    const summary = describeNow(
      stateWith({
        alwaysBlockedSites: ["a.test", "b.test"],
        keywords: [keyword("gossip", "always"), keyword("memes", "always", "both")],
        allowances: limitOn("c.test"),
        usage: usedUp("c.test"),
      }),
      NOW,
      L,
    );
    expect(summary).toMatchObject({
      tone: "standing",
      headline: "Blocking 3 sites and 2 keywords.",
      detail: "From your Always list, keywords and limits.",
    });
    expect(summary.secondary).toEqual(["c.test reached its daily limit."]);
    expect(summary.cta).toBeUndefined();
    expect(`${summary.headline} ${summary.detail}`).not.toContain("Nothing is blocking");
  });

  it("counts entries on the Always list, not every address one of them covers", () => {
    // youtube.com also covers youtu.be and youtube-nocookie.com; the person added one site.
    const summary = describeNow(stateWith({ alwaysBlockedSites: ["youtube.com"] }), NOW, L);
    expect(summary.headline).toBe("Blocking 1 site.");
    expect(
      describeNow(
        stateWith({
          alwaysBlockedSites: ["youtube.com"],
          session: session("none", "shortBreak", at(12, 53)),
        }),
        NOW,
        L,
      ).secondary,
    ).toEqual(["The Always list is still blocking 1 site."]);
  });

  it("counts a keyword that is on all the time", () => {
    expect(describeNow(stateWith({ keywords: [keyword("gossip", "always")] }), NOW, L)).toMatchObject({
      tone: "standing",
      headline: "Blocking 1 keyword.",
      detail: "From your keywords.",
    });
  });

  it("does not count a word that is only hidden", () => {
    const summary = describeNow(stateWith({ keywords: [keyword("spoiler", "always", "hide")] }), NOW, L);
    expect(summary.tone).toBe("idle");
    expect(summary.headline).toBe("Nothing is blocking right now.");
  });

  it("points to the Focus list when it is not blocking yet", () => {
    const summary = describeNow(stateWith({ alwaysBlockedSites: ["a.test"], blockedSites: TWO }), NOW, L);
    expect(summary.secondary).toEqual(["Start a focus session to block your Focus list too."]);
    expect(describeNow(stateWith({ alwaysBlockedSites: ["a.test"] }), NOW, L).secondary).toEqual([]);
  });

  it("says a limit is watching a site that has not run out", () => {
    const summary = describeNow(stateWith({ allowances: limitOn("example.com") }), NOW, L);
    expect(summary).toMatchObject({
      tone: "idle",
      headline: "Nothing is blocking right now.",
      detail: "Add sites to your Focus list to block them in a session.",
      cta: { label: "Add sites", target: "rules" },
    });
    expect(summary.secondary).toEqual(["Limits are watching 1 site."]);
  });

  it("keeps the standing blocks and the watched limits apart", () => {
    const summary = describeNow(
      stateWith({
        alwaysBlockedSites: ["a.test"],
        allowances: { ...limitOn("c.test"), ...limitOn("d.test") },
      }),
      NOW,
      L,
    );
    expect(summary.headline).toBe("Blocking 1 site.");
    expect(summary.secondary).toEqual(["Limits are watching 2 sites."]);
  });

  it("explains a keyword that only works during sessions and schedules", () => {
    const summary = describeNow(
      stateWith({ blockedSites: TWO, keywords: [keyword("gossip", "blocks"), keyword("memes", "blocks")] }),
      NOW,
      L,
    );
    expect(summary.tone).toBe("idle");
    expect(summary.secondary).toEqual(["2 keywords apply only during focus sessions and schedules."]);
    expect(
      describeNow(stateWith({ blockedSites: TWO, keywords: [keyword("gossip", "blocks")] }), NOW, L).secondary,
    ).toEqual(["1 keyword applies only during focus sessions and schedules."]);
  });

  it("names the next schedule instead of asking for one when schedules exist", () => {
    const later = sched({ start: "18:00", end: "20:00" });
    const summary = describeNow(stateWith({ blockedSites: TWO, schedules: [later] }), NOW, L);
    expect(summary.headline).toBe("Nothing is blocking right now.");
    expect(summary.detail).toBe("Next: Study hours, today 6:00 PM.");
    expect(summary.cta).toBeUndefined();
  });

  it("says when every schedule is off", () => {
    const off = sched({ enabled: false });
    expect(describeNow(stateWith({ blockedSites: TWO, schedules: [off] }), NOW, L).detail).toBe(
      "All schedules are off.",
    );
  });

  it("still tells a person on a break that the Always list and keywords are on", () => {
    const summary = describeNow(
      stateWith({
        blockedSites: TWO,
        alwaysBlockedSites: ["a.test", "b.test"],
        keywords: [keyword("gossip", "always")],
        session: session("none", "shortBreak", at(12, 53)),
      }),
      NOW,
      L,
    );
    expect(summary.tone).toBe("break");
    expect(summary.secondary).toEqual([
      "The Always list is still blocking 2 sites.",
      "1 keyword is still blocking pages.",
    ]);
  });
});
