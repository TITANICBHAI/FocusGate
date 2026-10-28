import { describe, expect, it } from "vitest";
import {
  applyBackup,
  createBackup,
  createBackupJson,
  parseBackupJson,
} from "../../src/shared/backup.ts";
import { createDefaultState } from "../../src/shared/defaults.ts";

describe("backup format and merge policy", () => {
  it("exports user data without password or runtime state", () => {
    const state = createDefaultState();
    state.blockedSites = ["example.com"];
    state.password = {
      algo: "pbkdf2-sha256",
      iter: 600_000,
      salt: "not-exported",
      hash: "not-exported",
    };
    state.standalone.active = true;
    state.usage.example = {
      dateKey: "2026-10-28",
      usedMs: 100,
      opens: 1,
      windowStartMs: 0,
      lastActiveAt: 100,
    };

    const parsed = parseBackupJson(createBackupJson(state, 123));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.backup).toMatchObject({
      app: "focusgate",
      schemaVersion: 2,
      exportedAt: 123,
      data: { sites: ["example.com"] },
    });
    expect(JSON.stringify(parsed.backup)).not.toContain("not-exported");
    expect(Object.keys(parsed.backup.data)).not.toContain("password");
    expect(Object.keys(parsed.backup.data)).not.toContain("standalone");
    expect(Object.keys(parsed.backup.data)).not.toContain("usage");
  });

  it("rejects malformed, unknown-key, and unsupported-version backups", () => {
    const backup = createBackup(createDefaultState(), 100);
    expect(parseBackupJson("{")).toMatchObject({ ok: false });
    expect(
      parseBackupJson(JSON.stringify({ ...backup, futureKey: true })),
    ).toMatchObject({ ok: false, error: "This is not a valid FocusGate backup." });
    expect(
      parseBackupJson(JSON.stringify({ ...backup, schemaVersion: 99 })),
    ).toMatchObject({ ok: false, error: "This backup version is not supported." });

    const withSecret = JSON.parse(JSON.stringify(backup)) as Record<string, unknown>;
    (withSecret.data as Record<string, unknown>).password = null;
    expect(parseBackupJson(JSON.stringify(withSecret))).toMatchObject({
      ok: false,
      error: "The backup contains invalid or unsupported data.",
    });
  });

  it("rejects files above the 2 MB limit before parsing", () => {
    expect(parseBackupJson(" ".repeat(2 * 1024 * 1024 + 1))).toMatchObject({
      ok: false,
      error: "Backup files must be 2 MB or smaller.",
    });
  });

  it("restores full exported data into an empty state but keeps the local password", () => {
    const source = createDefaultState();
    source.blockedSites = ["example.com"];
    source.exceptions = ["https://example.com/allowed"];
    source.tasks = [
      {
        id: "task-1",
        title: "Read",
        durationMin: 25,
        priority: "medium",
        tags: [],
        recurring: "none",
        lockLevel: "none",
        completed: false,
        createdAt: 1,
      },
    ];
    source.sessionHistory = [
      {
        id: "session-1",
        startedAt: 1,
        endedAt: 2,
        plannedMs: 60_000,
        elapsedMs: 60_000,
        status: "completed",
        lockLevel: "none",
        blockedAttempts: 0,
        gaps: [],
      },
    ];
    const local = createDefaultState();
    local.health.lastHeartbeatAt = 5;
    const parsed = parseBackupJson(createBackupJson(source));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const result = applyBackup(local, parsed.backup);
    expect(result.report.mode).toBe("restore");
    expect(result.state).toMatchObject({
      blockedSites: ["example.com"],
      exceptions: ["https://example.com/allowed"],
      tasks: [{ id: "task-1" }],
      sessionHistory: [{ id: "session-1" }],
      password: null,
      health: { lastHeartbeatAt: 5 },
    });
  });

  it("merges only strengthening data into a working state", () => {
    const current = createDefaultState();
    current.blockedSites = ["example.com"];
    current.keywords = [{ text: "games", mode: "block", when: "blocks" }];
    current.allowances = {
      "metered.example": {
        mode: "time_budget",
        limitMin: 30,
        duringBlocks: true,
      },
    };
    current.settings.contentFilters = { youtube: true };
    current.settings.keywords.scope = {
      searchQuery: false,
      url: true,
      title: false,
    };
    current.settings.allowOnly = { enabled: true, domains: ["work.example"] };

    const source = createDefaultState();
    source.blockedSites = ["example.com", "news.example"];
    source.exceptions = ["https://example.com/allowed"];
    source.keywords = [{ text: "games", mode: "hide", when: "always" }];
    source.allowances = {
      "metered.example": {
        mode: "time_budget",
        limitMin: 90,
        duringBlocks: true,
      },
      "new.example": {
        mode: "count",
        maxOpens: 5,
        duringBlocks: true,
      },
    };
    source.settings.contentFilters = { youtube: false, reddit: true };
    source.settings.keywords.scope = {
      searchQuery: true,
      url: false,
      title: true,
    };
    source.settings.keywords.match = "wholeWord";
    source.settings.allowOnly = { enabled: true, domains: ["personal.example"] };
    source.sessionHistory = [
      {
        id: "history-1",
        startedAt: 1,
        endedAt: 2,
        plannedMs: 60_000,
        elapsedMs: 60_000,
        status: "completed",
        lockLevel: "none",
        blockedAttempts: 0,
        gaps: [],
      },
    ];
    const parsed = parseBackupJson(createBackupJson(source));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const result = applyBackup(current, parsed.backup);
    expect(result.report.mode).toBe("merge");
    expect(result.state).toMatchObject({
      blockedSites: ["example.com", "news.example"],
      keywords: [{ text: "games", mode: "both", when: "always" }],
      allowances: {
        "metered.example": {
          mode: "time_budget",
          limitMin: 30,
          duringBlocks: true,
        },
        "new.example": {
          mode: "count",
          maxOpens: 5,
          duringBlocks: false,
        },
      },
      settings: {
        contentFilters: { youtube: true, reddit: true },
        keywords: {
          scope: { searchQuery: true, url: true, title: true },
          match: "substring",
        },
        allowOnly: { enabled: true, domains: ["work.example"] },
      },
    });
    expect("sessionHistory" in result.state).toBe(false);
    expect(result.report.skipped.join(" ")).toMatch(
      /exceptions|history|exemption|allow-only|scope/,
    );
  });
});
