import { describe, expect, it } from "vitest";
import { addRecordToDayStats } from "../src/shared/session.ts";
import { normalizeException } from "../src/shared/domains.ts";
import { resetUsageOnModeChange } from "../src/shared/allowance.ts";
import { extractSearchText, matchKeyword } from "../src/shared/keywords.ts";
import { createBlockRecorder } from "../src/background/recordBlock.ts";
import { createAttentionTracker } from "../src/background/attention.ts";
import type { AppState, SessionRecord, UsageRecord } from "../src/shared/types.ts";
import { createDefaultState } from "../src/shared/defaults.ts";

const NOW = Date.UTC(2026, 9, 31, 12);

/**
 * WP9.4 traceability suite for plan §8.5 (edge cases EC01–EC54). Rows whose
 * behaviour lives in the browser (dialogs, page swaps, permission prompts)
 * are verified by the manual matrix in plan §8.2 and are listed in the WP9
 * tracker notes; everything with a deterministic code path is tested here or
 * in the module suites referenced in the comments.
 */

describe("EC01 — a work phase crossing local midnight", () => {
  it("attributes the whole record to the local date of phaseStartedAt", () => {
    // 2026-10-31 23:50 local, ending 00:10 on 2026-11-01.
    const startedAt = new Date(2026, 9, 31, 23, 50).getTime();
    const record = {
      id: "midnight",
      startedAt,
      endedAt: startedAt + 20 * 60_000,
      plannedMs: 30 * 60_000,
      elapsedMs: 20 * 60_000,
      status: "completed",
      lockLevel: "none",
      blockedAttempts: 0,
      gaps: [],
    } as SessionRecord;

    const dayStats = addRecordToDayStats({}, record);
    expect(Object.keys(dayStats)).toEqual(["2026-10-31"]);
    expect(dayStats["2026-10-31"]?.focusMs).toBe(20 * 60_000);
    expect(dayStats["2026-10-31"]?.sessionsCompleted).toBe(1);
    expect(dayStats["2026-11-01"]).toBeUndefined();
  });
});

describe("EC24 — exceptions longer than 200 characters", () => {
  it("rejects a 201-character input and accepts one of exactly 200", () => {
    const path = `/${"a".repeat(188)}`; // 11-char host + 189-char path = 200
    expect(normalizeException(`example.com${path}`)).toBe(
      `example.com${path}`,
    );
    expect(normalizeException(`example.com${path}x`)).toBeNull();
  });
});

describe("EC36 — x.com and twitter.com share one alias-group budget", () => {
  it("credits usage into the single configured allowance key for both hosts", async () => {
    const state = createDefaultState();
    state.allowances["twitter.com"] = {
      mode: "time_budget",
      limitMin: 5,
      duringBlocks: false,
    };
    let usage: Record<string, UsageRecord> = {};
    let now = 10_000;
    let checkpoint: { lastTickAt: number; lastDomain: string | null; lastAttentive: boolean } | null = null;
    const tracker = createAttentionTracker({
      getState: async () => ({ ...structuredClone(state), usage }),
      getCheckpoint: async () => (checkpoint ? { ...checkpoint } : null),
      setCheckpoint: async (value) => {
        checkpoint = { ...value };
      },
      getLastFocusedWindow: async () => ({
        focused: true,
        tabs: [{ active: true, url: "https://x.com/home" }],
      }),
      getIdleState: async () => "active",
      writeUsage: async (next) => {
        usage = next;
      },
      now: () => now,
      reconcile: async () => undefined,
    });

    const first = await tracker.sample();
    expect(first.domain).toBe("twitter.com");

    now = 70_000;
    const second = await tracker.sample();
    expect(second.creditedMs).toBe(60_000);
    // One shared budget: x.com time accrued under the twitter.com key only.
    expect(Object.keys(usage)).toEqual(["twitter.com"]);
    expect(usage["twitter.com"]?.usedMs).toBe(60_000);
    expect(usage["x.com"]).toBeUndefined();
  });
});

describe("EC37 — editing an allowance", () => {
  it("keeps usage when the mode is unchanged", () => {
    const usage: Record<string, UsageRecord> = {
      "example.com": {
        dateKey: "2026-10-31",
        usedMs: 5 * 60_000,
        opens: 1,
        windowStartMs: 0,
        lastActiveAt: 0,
      },
    };
    const previous = {
      mode: "time_budget",
      limitMin: 60,
      duringBlocks: true,
    } as const;
    const next = {
      mode: "time_budget",
      limitMin: 30,
      duringBlocks: true,
    } as const;
    const outcome = resetUsageOnModeChange(
      usage,
      "example.com",
      previous,
      next,
      0,
    );
    expect(outcome.changed).toBe(false);
    expect(outcome.usage["example.com"]?.usedMs).toBe(5 * 60_000);
  });

  it("resets usage when the mode changes, exhausting a lowered budget at once", () => {
    const usage: Record<string, UsageRecord> = {
      "example.com": {
        dateKey: "2026-10-31",
        usedMs: 5 * 60_000,
        opens: 1,
        windowStartMs: 0,
        lastActiveAt: 0,
      },
    };
    const previous = {
      mode: "time_budget",
      limitMin: 60,
      duringBlocks: true,
    } as const;
    const next = { mode: "count", maxOpens: 2, duringBlocks: true } as const;
    const outcome = resetUsageOnModeChange(
      usage,
      "example.com",
      previous,
      next,
      0,
    );
    expect(outcome.changed).toBe(true);
    expect(outcome.usage["example.com"]?.usedMs).toBe(0);
    expect(outcome.usage["example.com"]?.opens).toBe(0);
  });
});

describe("EC51/EC52/EC53 — keyword URL handling", () => {
  it("ignores keywords that appear only in the URL fragment", () => {
    const url = new URL("https://www.google.com/search?q=weather#gambling");
    expect(extractSearchText(url)).toEqual(["weather"]);
  });

  it("decodes percent-encoded characters and + as spaces before matching", () => {
    const encoded = new URL("https://www.google.com/search?q=funny%20cats");
    expect(extractSearchText(encoded)).toEqual(["funny cats"]);
    expect(matchKeyword("funny cats", ["funny cats"])).toBe("funny cats");

    const plus = new URL("https://www.google.com/search?q=funny+cats");
    expect(extractSearchText(plus)).toEqual(["funny cats"]);
  });

  it("applies Unicode-aware whole-word boundaries (EC53)", () => {
    expect(matchKeyword("кафе открыто", ["кафе"], "wholeWord")).toBe("кафе");
    expect(matchKeyword("кафетерий", ["кафе"], "wholeWord")).toBeNull();
  });
});

describe("WP9.2 — 10,000-event burst", () => {
  it(
    "records the burst without duplicate stamps and caps recentBlocks at 200",
    async () => {
      let state: AppState = createDefaultState();
      state.session.status = "work";
      const writes: Array<
        Partial<Pick<AppState, "recentBlocks" | "dayStats" | "session">>
      > = [];
      const dedupe: Record<string, number> = {};
      let now = 1_000_000;
      const recorder = createBlockRecorder({
        getState: async () => ({
          ...structuredClone(state),
          ...writes[writes.length - 1],
        }),
        write: async (partial) => {
          writes.push(structuredClone(partial));
          state = { ...state, ...partial };
        },
        dedupe: {
          getAll: async () => dedupe,
          setAll: async (value) => {
            for (const [key, at] of Object.entries(value)) dedupe[key] = at;
          },
        },
        now: () => now,
      });

      // 10,000 events just past the dedupe window each time, alternating
      // domains: every event records, and the caps must hold under the burst.
      const total = 10_000;
      for (let index = 0; index < total; index += 1) {
        now += 3_100;
        const domain = index % 2 === 0 ? "example.com" : "news.example";
        await recorder({ tabId: 1, domain, reason: { kind: "session" } });
      }

      const finalWrite = writes[writes.length - 1];
      expect(finalWrite.recentBlocks.length).toBeLessThanOrEqual(200);
      const stamps = new Set(finalWrite.recentBlocks.map((record) => record.at));
      expect(stamps.size).toBe(finalWrite.recentBlocks.length);
      expect(finalWrite.session.blockedAttempts).toBeGreaterThan(0);
      const totalBlocks = Object.values(finalWrite.dayStats).reduce(
        (sum, day) => sum + day.blocks,
        0,
      );
      expect(totalBlocks).toBeGreaterThan(0);
    },
    30_000,
  );
});

describe("WP9.3 — 90 days of seeded data stays under the 1 MB storage budget", () => {
  it("serializes 90 days of realistic data below 1 MB", () => {
    const state = createDefaultState();
    const days: Record<string, DayStats> = {};
    const history = [];
    for (let index = 89; index >= 0; index -= 1) {
      const date = new Date(NOW - index * 86_400_000);
      const dateKey = date.toISOString().slice(0, 10);
      days[dateKey] = {
        dateKey,
        focusMs: (2 + (index % 5)) * 60_000 * 30,
        sessionsCompleted: 3,
        sessionsAbandoned: 1,
        blocks: 12,
        blocksByDomain: {
          "example.com": 5,
          "news.example": 4,
          "video.example": 3,
        },
        tasksCompleted: 2,
      };
      for (let session = 0; session < 2; session += 1) {
        history.push({
          id: `${dateKey}-${session}`,
          startedAt: date.getTime() + session * 3_600_000,
          endedAt: date.getTime() + session * 3_600_000 + 30 * 60_000,
          plannedMs: 30 * 60_000,
          elapsedMs: 30 * 60_000,
          status: "completed",
          lockLevel: "none",
          blockedAttempts: index % 3,
          gaps: [{ from: date.getTime(), to: date.getTime() + 60_000 }],
        });
      }
    }
    state.dayStats = days;
    state.sessionHistory = history;
    state.recentBlocks = Array.from({ length: 200 }, (_, index) => ({
      domain: `domain-${index % 20}.example`,
      reason: "session",
      at: NOW + index * 60_000,
    }));

    const serialized = JSON.stringify(state);
    expect(new TextEncoder().encode(serialized).byteLength).toBeLessThan(
      1_000_000,
    );
  });
});
