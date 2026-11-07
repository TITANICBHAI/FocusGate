import { describe, expect, it } from "vitest";
import {
  DISPLAY_NAME_MAX,
  WHY_MAX,
  cleanDisplayName,
  cleanWhy,
  withProfileDefaults,
} from "../../src/shared/profile.ts";
import { createDefaultState } from "../../src/shared/defaults.ts";
import { migrateV1 } from "../../src/shared/migrate.ts";
import {
  applyBackup,
  createBackupJson,
  parseBackupJson,
} from "../../src/shared/backup.ts";

describe("profile settings", () => {
  it("defaults to empty strings", () => {
    const { settings } = createDefaultState();
    expect(settings.displayName).toBe("");
    expect(settings.why).toBe("");
  });

  it("trims and cuts values to their limits", () => {
    expect(DISPLAY_NAME_MAX).toBe(24);
    expect(WHY_MAX).toBe(140);
    expect(cleanDisplayName("  Asha  ")).toBe("Asha");
    expect(cleanDisplayName("x".repeat(40))).toHaveLength(24);
    expect(cleanWhy("  because  ")).toBe("because");
    expect(cleanWhy("y".repeat(300))).toHaveLength(140);
    expect(cleanDisplayName(undefined)).toBe("");
    expect(cleanWhy(42)).toBe("");
  });

  it("fills the fields for stored settings that predate them", () => {
    const old = { ...createDefaultState().settings } as Record<string, unknown>;
    delete old.displayName;
    delete old.why;
    const fixed = withProfileDefaults(old as never);
    expect(fixed.displayName).toBe("");
    expect(fixed.why).toBe("");
    expect(fixed.theme).toBe(createDefaultState().settings.theme);
  });

  it("cuts over-long stored values when filling", () => {
    const stored = {
      ...createDefaultState().settings,
      displayName: "n".repeat(50),
      why: "w".repeat(500),
    };
    const fixed = withProfileDefaults(stored);
    expect(fixed.displayName).toHaveLength(24);
    expect(fixed.why).toHaveLength(140);
  });

  it("migration from v1 settings gives empty profile fields", () => {
    const result = migrateV1({ settings: { theme: "dark" } }, 1_000);
    expect(result.set.settings.displayName).toBe("");
    expect(result.set.settings.why).toBe("");
  });

  it("a backup round trip keeps both fields", () => {
    const source = createDefaultState();
    source.settings.displayName = "Asha";
    source.settings.why = "Finish the thesis";
    const parsed = parseBackupJson(createBackupJson(source));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const result = applyBackup(createDefaultState(), parsed.backup);
    expect(result.state.settings?.displayName).toBe("Asha");
    expect(result.state.settings?.why).toBe("Finish the thesis");
  });

  it("accepts an older backup without the fields and fills them", () => {
    const source = createDefaultState();
    const json = JSON.parse(createBackupJson(source)) as {
      data: { settings: Record<string, unknown> };
    };
    delete json.data.settings.displayName;
    delete json.data.settings.why;
    const parsed = parseBackupJson(JSON.stringify(json));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const result = applyBackup(createDefaultState(), parsed.backup);
    expect(result.state.settings?.displayName).toBe("");
    expect(result.state.settings?.why).toBe("");
  });

  it("cuts over-long values in an imported backup", () => {
    const source = createDefaultState();
    const json = JSON.parse(createBackupJson(source)) as {
      data: { settings: Record<string, unknown> };
    };
    json.data.settings.why = "z".repeat(400);
    json.data.settings.displayName = "q".repeat(90);
    const parsed = parseBackupJson(JSON.stringify(json));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const result = applyBackup(createDefaultState(), parsed.backup);
    expect(result.state.settings?.why).toHaveLength(140);
    expect(result.state.settings?.displayName).toHaveLength(24);
  });

  it("rejects a backup where the fields are not text", () => {
    const json = JSON.parse(createBackupJson(createDefaultState())) as {
      data: { settings: Record<string, unknown> };
    };
    json.data.settings.why = 7;
    expect(parseBackupJson(JSON.stringify(json)).ok).toBe(false);
  });
});
