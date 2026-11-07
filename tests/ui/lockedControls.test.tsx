import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { RulesScreen } from "../../src/ui/panel/views/RulesScreen.tsx";
import { ToastProvider } from "../../src/ui/components/feedback.tsx";
import { createDefaultState } from "../../src/shared/defaults.ts";
import type { AppState } from "../../src/shared/types.ts";

function lockedState(): AppState {
  const base = createDefaultState();
  return {
    ...base,
    blockedSites: ["example.com"],
    alwaysBlockedSites: ["example.org"],
    session: {
      ...base.session,
      status: "work",
      lockLevel: "strict",
      phaseEndsAt: Date.now() + 3_600_000,
    },
  };
}

const render = (state: AppState) =>
  renderToStaticMarkup(
    <ToastProvider>
      <RulesScreen state={state} />
    </ToastProvider>,
  );

const disabledButtons = (html: string): string[] =>
  html.match(/<button\b[^>]*\bdisabled\b[^>]*>/g) ?? [];

describe("locked controls explain themselves", () => {
  const html = render(lockedState());

  it("prints the reason once, visibly, as a status", () => {
    expect(html.match(/id="lock-reason"/g) ?? []).toHaveLength(1);
    expect(html).toMatch(/<p[^>]*id="lock-reason"[^>]*role="status"|<p[^>]*role="status"[^>]*id="lock-reason"/);
    expect(html).toContain("by your strict session.");
    expect(html).not.toMatch(/\d{13}/);
  });

  it("points every disabled control at the reason", () => {
    const disabled = disabledButtons(html);
    expect(disabled.length).toBeGreaterThan(0);
    for (const button of disabled) {
      expect(button).toContain('aria-describedby="lock-reason"');
    }
  });

  it("has nothing to point at when nothing is locked", () => {
    const open = render({ ...lockedState(), session: createDefaultState().session });
    expect(open).not.toContain('id="lock-reason"');
    expect(open).not.toContain('aria-describedby="lock-reason"');
  });
});
