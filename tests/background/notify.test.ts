import { describe, expect, it } from "vitest";
import {
  showSessionNotice,
  updateActionBadge,
} from "../../src/background/notify.ts";
import type {
  ActionBadgeApi,
  NotificationApi,
  NotificationOptions,
  SessionNotice,
} from "../../src/background/notify.ts";
import { createDefaultState } from "../../src/shared/defaults.ts";

describe("session notifications", () => {
  it("formats and sends a session completion notice", async () => {
    const calls: Array<{ id: string; options: NotificationOptions }> = [];
    const notifications: NotificationApi = {
      create: async (id, options) => {
        calls.push({ id, options });
        return id;
      },
    };

    await showSessionNotice(
      notifications,
      { kind: "session_completed", elapsedMs: 25 * 60_000 },
      "focusgate.png",
    );

    expect(calls).toEqual([
      {
        id: "focusgate-session_completed",
        options: {
          type: "basic",
          iconUrl: "focusgate.png",
          title: "FocusGate",
          message: "25 min done — nice work.",
        },
      },
    ]);
  });
});

describe("session toolbar badge", () => {
  it("shows rounded-up focus time and updates the title", async () => {
    const calls = createBadgeCalls();
    const state = createDefaultState();
    state.session.status = "work";
    state.session.phaseEndsAt = 25 * 60_000 + 1;

    await updateActionBadge(calls.api, state, 0);

    expect(calls.texts).toEqual(["26"]);
    expect(calls.colors).toEqual(["#10b981"]);
    expect(calls.titles).toEqual(["FocusGate — 25:01 focus"]);
  });

  it("shows less than one minute during a break", async () => {
    const calls = createBadgeCalls();
    const state = createDefaultState();
    state.session.status = "shortBreak";
    state.session.phaseEndsAt = 40_000;

    await updateActionBadge(calls.api, state, 0);

    expect(calls.texts).toEqual(["<1"]);
    expect(calls.colors).toEqual(["#3b82f6"]);
    expect(calls.titles).toEqual(["FocusGate — 0:40 break"]);
  });

  it("shows the standalone indicator only while a block is active", async () => {
    const calls = createBadgeCalls();
    const state = createDefaultState();
    state.standalone.active = true;
    state.standalone.until = 120_000;

    await updateActionBadge(calls.api, state, 60_000);
    await updateActionBadge(calls.api, state, 120_000);

    expect(calls.texts).toEqual(["ON", ""]);
    expect(calls.titles).toEqual([
      "FocusGate — Block now is active",
      "FocusGate",
    ]);
  });
});

function createBadgeCalls() {
  const texts: string[] = [];
  const colors: string[] = [];
  const titles: string[] = [];
  const api: ActionBadgeApi = {
    setBadgeText: ({ text }) => {
      texts.push(text);
    },
    setBadgeBackgroundColor: ({ color }) => {
      colors.push(color);
    },
    setTitle: ({ title }) => {
      titles.push(title);
    },
  };
  return { api, texts, colors, titles };
}
