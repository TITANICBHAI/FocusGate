import { describe, expect, it, vi } from "vitest";
import { createGuardedStateWriteService } from "../../src/background/guardedStateWrites.ts";
import { createDefaultState } from "../../src/shared/defaults.ts";
import type { AppState, Schedule } from "../../src/shared/types.ts";

/**
 * "Does the password stop me deleting my Always sites, keywords, schedules or
 * limits?" Yes, and this is the proof, through the same service the UI writes
 * through: removing each of them needs the password, and during a Strict or Commit
 * session or a Block now window it is refused whatever password is given.
 */
const NOW = 1_000;
const password = "blue-river-42";

const schedule: Schedule = {
  id: "work",
  name: "Work hours",
  enabled: true,
  days: [1, 2, 3, 4, 5],
  start: "09:00",
  end: "17:00",
  sites: ["reddit.com"],
  keywords: [],
  useGlobalLists: false,
};

interface Rule {
  label: string;
  key: "alwaysBlockedSites" | "keywords" | "schedules" | "allowances";
  withRule(state: AppState): void;
  removed: unknown;
  after(state: AppState): unknown;
}

const RULES: Rule[] = [
  {
    label: "an Always site",
    key: "alwaysBlockedSites",
    withRule: (state) => {
      state.alwaysBlockedSites = ["youtube.com"];
    },
    removed: [],
    after: (state) => state.alwaysBlockedSites,
  },
  {
    label: "a keyword",
    key: "keywords",
    withRule: (state) => {
      state.keywords = [{ text: "news", mode: "block", when: "always" }];
    },
    removed: [],
    after: (state) => state.keywords,
  },
  {
    label: "a schedule",
    key: "schedules",
    withRule: (state) => {
      state.schedules = [structuredClone(schedule)];
    },
    removed: [],
    after: (state) => state.schedules,
  },
  {
    label: "a limit",
    key: "allowances",
    withRule: (state) => {
      state.allowances = {
        "reddit.com": { mode: "time_budget", limitMin: 30, duringBlocks: false },
      };
    },
    removed: {},
    after: (state) => state.allowances,
  },
];

function setup(rule: Rule, configure: (state: AppState) => void = () => undefined) {
  const initial = createDefaultState();
  rule.withRule(initial);
  configure(initial);
  let state = structuredClone(initial);
  const store = {
    readState: vi.fn(async () => structuredClone(state)),
    writeState: vi.fn(async (patch: Partial<AppState>) => {
      state = { ...state, ...patch };
    }),
  };
  const service = createGuardedStateWriteService({
    store,
    now: () => NOW,
    verifyPassword: async (input: string) => ({ valid: input === password }),
  });
  return { service, store, getState: () => state, before: structuredClone(initial) };
}

const withPassword = (state: AppState) => {
  state.password = { algo: "pbkdf2-sha256", iter: 1_000, salt: "salt", hash: "hash" };
};

for (const rule of RULES) describe(`removing ${rule.label}`, () => {
  it("is allowed when no password is set", async () => {
    const context = setup(rule);
    await expect(
      context.service.write({ key: rule.key, value: rule.removed as never }),
    ).resolves.toEqual({ ok: true });
    expect(rule.after(context.getState())).toEqual(rule.removed);
  });

  it("needs the password once one is set, and changes nothing without it", async () => {
    const context = setup(rule, withPassword);
    await expect(
      context.service.write({ key: rule.key, value: rule.removed as never }),
    ).resolves.toMatchObject({
      ok: false,
      code: "PASSWORD_REQUIRED",
      message: "Enter your current password to continue.",
    });
    expect(context.store.writeState).not.toHaveBeenCalled();
    expect(rule.after(context.getState())).toEqual(rule.after(context.before));
  });

  it("refuses a wrong password", async () => {
    const context = setup(rule, withPassword);
    await expect(
      context.service.write({
        key: rule.key,
        value: rule.removed as never,
        currentPassword: "wrong-secret",
      }),
    ).resolves.toMatchObject({
      ok: false,
      code: "BAD_PASSWORD",
      message: "That password is not correct.",
    });
    expect(context.store.writeState).not.toHaveBeenCalled();
  });

  it("goes through with the right password", async () => {
    const context = setup(rule, withPassword);
    await expect(
      context.service.write({
        key: rule.key,
        value: rule.removed as never,
        currentPassword: password,
      }),
    ).resolves.toEqual({ ok: true });
    expect(rule.after(context.getState())).toEqual(rule.removed);
  });

  const LOCKS: Array<[string, (state: AppState) => void]> = [
    [
      "a Strict session",
      (state) => {
        state.session = { ...state.session, status: "work", lockLevel: "strict", phaseEndsAt: 9_000 };
      },
    ],
    [
      "a Commit session",
      (state) => {
        state.session = {
          ...state.session,
          status: "work",
          lockLevel: "commitment",
          phaseEndsAt: 9_000,
        };
      },
    ],
    [
      "a Block now window",
      (state) => {
        state.standalone = { ...state.standalone, active: true, startsAt: 0, until: 9_000 };
      },
    ],
  ];

  for (const [name, lock] of LOCKS) it(`is refused during ${name}, even with the right password and with no password set`, async () => {
    for (const pinned of [true, false]) {
      const context = setup(rule, (state) => {
        lock(state);
        if (pinned) withPassword(state);
      });
      await expect(
        context.service.write({
          key: rule.key,
          value: rule.removed as never,
          ...(pinned ? { currentPassword: password } : {}),
        }),
      ).resolves.toMatchObject({ ok: false, code: "LOCKED" });
      expect(context.store.writeState).not.toHaveBeenCalled();
    }
  });

  it("is allowed again once the lock has ended", async () => {
    const context = setup(rule, (state) => {
      withPassword(state);
      state.session = { ...state.session, status: "work", lockLevel: "strict", phaseEndsAt: NOW - 1 };
    });
    await expect(
      context.service.write({
        key: rule.key,
        value: rule.removed as never,
        currentPassword: password,
      }),
    ).resolves.toEqual({ ok: true });
  });
});
