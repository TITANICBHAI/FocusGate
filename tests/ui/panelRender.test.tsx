import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { FocusScreen } from "../../src/ui/panel/views/FocusScreen.tsx";
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
});
