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

describe("WP7-B notifications", () => {
  it("appends the debrief to the completion notice", async () => {
    const created: Array<{ id: string; message: string }> = [];
    await showSessionNotice(
      {
        create: (id, options) => {
          created.push({ id, message: options.message });
        },
      },
      {
        kind: "session_completed",
        elapsedMs: 25 * 60_000,
        debrief: {
          blockedAttempts: 0,
          headline: "Clean session — no blocked attempts",
          pace: "ran 5 min over",
        },
      },
    );
    expect(created).toHaveLength(1);
    expect(created[0]?.message).toContain("Clean session — no blocked attempts");
    expect(created[0]?.message).toContain("ran 5 min over");
  });

  it("announces unlocked achievements", async () => {
    const created: Array<{ id: string; message: string }> = [];
    await showSessionNotice(
      {
        create: (id, options) => {
          created.push({ id, message: options.message });
        },
      },
      { kind: "achievement_unlocked", label: "Iron Session" },
    );
    expect(created[0]?.message).toBe("Achievement unlocked — Iron Session.");
  });

  it("reminds about the end-of-day reflection", async () => {
    const created: Array<{ id: string; message: string }> = [];
    await showSessionNotice(
      {
        create: (id, options) => {
          created.push({ id, message: options.message });
        },
      },
      { kind: "end_of_day_reflection" },
    );
    expect(created[0]?.id).toBe("focusgate-end_of_day_reflection");
    expect(created[0]?.message).toContain("How was your day?");
  });

  it("announces allowance heads-up and exhaustion alerts", async () => {
    const created: Array<{ id: string; message: string }> = [];
    const notifications = {
      create: (id: string, options: { message: string }) => {
        created.push({ id, message: options.message });
      },
    };
    await showSessionNotice(notifications, {
      kind: "allowance_heads_up",
      domain: "example.com",
      minutesLeft: 5,
    });
    expect(created[0]?.message).toContain("example.com");
    expect(created[0]?.message).toContain("5 min of today's budget left");

    await showSessionNotice(notifications, {
      kind: "allowance_exhausted",
      domain: "example.com",
      resetsAt: 1_000_000,
    });
    expect(created[1]?.message).toContain("daily limit reached");
    expect(created[1]?.message).toContain("example.com");
  });

  it("announces the weekly report with hours and minutes", async () => {
    const created: Array<{ id: string; message: string }> = [];
    await showSessionNotice(
      {
        create: (id, options) => {
          created.push({ id, message: options.message });
        },
      },
      {
        kind: "weekly_report",
        focusText: "4 h 30 min",
        sessionsCompleted: 6,
      },
    );
    expect(created[0]?.id).toBe("focusgate-weekly_report");
    expect(created[0]?.message).toBe(
      "Weekly report: 4 h 30 min focused across 6 completed sessions.",
    );
  });
});

describe("WP7-B allowance toolbar badge", () => {
  it("keeps the session badge winning over the allowance badge", async () => {
    const calls = createBadgeCalls();
    const state = createDefaultState();
    state.session = {
      ...state.session,
      status: "work",
      phaseEndsAt: 25 * 60_000,
    };
    await updateActionBadge(calls.api, state, 0, {
      domain: "example.com",
      minutesLeft: 12,
    });
    expect(calls.texts).toEqual(["25"]);
    expect(calls.titles).toEqual(["FocusGate — 25:00 focus"]);
  });

  it("shows allowance minutes on an idle toolbar", async () => {
    const calls = createBadgeCalls();
    const state = createDefaultState();
    await updateActionBadge(calls.api, state, 0, {
      domain: "example.com",
      minutesLeft: 12,
    });
    expect(calls.texts).toEqual(["12"]);
    expect(calls.titles).toEqual([
      "FocusGate — example.com: about 12 min left today",
    ]);
  });

  it("keeps the standalone indicator winning over the allowance badge", async () => {
    const calls = createBadgeCalls();
    const state = createDefaultState();
    state.standalone = {
      ...state.standalone,
      active: true,
      startsAt: 0,
      until: 60_000,
    };
    await updateActionBadge(calls.api, state, 0, {
      domain: "example.com",
      minutesLeft: 12,
    });
    expect(calls.texts).toEqual(["ON"]);
    expect(calls.titles).toEqual(["FocusGate — Block now is active"]);
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
