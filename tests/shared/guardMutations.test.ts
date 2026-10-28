import { describe, expect, it } from "vitest";
import { classifyStateMutation } from "../../src/shared/guardMutations.ts";
import { createDefaultState } from "../../src/shared/defaults.ts";

const now = 1_000;

describe("user-state mutation guard classification", () => {
  it("classifies site and exception additions/removals by their effect", () => {
    const previous = createDefaultState();
    expect(
      classifyStateMutation(previous, {
        ...previous,
        blockedSites: ["example.com"],
      }, now),
    ).toEqual(["add_site"]);
    expect(
      classifyStateMutation(
        { ...previous, blockedSites: ["example.com"] },
        previous,
        now,
      ),
    ).toEqual(["remove_site"]);
    expect(
      classifyStateMutation(previous, {
        ...previous,
        exceptions: ["https://example.com/page"],
      }, now),
    ).toEqual(["add_exception"]);
    expect(
      classifyStateMutation(
        { ...previous, exceptions: ["https://example.com/page"] },
        previous,
        now,
      ),
    ).toEqual(["remove_exception"]);
  });

  it("distinguishes keyword additions, removals, and weakening edits", () => {
    const previous = createDefaultState();
    const blockedRule = { text: "shorts", mode: "block" as const, when: "always" as const };
    expect(
      classifyStateMutation(previous, {
        ...previous,
        keywords: [blockedRule],
      }, now),
    ).toEqual(["add_keyword"]);
    expect(
      classifyStateMutation(
        { ...previous, keywords: [blockedRule] },
        previous,
        now,
      ),
    ).toEqual(["clear_keywords"]);
    expect(
      classifyStateMutation(
        { ...previous, keywords: [blockedRule] },
        {
          ...previous,
          keywords: [{ ...blockedRule, mode: "hide", when: "blocks" }],
        },
        now,
      ),
    ).toEqual(["weaken_keyword"]);
  });

  it("classifies schedule removal, disablement, shortening, and strengthening", () => {
    const previous = createDefaultState();
    const schedule = {
      id: "work",
      name: "Work",
      enabled: true,
      days: [1, 2, 3],
      start: "09:00",
      end: "17:00",
      sites: ["example.com"],
      keywords: [],
      useGlobalLists: true,
    };
    expect(
      classifyStateMutation(previous, {
        ...previous,
        schedules: [schedule],
      }, now),
    ).toEqual(["add_schedule"]);
    expect(
      classifyStateMutation(
        { ...previous, schedules: [schedule] },
        previous,
        now,
      ),
    ).toEqual(["delete_schedule"]);
    expect(
      classifyStateMutation(
        { ...previous, schedules: [schedule] },
        {
          ...previous,
          schedules: [{ ...schedule, enabled: false }],
        },
        now,
      ),
    ).toEqual(["disable_schedule"]);
    expect(
      classifyStateMutation(
        { ...previous, schedules: [schedule] },
        {
          ...previous,
          schedules: [{ ...schedule, sites: [] }],
        },
        now,
      ),
    ).toEqual(["remove_schedule_site"]);
    expect(
      classifyStateMutation(
        { ...previous, schedules: [schedule] },
        {
          ...previous,
          schedules: [{ ...schedule, start: "10:00" }],
        },
        now,
      ),
    ).toEqual(["shorten_schedule"]);
    expect(
      classifyStateMutation(
        { ...previous, schedules: [schedule] },
        {
          ...previous,
          schedules: [{ ...schedule, start: "08:00", end: "18:00" }],
        },
        now,
      ),
    ).toEqual([]);
  });

  it("distinguishes cap limits from exemptions and allowance weakening", () => {
    const previous = createDefaultState();
    const cap = {
      mode: "time_budget" as const,
      limitMin: 30,
      duringBlocks: false,
    };
    expect(
      classifyStateMutation(previous, {
        ...previous,
        allowances: { "example.com": cap },
      }, now),
    ).toEqual(["add_cap_limit"]);

    const blockedState = {
      ...previous,
      session: {
        ...previous.session,
        status: "work" as const,
        phaseEndsAt: 5_000,
      },
      blockedSites: ["example.com"],
    };
    expect(
      classifyStateMutation(blockedState, {
        ...blockedState,
        allowances: {
          "example.com": { ...cap, duringBlocks: true },
        },
      }, now),
    ).toEqual(["add_exempt_allowance"]);
    expect(
      classifyStateMutation(
        { ...previous, allowances: { "example.com": cap } },
        previous,
        now,
      ),
    ).toEqual(["remove_allowance"]);
    expect(
      classifyStateMutation(
        { ...previous, allowances: { "example.com": cap } },
        {
          ...previous,
          allowances: {
            "example.com": { ...cap, limitMin: 45 },
          },
        },
        now,
      ),
    ).toEqual(["raise_limit"]);
    expect(
      classifyStateMutation(
        { ...previous, allowances: { "example.com": cap } },
        {
          ...previous,
          allowances: {
            "example.com": { ...cap, duringBlocks: true },
          },
        },
        now,
      ),
    ).toEqual(["turn_during_blocks_on"]);
  });

  it("locks deletion of a task linked to the running session", () => {
    const task = {
      id: "task-1",
      title: "Focus",
      durationMin: 25,
      priority: "medium" as const,
      tags: [],
      recurring: "none" as const,
      lockLevel: "strict" as const,
      completed: false,
      createdAt: 0,
    };
    const previous = {
      ...createDefaultState(),
      tasks: [task],
      session: {
        ...createDefaultState().session,
        status: "work" as const,
        lockLevel: "strict" as const,
        taskId: task.id,
      },
    };
    expect(
      classifyStateMutation(previous, { ...previous, tasks: [] }, now),
    ).toEqual(["delete_linked_task"]);
    expect(
      classifyStateMutation(
        { ...previous, session: { ...previous.session, taskId: null } },
        { ...previous, session: { ...previous.session, taskId: null }, tasks: [] },
        now,
      ),
    ).toEqual(["edit_unlinked_task"]);
  });

  it("classifies turning off a content filter as weakening", () => {
    const previous = createDefaultState();
    previous.settings.contentFilters = { social: true };
    expect(
      classifyStateMutation(previous, {
        ...previous,
        settings: {
          ...previous.settings,
          contentFilters: { social: false },
        },
      }, now),
    ).toEqual(["turn_filter_off"]);
  });
});
