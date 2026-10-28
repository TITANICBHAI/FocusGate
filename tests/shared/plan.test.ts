import { describe, expect, it } from "vitest";
import { createDefaultState } from "../../src/shared/defaults.ts";
import {
  computeBlockPlan,
  explainBlock,
  isBlockContextActive,
  isBlockingActive,
  isFilteringActive,
} from "../../src/shared/plan.ts";
import type { AppState } from "../../src/shared/types.ts";

function stateWith(overrides: Partial<AppState> = {}): AppState {
  return { ...createDefaultState(), ...overrides };
}

describe("block planning", () => {
  it("uses always-blocked precedence and keeps exceptions as URL-level overrides", () => {
    const state = stateWith({
      blockedSites: ["example.com"],
      alwaysBlockedSites: ["example.com"],
      exceptions: ["example.com/docs"],
    });
    expect(explainBlock("https://example.com/home", state, 1_000)).toEqual({
      kind: "always",
    });
    expect(explainBlock("https://example.com/docs/page", state, 1_000)).toBeNull();
  });

  it("blocks every member of an alias group from a single site entry", () => {
    const state = stateWith({ alwaysBlockedSites: ["twitter.com"] });

    expect(explainBlock("https://x.com/home", state, 1_000)).toEqual({
      kind: "always",
    });
    expect(explainBlock("https://t.co/short", state, 1_000)).toEqual({
      kind: "always",
    });
  });

  it("turns session blocking off during breaks and activates it during work", () => {
    const base = createDefaultState();
    const state = stateWith({
      blockedSites: ["example.com"],
      session: { ...base.session, status: "shortBreak", phaseEndsAt: 10_000 },
    });
    expect(explainBlock("https://example.com", state, 1_000)).toBeNull();
    state.session = { ...base.session, status: "work", phaseEndsAt: 10_000 };
    expect(explainBlock("https://example.com", state, 1_000)?.kind).toBe("session");
  });

  it("does not activate a future standalone block before its start", () => {
    const startsAt = 10_000;
    const until = 20_000;
    const state = stateWith({
      standalone: {
        ...createDefaultState().standalone,
        active: true,
        startsAt,
        until,
        sites: ["later.example"],
      },
    });

    expect(explainBlock("https://later.example", state, startsAt - 1)).toBeNull();
    expect(computeBlockPlan(state, startsAt - 1).nextBoundaryAt).toBe(startsAt);
    expect(explainBlock("https://later.example", state, startsAt)).toEqual({
      kind: "standalone",
      until,
    });
  });

  it("uses schedule-owned lists and the correct overnight schedule reason", () => {
    const state = stateWith({
      schedules: [
        {
          id: "night",
          name: "Night",
          enabled: true,
          days: [1],
          start: "22:00",
          end: "06:00",
          sites: ["night.example"],
          keywords: [],
          useGlobalLists: false,
        },
      ],
    });
    const tuesdayAtTwo = new Date(2026, 9, 27, 2, 0).getTime();
    expect(explainBlock("https://night.example", state, tuesdayAtTwo)).toMatchObject({
      kind: "schedule",
      name: "Night",
      until: new Date(2026, 9, 27, 6, 0).getTime(),
    });
    expect(explainBlock("https://global.example", state, tuesdayAtTwo)).toBeNull();
  });

  it("uses the current global list only when an active schedule opts in", () => {
    const state = stateWith({
      blockedSites: ["global.example"],
      schedules: [
        {
          id: "work",
          name: "Work",
          enabled: true,
          days: [1],
          start: "09:00",
          end: "17:00",
          sites: ["owned.example"],
          keywords: [],
          useGlobalLists: true,
        },
      ],
    });
    const mondayAtTen = new Date(2026, 9, 26, 10, 0).getTime();

    expect(explainBlock("https://owned.example", state, mondayAtTen)).toMatchObject({
      kind: "schedule",
      name: "Work",
    });
    expect(explainBlock("https://global.example", state, mondayAtTen)).toMatchObject({
      kind: "schedule",
      name: "Work",
    });

    state.blockedSites = ["replacement.example"];
    expect(explainBlock("https://global.example", state, mondayAtTen)).toBeNull();
    expect(explainBlock("https://replacement.example", state, mondayAtTen)).toMatchObject({
      kind: "schedule",
      name: "Work",
    });

    state.schedules[0]!.useGlobalLists = false;
    expect(explainBlock("https://replacement.example", state, mondayAtTen)).toBeNull();
  });

  it("applies allowance caps and during-block exemptions without overriding always blocks", () => {
    const state = stateWith({
      blockedSites: ["example.com"],
      alwaysBlockedSites: ["always.example"],
      session: {
        ...createDefaultState().session,
        status: "work",
        phaseEndsAt: 2_000_000,
      },
      allowances: {
        "example.com": { mode: "time_budget", limitMin: 2, duringBlocks: true },
        "always.example": {
          mode: "time_budget",
          limitMin: 10,
          duringBlocks: true,
        },
      },
      usage: {
        "example.com": {
          dateKey: "1970-01-01",
          usedMs: 0,
          opens: 0,
          windowStartMs: 0,
          lastActiveAt: 0,
        },
      },
    });
    expect(explainBlock("https://example.com", state, 1_000)).toBeNull();
    state.usage["example.com"]!.usedMs = 120_000;
    expect(explainBlock("https://example.com", state, 1_000)?.kind).toBe(
      "allowance",
    );
    expect(explainBlock("https://always.example", state, 1_000)?.kind).toBe(
      "always",
    );
  });

  it("matches keywords in host search parameters and exposes active filters", () => {
    const state = stateWith({
      keywords: [{ text: "gaming", mode: "both", when: "blocks" }],
      session: {
        ...createDefaultState().session,
        status: "work",
        phaseEndsAt: 1_000_000,
      },
      settings: {
        ...createDefaultState().settings,
        keywords: {
          ...createDefaultState().settings.keywords,
          scope: {
            ...createDefaultState().settings.keywords.scope,
            title: true,
          },
        },
      },
    });
    expect(
      explainBlock("https://www.youtube.com/results?search_query=gaming", state, 1_000),
    ).toMatchObject({ kind: "keyword", keyword: "gaming", where: "query" });
    expect(computeBlockPlan(state, 1_000).hideWords).toEqual(["gaming"]);
    expect(isFilteringActive(state, 1_000)).toBe(true);
    expect(isBlockingActive(state, 1_000)).toBe(true);
  });

  it("does not activate title filtering when the title scope is off", () => {
    const state = stateWith({
      keywords: [{ text: "gaming", mode: "hide", when: "always" }],
      settings: {
        ...createDefaultState().settings,
        keywords: {
          scope: { searchQuery: true, url: true, title: false },
          match: "substring",
        },
      },
    });
    expect(computeBlockPlan(state, 1_000).hideWords).toEqual(["gaming"]);
    expect(isFilteringActive(state, 1_000)).toBe(false);
  });

  it("activates content filtering for work, standalone, and active schedule contexts", () => {
    const state = createDefaultState();
    expect(isBlockContextActive(state, 1_000)).toBe(false);
    expect(isFilteringActive(state, 1_000, "www.youtube.com")).toBe(false);

    state.session.status = "work";
    expect(isBlockContextActive(state, 1_000)).toBe(true);
    expect(isFilteringActive(state, 1_000, "www.youtube.com")).toBe(true);

    state.session.status = "shortBreak";
    state.standalone = {
      ...state.standalone,
      active: true,
      startsAt: 0,
      until: 2_000,
    };
    expect(isBlockContextActive(state, 1_000)).toBe(true);

    state.standalone.active = false;
    state.schedules = [
      {
        id: "all-day",
        name: "All day",
        enabled: true,
        days: [0, 1, 2, 3, 4, 5, 6],
        start: "00:00",
        end: "24:00",
        sites: [],
        keywords: [],
        useGlobalLists: false,
      },
    ];
    expect(isBlockContextActive(state, 1_000)).toBe(true);
    expect(isFilteringActive(state, 1_000, "www.youtube.com")).toBe(true);

    state.schedules[0]!.enabled = false;
    expect(isBlockContextActive(state, 1_000)).toBe(false);
  });

  it("keeps an always-hide keyword active without enabling a block context", () => {
    const state = stateWith({
      keywords: [{ text: "gaming", mode: "hide", when: "always" }],
      settings: {
        ...createDefaultState().settings,
        keywords: {
          scope: { searchQuery: true, url: true, title: true },
          match: "substring",
        },
      },
    });

    expect(isBlockContextActive(state, 1_000)).toBe(false);
    expect(isFilteringActive(state, 1_000, "youtube.com")).toBe(true);
    expect(isFilteringActive(state, 1_000, "not a host")).toBe(false);
  });

  it("respects the configured query and URL keyword scopes", () => {
    const state = stateWith({
      keywords: [{ text: "gaming", mode: "block", when: "always" }],
      settings: {
        ...createDefaultState().settings,
        keywords: {
          scope: { searchQuery: false, url: false, title: false },
          match: "substring",
        },
      },
    });

    expect(
      explainBlock("https://google.com/search?q=gaming", state, 1_000),
    ).toBeNull();
    expect(explainBlock("https://example.com/gaming", state, 1_000)).toBeNull();

    state.settings.keywords.scope.searchQuery = true;
    expect(
      explainBlock("https://google.com/search?q=gaming", state, 1_000),
    ).toMatchObject({ kind: "keyword", where: "query" });
    expect(explainBlock("https://example.com/gaming", state, 1_000)).toBeNull();

    state.settings.keywords.scope.url = true;
    expect(explainBlock("https://example.com/gaming", state, 1_000)).toMatchObject({
      kind: "keyword",
      where: "url",
    });
  });

  it("ignores malformed stored schedules without losing valid planning", () => {
    const state = stateWith({
      blockedSites: ["global.example"],
      schedules: [
        {
          id: "broken",
          name: "Broken",
          enabled: true,
          days: [1],
          start: "25:99",
          end: "26:00",
          sites: ["broken.example"],
          keywords: [],
          useGlobalLists: false,
        },
        {
          id: "valid",
          name: "Valid",
          enabled: true,
          days: [1],
          start: "09:00",
          end: "17:00",
          sites: ["valid.example"],
          keywords: [],
          useGlobalLists: false,
        },
      ] as AppState["schedules"],
    });
    const mondayAtTen = new Date(2026, 9, 26, 10, 0).getTime();

    expect(() =>
      computeBlockPlan(state, mondayAtTen),
    ).not.toThrow();
    expect(explainBlock("https://broken.example", state, mondayAtTen)).toBeNull();
    expect(explainBlock("https://valid.example", state, mondayAtTen)).toMatchObject({
      kind: "schedule",
      name: "Valid",
    });
  });

  it("does not schedule an interval reset before its first attention window", () => {
    const now = new Date(2026, 9, 28, 12, 0).getTime();
    const state = stateWith({
      allowances: {
        "example.com": {
          mode: "interval",
          allowMin: 1,
          everyMin: 5,
          duringBlocks: true,
        },
      },
    });

    expect(computeBlockPlan(state, now).nextBoundaryAt).toBe(
      new Date(2026, 9, 29, 0, 0).getTime(),
    );
  });

  it("does not use generic p, and honors the active global allow-only list", () => {
    const state = stateWith({
      settings: {
        ...createDefaultState().settings,
        allowOnly: { enabled: true, domains: ["allowed.example"] },
      },
      session: {
        ...createDefaultState().session,
        status: "work",
        phaseEndsAt: 1_000_000,
      },
    });
    expect(explainBlock("https://other.example/path?p=gaming", state, 1_000)).toEqual({
      kind: "allowOnly",
    });
    expect(explainBlock("https://allowed.example", state, 1_000)).toBeNull();
    expect(computeBlockPlan(state, 1_000).allowOnly).toEqual(["allowed.example"]);

    state.settings.allowOnly = { enabled: false, domains: ["allowed.example"] };
    expect(computeBlockPlan(state, 1_000).allowOnly).toBeNull();

    state.settings.allowOnly = { enabled: true, domains: [] };
    expect(computeBlockPlan(state, 1_000).allowOnly).toBeNull();
  });
});
