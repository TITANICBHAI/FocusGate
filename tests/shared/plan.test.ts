import { describe, expect, it } from "vitest";
import { createDefaultState } from "../../src/shared/defaults.ts";
import {
  computeBlockPlan,
  explainBlock,
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
    });
    expect(
      explainBlock("https://www.youtube.com/results?search_query=gaming", state, 1_000),
    ).toMatchObject({ kind: "keyword", keyword: "gaming", where: "query" });
    expect(computeBlockPlan(state, 1_000).hideWords).toEqual(["gaming"]);
    expect(isFilteringActive(state, 1_000)).toBe(true);
    expect(isBlockingActive(state, 1_000)).toBe(true);
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
