import { describe, expect, it } from "vitest";
import { createDefaultState } from "../../src/shared/defaults.ts";
import type { AppState, Schedule } from "../../src/shared/types.ts";
import {
  SCHEDULE_TEMPLATES,
  blocksNothing,
  draftFromSchedule,
  emptyDraft,
  planScheduleSave,
  targetOf,
} from "../../src/ui/lib/scheduleForm.ts";

const NOW = 1_000_000;

function schedule(overrides: Partial<Schedule> = {}): Schedule {
  return {
    id: "s1",
    name: "Study hours",
    enabled: true,
    days: [1, 2, 3, 4, 5],
    start: "09:00",
    end: "17:00",
    sites: [],
    keywords: [],
    useGlobalLists: true,
    ...overrides,
  };
}

function stateWith(schedules: Schedule[], overrides: Partial<AppState> = {}): AppState {
  return { ...createDefaultState(), schedules, ...overrides };
}

const newId = () => "new-id";

describe("targets", () => {
  it("maps stored fields to a target and back", () => {
    expect(targetOf(schedule({ useGlobalLists: true, sites: [] }))).toBe("list");
    expect(targetOf(schedule({ useGlobalLists: false, sites: ["a.com"] }))).toBe("own");
    expect(targetOf(schedule({ useGlobalLists: true, sites: ["a.com"] }))).toBe("both");

    const own = planScheduleSave({
      state: stateWith([]),
      draft: { ...emptyDraft(), name: "Night", target: "own", sitesText: "a.com\nB.com" },
      editingId: null,
      now: NOW,
      newId,
    });
    expect(own).toMatchObject({
      ok: true,
      schedule: { useGlobalLists: false, sites: ["a.com", "b.com"] },
    });

    const both = planScheduleSave({
      state: stateWith([]),
      draft: { ...emptyDraft(), name: "Night", target: "both", sitesText: "a.com" },
      editingId: null,
      now: NOW,
      newId,
    });
    expect(both).toMatchObject({ ok: true, schedule: { useGlobalLists: true, sites: ["a.com"] } });

    const list = planScheduleSave({
      state: stateWith([]),
      draft: { ...emptyDraft(), name: "Night", target: "list", sitesText: "ignored.com" },
      editingId: null,
      now: NOW,
      newId,
    });
    expect(list).toMatchObject({ ok: true, schedule: { useGlobalLists: true, sites: [] } });
  });

  it("flags schedules that block nothing", () => {
    const empty = stateWith([]);
    expect(blocksNothing(schedule({ useGlobalLists: true, sites: [] }), empty)).toBe(true);
    expect(
      blocksNothing(schedule({ useGlobalLists: true, sites: [] }), {
        ...empty,
        blockedSites: ["a.com"],
      }),
    ).toBe(false);
    expect(blocksNothing(schedule({ useGlobalLists: false, sites: [] }), empty)).toBe(true);
    expect(blocksNothing(schedule({ useGlobalLists: false, sites: ["a.com"] }), empty)).toBe(
      false,
    );
  });
});

describe("planScheduleSave validation", () => {
  const plan = (draft: Partial<ReturnType<typeof emptyDraft>>) =>
    planScheduleSave({
      state: stateWith([]),
      draft: { ...emptyDraft(), name: "Night", ...draft },
      editingId: null,
      now: NOW,
      newId,
    });

  it("asks for a name, a day and readable times", () => {
    expect(plan({ name: "  " })).toEqual({ ok: false, error: "Enter a name for this schedule." });
    expect(plan({ days: [] })).toEqual({ ok: false, error: "Choose at least one day." });
    expect(plan({ start: "" })).toEqual({
      ok: false,
      error: "Use a valid start time and an end time up to 24:00.",
    });
  });

  it("asks for sites when the schedule uses its own", () => {
    const result = plan({ target: "own", sitesText: "  \n " });
    expect(result.ok).toBe(false);
    expect(plan({ target: "own", sitesText: "not a site" }).ok).toBe(false);
  });

  it("builds a new schedule with a trimmed name and removes duplicate sites", () => {
    const result = plan({ name: "  Night  ", target: "own", sitesText: "a.com\nA.com\nhttps://www.b.com/x" });
    expect(result).toMatchObject({
      ok: true,
      schedule: { id: "new-id", name: "Night", enabled: true, sites: ["a.com", "b.com"] },
    });
    if (result.ok) expect(result.schedules).toHaveLength(1);
  });
});

describe("planScheduleSave editing", () => {
  it("keeps the id, enabled flag and keywords of the schedule being edited", () => {
    const existing = schedule({ enabled: false, keywords: ["news"] });
    const result = planScheduleSave({
      state: stateWith([existing]),
      draft: { ...draftFromSchedule(existing), name: "Renamed" },
      editingId: "s1",
      now: NOW,
      newId,
    });
    expect(result).toMatchObject({
      ok: true,
      schedule: { id: "s1", name: "Renamed", enabled: false },
    });
    if (result.ok) {
      expect(result.schedule.keywords).toEqual(existing.keywords);
      expect(result.schedules).toHaveLength(1);
    }
  });

  it("shows the lock reason instead of saving when a strict session would be weakened", () => {
    const base = createDefaultState();
    const existing = schedule({ start: "09:00", end: "17:00" });
    const locked = stateWith([existing], {
      session: {
        ...base.session,
        status: "work",
        lockLevel: "strict",
        phaseEndsAt: NOW + 60 * 60_000,
      },
    });
    const result = planScheduleSave({
      state: locked,
      draft: { ...draftFromSchedule(existing), end: "12:00" },
      editingId: "s1",
      now: NOW,
      newId,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("strict session");
  });

  it("still allows a strengthening edit during a strict session", () => {
    const base = createDefaultState();
    const existing = schedule({ start: "09:00", end: "12:00" });
    const locked = stateWith([existing], {
      session: {
        ...base.session,
        status: "work",
        lockLevel: "strict",
        phaseEndsAt: NOW + 60 * 60_000,
      },
    });
    const result = planScheduleSave({
      state: locked,
      draft: { ...draftFromSchedule(existing), end: "17:00" },
      editingId: "s1",
      now: NOW,
      newId,
    });
    expect(result.ok).toBe(true);
  });
});

describe("templates", () => {
  it("offers the three starting points", () => {
    expect(SCHEDULE_TEMPLATES.map((template) => template.name)).toEqual([
      "Work hours",
      "Study",
      "Sleep",
    ]);
    const sleep = SCHEDULE_TEMPLATES[2]!;
    expect(sleep).toMatchObject({ days: [0, 1, 2, 3, 4, 5, 6], start: "22:00", end: "07:00" });
  });
});
