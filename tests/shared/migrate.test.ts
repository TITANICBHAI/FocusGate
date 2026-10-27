import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isBackupExpired, migrateV1 } from "../../src/shared/migrate.ts";

const NOW = Date.UTC(2026, 9, 19, 12);
const v1Fixture = JSON.parse(
  readFileSync(new URL("../fixtures/v1-storage.json", import.meta.url), "utf8"),
) as Record<string, unknown>;
const expected = JSON.parse(
  readFileSync(new URL("../fixtures/v2-storage.expected.json", import.meta.url), "utf8"),
);

describe("v1 storage migration", () => {
  it("converts the fixture to the expected v2 snapshot and retains a rollback copy", () => {
    const result = migrateV1(v1Fixture, NOW);
    expect({ ...result.set, backup_v1: null }).toEqual(expected);
    expect(result.set.backup_v1).toEqual({
      createdAt: NOW,
      values: v1Fixture,
    });
    expect(result.remove).toContain("timer_timeLeft");
    expect(result.remove).toContain("app_password_hash");
  });

  it("converts an unlimited legacy standalone block into always-blocked sites", () => {
    const result = migrateV1(
      {
        blockedSites: ["www.example.com"],
        standaloneMode: true,
        standaloneUntil: 0,
      },
      NOW,
    );
    expect(result.set.standalone.active).toBe(false);
    expect(result.set.alwaysBlockedSites).toEqual(["example.com"]);
  });

  it("keeps localhost and IP literals as exact migrated hosts", () => {
    const result = migrateV1(
      { blockedSites: ["localhost", "127.0.0.1", "[2001:db8::1]"] },
      NOW,
    );
    expect(result.set.blockedSites).toEqual([
      "localhost",
      "127.0.0.1",
      "[2001:db8::1]",
    ]);
  });

  it("preserves v2 keyword modes while defaulting legacy strings to both/during-blocks", () => {
    const result = migrateV1(
      {
        blockedKeywords: ["legacy"],
        keywords: [
          { text: "hidden", mode: "hide", when: "always" },
          { text: "blocked", mode: "block", when: "blocks" },
        ],
      },
      NOW,
    );
    expect(result.set.keywords).toEqual([
      { text: "hidden", mode: "hide", when: "always" },
      { text: "blocked", mode: "block", when: "blocks" },
    ]);
  });

  it("expires rollback backups at 30 days", () => {
    expect(isBackupExpired({ createdAt: NOW - 30 * 24 * 60 * 60 * 1000 }, NOW)).toBe(true);
    expect(isBackupExpired({ createdAt: NOW - 29 * 24 * 60 * 60 * 1000 }, NOW)).toBe(false);
  });
});
