import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * WP9/§8.4 claims regression — the deterministic subset. Each test pins a
 * user-facing claim (plan §4.7 C01–C40) against the final staged source:
 * exact copy, required behaviours in code, and absence of prohibited APIs.
 * Claims whose substance is a live-browser observation (C03, C06–C11,
 * C16–C21, C23–C25, C28, C32–C33, C41–C44) are checked in the Phase 3
 * manual matrix (docs/manual-test-guide.md); several are additionally
 * covered by module tests referenced in the comments.
 */

const root = new URL("../", import.meta.url);
const read = (path: string): string =>
  readFileSync(new URL(path, root), "utf8");

const sourceFiles = readdirSync(new URL("../src", root), {
  recursive: true,
})
  .filter((file) => /\.(ts|tsx)$/.test(file))
  .map((file) => file.replace(/\\/g, "/"));

describe("C02 — privacy claims", () => {
  it("contains no network-call APIs anywhere in the source", () => {
    expect(sourceFiles.length).toBeGreaterThan(40);
    for (const file of sourceFiles) {
      const source = read(`src/${file}`);
      expect(source, file).not.toMatch(/\bfetch\s*\(/);
      expect(source, file).not.toMatch(/XMLHttpRequest/);
      expect(source, file).not.toMatch(/new\s+WebSocket\b/);
    }
  });
});

describe("C05 — fixed 380×580 popup shell", () => {
  it("styles the popup at exactly 380×580", () => {
    const css = read("src/ui/styles.css");
    const block = css.slice(css.indexOf(".fg-popup {"), css.indexOf("}", css.indexOf(".fg-popup {")));
    expect(block).toContain("width: 380px");
    expect(block).toContain("height: 580px");
  });
});

describe("C14 — task empty state and dated/recurring tasks", () => {
  const tasks = read("src/ui/popup/TasksView.tsx");

  it("shows the documented empty state", () => {
    expect(tasks).toContain('title="No tasks yet"');
    expect(tasks).toContain("Add one to plan your next focus session.");
  });

  it("renders dates, repetition, and recurrence generation", () => {
    expect(tasks).toContain('type="date"');
    expect(tasks).toContain('type="time"');
    expect(tasks).toContain("generateRecurringForToday");
    expect(tasks).toContain("Does not repeat");
    expect(tasks).toContain("Daily");
    expect(tasks).toContain("Weekdays");
    expect(tasks).toContain("Weekly");
  });
});

describe("C15 — a commitment task is only protected while its session runs", () => {
  const tasks = read("src/ui/popup/TasksView.tsx");

  it("blocks removal of the linked task only while it runs", () => {
    expect(tasks).toContain("This task is linked to the running session.");
    expect(tasks).toContain("runningTaskId === deleteTarget.id");
  });
});

describe("C22 — keyword input splits lists", () => {
  const rules = read("src/ui/popup/RulesView.tsx");

  it("splits keyword input on commas and new lines", () => {
    expect(rules).toContain('input.split(/[,\\n]/)');
  });
});

describe("C29/C30 — password and lock copy", () => {
  it("says the password adds friction without preventing removal (C29)", () => {
    const password = read("src/ui/popup/PasswordSettings.tsx");
    expect(password).toContain("It does not prevent this extension from being disabled or");
  });

  it("describes the none lock as stop-any-time (C30)", () => {
    const focus = read("src/ui/popup/FocusView.tsx");
    expect(focus).toContain("You can stop any time with a confirmation.");
    expect(focus).toContain(
      "There is no early-stop action. You can still disable or remove the extension.",
    );
  });
});

describe("C31 — password generator and legacy upgrade", () => {
  it("generates 20–28 character passwords from crypto.getRandomValues", () => {
    const password = read("src/shared/password.ts");
    expect(password).toContain("GENERATED_PASSWORD_MIN_LENGTH = 20");
    expect(password).toContain("GENERATED_PASSWORD_MAX_LENGTH = 28");
    expect(password).toContain("crypto.getRandomValues");
    // The legacy verify/upgrade path is behaviour-tested in
    // tests/shared/password.test.ts (WP6.AC3).
  });
});

describe("C34/C35 — onboarding final button, presets, and protection check", () => {
  const onboarding = read("src/ui/onboarding/OnboardingPage.tsx");

  it("ends with an Open FocusGate action and a graceful fallback (C34)", () => {
    expect(onboarding).toContain("Open FocusGate");
    expect(onboarding).toContain(
      "Setup is saved. Open FocusGate from your browser toolbar to continue.",
    );
  });

  it("offers goal-based presets and a protection check (C35)", () => {
    expect(onboarding).toContain("BUILT_IN_PRESETS");
    expect(onboarding).toContain("Check browser access");
    expect(onboarding).toContain("Incognito access");
    expect(onboarding).toContain("Website access");
    expect(onboarding).toContain("Notifications");
  });
});

describe("C36/C37/C38 — the block page tells the truth", () => {
  const blocked = read("src/ui/blocked/BlockedPage.tsx");

  it("names every blocking reason (C36)", () => {
    for (const kind of [
      'case "session"',
      'case "standalone"',
      'case "schedule"',
      'case "allowance"',
      'case "always"',
      'case "allowOnly"',
      'case "keyword"',
    ]) {
      expect(blocked).toContain(kind);
    }
  });

  it("shows the countdown only for session and standalone reasons (C37)", () => {
    expect(blocked).toContain('reason.kind === "session" || reason.kind === "standalone"');
  });

  it("counts today's blocks from the real statistics (C38)", () => {
    expect(blocked).toContain("state.dayStats[dateKey]?.blocks");
  });
});

describe("C39 — the block page Close action really closes", () => {
  it("resolves the current tab and removes it", () => {
    const blocked = read("src/ui/blocked/BlockedPage.tsx");
    expect(blocked).toContain("chrome.tabs.getCurrent()");
    expect(blocked).toContain("chrome.tabs.remove(current.id)");
  });
});

describe("C40 — no advertising on the block page", () => {
  it("keeps promo links out of the block page and in About", () => {
    const blocked = read("src/ui/blocked/BlockedPage.tsx");
    expect(blocked).not.toContain("focusflowpc.pages.dev");
    expect(blocked).not.toContain("focusflowapp.pages.dev");

    const settings = read("src/ui/popup/SettingsView.tsx");
    expect(settings).toContain("focusflowpc.pages.dev");
    expect(settings).toContain("focusflowapp.pages.dev");
  });
});
