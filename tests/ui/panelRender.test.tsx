import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  FocusScreen,
  LockHint,
  strictStopSummary,
} from "../../src/ui/panel/views/FocusScreen.tsx";
import { ToastProvider } from "../../src/ui/components/feedback.tsx";
import { createDefaultState } from "../../src/shared/defaults.ts";
import type { AppState } from "../../src/shared/types.ts";

/**
 * P8 verification (design.md §9): the focus hero renders exactly one
 * primary action per state at panel width, the timer keeps the 72px
 * `fg-hero__time` class, and the extend chips exist only while running.
 * Static markup rendering is used because CI has no real browser; the
 * panel-width layout itself is asserted against the stylesheet in
 * foundation.test.ts and checked visually in the manual matrix.
 */

function renderFocus(state: AppState): string {
  return renderToStaticMarkup(
    <ToastProvider>
      <FocusScreen
        state={state}
        onOpenRules={() => undefined}
        onOpenTasks={() => undefined}
      />
    </ToastProvider>,
  );
}

function runningState(): AppState {
  const base = createDefaultState();
  return {
    ...base,
    session: {
      ...base.session,
      status: "work",
      sessionId: "session-test",
      phaseStartedAt: Date.now() - 60_000,
      phaseEndsAt: Date.now() + 25 * 60_000,
      phasePlannedMs: 25 * 60_000,
      plannedWorkMs: 25 * 60_000,
    },
  };
}

describe("panel focus screen render", () => {
  it("idle: 72px hero timer class, exactly one primary action, no extend chips", () => {
    const html = renderFocus(createDefaultState());
    expect(html).toContain("fg-hero__time");
    expect(html).toContain("Start focus");
    expect(html.match(/fg-btn--primary/g) ?? []).toHaveLength(1);
    expect(html).not.toContain('aria-label="Extend session"');
  });

  it("running: live countdown, no primary CTA, extend chips present", () => {
    const html = renderFocus(runningState());
    expect(html).toContain("fg-hero__time");
    expect(html).toContain('aria-label="Extend session"');
    expect(html).toContain("+10 min");
    expect(html).toContain("Stop session");
    expect(html.match(/fg-btn--primary/g) ?? []).toHaveLength(0);
  });

  it("idle: explains only the chosen lock, beside an info button that says it is open", () => {
    const html = renderFocus(createDefaultState());
    expect(html).toContain("You can stop any time with a confirmation.");
    expect(html).toContain("You can add, change or remove rules at any time.");
    expect(html).not.toContain("I GIVE UP");
    expect(html).not.toContain("There is no early-stop action.");
    expect(html).not.toContain("not remove or relax them");
    expect(html.match(/role="note"/g) ?? []).toHaveLength(1);
    expect(html).not.toContain("What each lock means");
    expect(html).toMatch(/Session lock[\s\S]*aria-label="What does this lock do\?"[\s\S]*fg-seg/);
    expect(html).toMatch(/aria-label="What does this lock do\?"[^>]*aria-expanded="true"|aria-expanded="true"[^>]*aria-label="What does this lock do\?"/);
    expect(html).toContain('aria-label="Hide this hint"');
  });

  it("explains each lock on its own, with the rules for adding and removing", () => {
    const open = { open: true, id: "lock-hint", toggle: () => undefined };
    const hint = (level: "none" | "strict" | "commitment", hasPassword = false) =>
      renderToStaticMarkup(
        <LockHint level={level} hasPassword={hasPassword} info={open} onHide={() => undefined} />,
      );
    const noRemoving = "You can add rules, but not remove or relax them until the session ends.";

    const none = hint("none");
    expect(none).toContain("None.");
    expect(none).toContain("You can stop any time with a confirmation.");
    expect(none).toContain("You can add, change or remove rules at any time.");
    expect(none).not.toContain("I GIVE UP");

    const strict = hint("strict");
    expect(strict).toContain("Strict.");
    expect(strict).toContain(
      "Stopping early needs the phrase “I GIVE UP” and a 15-second wait. You can still disable or remove the extension.",
    );
    expect(strict).toContain(noRemoving);

    expect(hint("strict", true)).toContain("Stopping early needs your password.");

    const commit = hint("commitment");
    expect(commit).toContain("Commit.");
    expect(commit).toContain(
      "There is no early-stop action. You can still disable or remove the extension.",
    );
    expect(commit).toContain(noRemoving);
    expect(commit).not.toContain("I GIVE UP");
  });

  it("shows no hint at all once it is hidden", () => {
    const closed = { open: false, id: "lock-hint", toggle: () => undefined };
    expect(
      renderToStaticMarkup(
        <LockHint level="strict" hasPassword={false} info={closed} onHide={() => undefined} />,
      ),
    ).toBe("");
  });

  it("builds the strict stop sentence from one place", () => {
    expect(strictStopSummary(true)).toBe(
      "Stopping early needs your password. You can still disable or remove the extension.",
    );
    expect(strictStopSummary(false)).toBe(
      "Stopping early needs the phrase “I GIVE UP” and a 15-second wait. You can still disable or remove the extension.",
    );
  });

  it("empty state: an Add sites button replaces the grey line, and Start focus stays enabled", () => {
    const html = renderFocus(createDefaultState());
    expect(html).toContain("Add sites");
    expect(html).not.toContain("add sites in Rules");
    expect(html.match(/fg-btn--primary/g) ?? []).toHaveLength(1);
    const start = html.match(/<button[^>]*>(?:(?!<\/button>)[\s\S])*Start focus/);
    expect(start?.[0]).toBeDefined();
    expect(start?.[0]).not.toContain("disabled");
    // The Add sites button is secondary, never a second primary.
    expect(html).toMatch(/fg-btn--secondary[^>]*>(?:(?!<\/button>)[\s\S])*Add sites/);
  });

  it("with sites set, the summary shows and there is no Add sites button", () => {
    const state = createDefaultState();
    state.blockedSites = ["example.com"];
    const html = renderFocus(state);
    expect(html).not.toContain("Add sites");
  });
});
