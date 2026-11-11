import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { YouScreen } from "../../src/ui/panel/views/YouScreen.tsx";
import { ToastProvider } from "../../src/ui/components/feedback.tsx";
import { createDefaultState } from "../../src/shared/defaults.ts";
import type { AppState } from "../../src/shared/types.ts";

function render(state: AppState): string {
  return renderToStaticMarkup(
    <ToastProvider>
      <YouScreen state={state} onOpenRules={() => undefined} />
    </ToastProvider>,
  );
}

function filled(): AppState {
  const state = createDefaultState();
  state.settings.displayName = "Asha";
  state.settings.why = "Finish the thesis";
  state.blockedSites = ["a.com", "b.com", "c.com"];
  return state;
}

describe("profile screen", () => {
  it("shows the sections in the planned order", () => {
    const html = render(filled());
    const order = [
      "Your reason",
      "What you're protecting",
      "Today and this week",
      "Achievements",
      "Journal and tasks",
    ].map((heading) => html.indexOf(heading.replace("'", "&#x27;")) >= 0
      ? html.indexOf(heading.replace("'", "&#x27;"))
      : html.indexOf(heading));
    expect(order.every((index) => index >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    // The header (name) comes before everything else.
    expect(html.indexOf("Asha")).toBeLessThan(order[0]!);
  });

  it("shows the badge letter and the name and reason inputs", () => {
    const html = render(filled());
    expect(html).toMatch(/fg-badge[^>]*>A</);
    expect(html).toContain('value="Asha"');
    expect(html).toContain("Finish the thesis");
    expect(html).toContain("Shown on the block page.");
  });

  it("uses placeholders and a neutral badge when empty", () => {
    const html = render(createDefaultState());
    expect(html).toContain('placeholder="Your name"');
    expect(html).toContain("Why are you doing this?");
    expect(html).not.toMatch(/fg-badge[^>]*>[A-Z]</);
  });

  it("makes each rule row a button with its value in the name", () => {
    const html = render(filled());
    expect(html).toContain('aria-label="Focus list, 3 sites. Open in Rules."');
    expect(html).toContain('aria-label="Schedules, No schedules yet. Open in Rules."');
    expect(html).toMatch(/>Password</);
    expect(html).not.toContain('aria-label="Password, Not set. Open in Rules."');
  });

  it("collapses the journal and keeps tasks, reflection and habits inside it", () => {
    const html = render(filled());
    const start = html.indexOf("<details");
    expect(start).toBeGreaterThan(-1);
    expect(html.slice(start)).not.toMatch(/^<details[^>]*\sopen/);
    const inside = html.slice(start, html.indexOf("</details>"));
    expect(inside).toContain("Journal and tasks");
    expect(inside).toContain("Reflection");
    expect(inside).toContain("Habits");
  });

  it("explains each achievement with its condition", () => {
    const html = render(filled());
    expect(html).toContain("Complete a focus session with zero blocked attempts.");
  });
});
