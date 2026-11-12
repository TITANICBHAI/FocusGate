import { describe, expect, it } from "vitest";
import { createBackupJson, parseBackupJson } from "../../src/shared/backup.ts";
import { createDefaultState } from "../../src/shared/defaults.ts";
import { withProfileDefaults } from "../../src/shared/profile.ts";
import type { Settings } from "../../src/shared/types.ts";

describe("the chime setting", () => {
  it("is on by default", () => {
    expect(createDefaultState().settings.notifications.chime).toBe(true);
  });

  it("is switched on for settings saved before it existed, and left alone when set", () => {
    const old = createDefaultState().settings;
    const { chime: _unused, ...withoutChime } = old.notifications;
    void _unused;
    const saved = { ...old, notifications: withoutChime } as unknown as Settings;
    expect(withProfileDefaults(saved).notifications.chime).toBe(true);
    const off: Settings = { ...old, notifications: { ...old.notifications, chime: false } };
    expect(withProfileDefaults(off).notifications.chime).toBe(false);
  });

  it("goes through a backup, off or on", () => {
    const state = createDefaultState();
    state.settings.notifications.chime = false;
    const parsed = parseBackupJson(createBackupJson(state, 1));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.backup.data.settings.notifications.chime).toBe(false);
  });

  it("still imports a backup made before the setting existed", () => {
    const state = createDefaultState();
    const json = JSON.parse(createBackupJson(state, 1)) as { data: { settings: { notifications: Record<string, boolean> } } };
    delete json.data.settings.notifications.chime;
    expect(parseBackupJson(JSON.stringify(json)).ok).toBe(true);
  });

  it("refuses a chime value that is not true or false", () => {
    const json = JSON.parse(createBackupJson(createDefaultState(), 1)) as { data: { settings: { notifications: Record<string, unknown> } } };
    json.data.settings.notifications.chime = "loud";
    expect(parseBackupJson(JSON.stringify(json)).ok).toBe(false);
  });
});
