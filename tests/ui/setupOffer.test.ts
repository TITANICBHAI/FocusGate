import { describe, expect, it, vi } from "vitest";
import { createDefaultState } from "../../src/shared/defaults.ts";
import type { AppState, Schedule } from "../../src/shared/types.ts";
import { readHiddenHints } from "../../src/ui/lib/hiddenHints.ts";
import type { HintStore } from "../../src/ui/lib/hiddenHints.ts";
import { openExtensionPage } from "../../src/ui/lib/extensionPages.ts";
import {
  SETUP_OFFER_HINT_ID,
  SETUP_PAGE,
  isFirstRun,
  markSetupHandled,
  wantsSetupOffer,
} from "../../src/ui/lib/setupOffer.ts";

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

/** Each of these is a sign that someone has already set FocusGate up. */
const SIGNS: Array<[string, (state: AppState) => void]> = [
  ["a Focus site", (state) => { state.blockedSites = ["reddit.com"]; }],
  ["an Always site", (state) => { state.alwaysBlockedSites = ["youtube.com"]; }],
  ["a keyword", (state) => { state.keywords = [{ text: "news", mode: "block", when: "always" }]; }],
  ["a schedule", (state) => { state.schedules = [structuredClone(schedule)]; }],
  [
    "a limit",
    (state) => {
      state.allowances = { "reddit.com": { mode: "count", maxOpens: 3, duringBlocks: false } };
    },
  ],
  [
    "a password",
    (state) => {
      state.password = { algo: "pbkdf2-sha256", iter: 1_000, salt: "00", hash: "11" };
    },
  ],
  [
    "a session already run",
    (state) => {
      state.sessionHistory = [
        {
          id: "s1",
          startedAt: 1,
          endedAt: 2,
          plannedMs: 1,
          elapsedMs: 1,
          status: "completed",
          lockLevel: "none",
          blockedAttempts: 0,
          gaps: [],
        },
      ];
    },
  ],
];

describe("who is a first-time user", () => {
  it("is someone with nothing set up", () => {
    expect(isFirstRun(createDefaultState())).toBe(true);
  });

  for (const [label, configure] of SIGNS) {
    it(`is not someone with ${label}`, () => {
      const state = createDefaultState();
      configure(state);
      expect(isFirstRun(state)).toBe(false);
    });
  }
});

describe("when to offer setup", () => {
  it("offers it to a first-time user who has not dealt with it", () => {
    expect(wantsSetupOffer(createDefaultState(), false)).toBe(true);
  });

  it("stops once it was dealt with", () => {
    expect(wantsSetupOffer(createDefaultState(), true)).toBe(false);
  });

  it("is never offered to someone who has set things up", () => {
    for (const [, configure] of SIGNS) {
      const state = createDefaultState();
      configure(state);
      expect(wantsSetupOffer(state, false)).toBe(false);
    }
  });
});

describe("dealing with the offer", () => {
  function fakeStore(): HintStore {
    const data = new Map<string, string>();
    return {
      getItem: (key) => data.get(key) ?? null,
      setItem: (key, value) => void data.set(key, value),
    };
  }

  it("is remembered in this browser, with the other hidden hints", () => {
    const store = fakeStore();
    markSetupHandled(store);
    expect(readHiddenHints(store).has(SETUP_OFFER_HINT_ID)).toBe(true);
  });

  it("does not throw when the browser will not store it", () => {
    const blocked: HintStore = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    expect(() => markSetupHandled(blocked)).not.toThrow();
  });

  it("opens the setup page, which is the full-screen one", () => {
    expect(SETUP_PAGE).toBe("onboarding.html");
  });
});

describe("opening a page of the extension in a tab", () => {
  type ChromeStub = {
    runtime: { getURL(path: string): string };
    tabs: { create(options: { url: string }): Promise<unknown> };
  };
  const globals = globalThis as unknown as { chrome?: ChromeStub };

  async function withChrome(stub: ChromeStub | undefined, run: () => Promise<void>) {
    const before = globals.chrome;
    globals.chrome = stub;
    try {
      await run();
    } finally {
      globals.chrome = before;
    }
  }

  it("opens it and says so", async () => {
    const create = vi.fn(async () => ({}));
    await withChrome(
      { runtime: { getURL: (path) => `chrome-extension://t/${path}` }, tabs: { create } },
      async () => {
        expect(await openExtensionPage("onboarding.html")).toBe(true);
      },
    );
    expect(create).toHaveBeenCalledWith({ url: "chrome-extension://t/onboarding.html" });
  });

  it("says it did not when the browser refuses", async () => {
    await withChrome(
      {
        runtime: { getURL: (path) => `chrome-extension://t/${path}` },
        tabs: {
          create: async () => {
            throw new Error("no window");
          },
        },
      },
      async () => {
        expect(await openExtensionPage("onboarding.html")).toBe(false);
      },
    );
  });

  it("says it did not when there is no browser API at all", async () => {
    await withChrome(undefined, async () => {
      expect(await openExtensionPage("onboarding.html")).toBe(false);
    });
  });
});
