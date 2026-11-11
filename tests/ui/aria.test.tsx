import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  Card,
  HeroTimer,
  Progress,
  Segmented,
  Toggle,
} from "../../src/ui/components/primitives.tsx";
import { PanelChrome } from "../../src/ui/panel/PanelPage.tsx";
import { YouScreen } from "../../src/ui/panel/views/YouScreen.tsx";
import { ToastProvider } from "../../src/ui/components/feedback.tsx";
import { createDefaultState } from "../../src/shared/defaults.ts";

const css = readFileSync(new URL("../../src/ui/styles.css", import.meta.url), "utf8");
const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

describe("Toggle", () => {
  const html = renderToStaticMarkup(
    <Toggle label="Notify me" checked onCheckedChange={() => undefined} />,
  );
  it("is a switch with aria-checked and nothing else", () => {
    expect(html).toContain('role="switch"');
    expect(html).toContain('aria-checked="true"');
    expect(html).not.toContain("aria-pressed");
  });
  it("is styled from aria-checked", () => {
    expect(css).toContain('.fg-toggle__track[aria-checked="true"]');
    expect(css).not.toContain('.fg-toggle__track[aria-pressed');
  });
});

describe("Segmented", () => {
  const html = renderToStaticMarkup(
    <Segmented
      label="Theme"
      options={[
        { value: "a", label: "A" },
        { value: "b", label: "B" },
      ]}
      value="a"
      onChange={() => undefined}
    />,
  );
  it("uses aria-pressed only, and names the group once", () => {
    expect(html).toContain('aria-pressed="true"');
    expect(html).not.toContain("aria-selected");
    expect(html).not.toContain("aria-labelledby");
    expect(html).toContain('aria-label="Theme"');
  });
  it("is styled from aria-pressed only", () => {
    expect(css).not.toContain('.fg-seg__btn[aria-selected');
    expect(css).toContain('.fg-seg__btn[aria-pressed="true"]');
  });
});

describe("Progress and the timer", () => {
  it("has an accessible name", () => {
    const html = renderToStaticMarkup(<Progress value={0.4} label="Daily goal" />);
    expect(html).toContain('role="progressbar"');
    expect(html).toContain('aria-label="Daily goal"');
  });
  it("names the timer's progress bar", () => {
    const html = renderToStaticMarkup(
      <HeroTimer label="Focus" seconds={600} progress={0.5} />,
    );
    expect(html).toContain('aria-label="Focus progress"');
  });
  it("an editable time keeps its visible text in its name", () => {
    const html = renderToStaticMarkup(<HeroTimer label="Focus" seconds={1500} editable />);
    expect(html).toContain('aria-label="Edit session length, 25:00"');
  });
});

describe("panel structure", () => {
  const html = renderToStaticMarkup(
    <PanelChrome
      tab="rules"
      onTabChange={() => undefined}
      header={<header>head</header>}
      strip={<div>strip</div>}
      panels={{
        focus: <p>f</p>,
        rules: <Card title="Sites">r</Card>,
        you: <p>y</p>,
      }}
    />,
  );

  it("has one h1, and it is hidden visually", () => {
    expect(html.match(/<h1/g) ?? []).toHaveLength(1);
    expect(html).toMatch(/<h1 class="fg-sr-only">FocusGate<\/h1>/);
  });

  it("puts the tab buttons inside a labelled tablist", () => {
    const list = html.slice(html.indexOf('role="tablist"'));
    expect(html).toContain('role="tablist" aria-label="Panel sections"');
    expect(list.match(/role="tab"/g) ?? []).toHaveLength(3);
  });

  it("keeps main a landmark, with the tabpanels inside it", () => {
    expect(html).not.toMatch(/<main[^>]*role=/);
    const main = html.slice(html.indexOf("<main"), html.indexOf("</main>"));
    expect(main.match(/role="tabpanel"/g) ?? []).toHaveLength(3);
  });

  it("puts the status strip inside the scrolling area, before the first tab panel", () => {
    const before = html.slice(0, html.indexOf("<main"));
    const main = html.slice(html.indexOf("<main"), html.indexOf("</main>"));
    expect(before).not.toContain("strip");
    expect(main).toContain("strip");
    expect(main.indexOf("strip")).toBeLessThan(main.indexOf('role="tabpanel"'));
  });

  it("links every tab to a panel that exists, and back", () => {
    for (const name of ["focus", "rules", "you"]) {
      expect(html).toContain(`aria-controls="panel-${name}-panel"`);
      expect(html).toMatch(new RegExp(`id="panel-${name}-panel"[^>]*aria-labelledby="panel-${name}-tab"|aria-labelledby="panel-${name}-tab"[^>]*id="panel-${name}-panel"`));
      expect(html).toContain(`id="panel-${name}-tab"`);
    }
  });

  it("starts its card headings at h2, not h3", () => {
    expect(html).toContain("<h2");
    expect(html).not.toContain("<h3");
  });
});

describe("headings", () => {
  it("the profile screen has no h3 without an h2 before it", () => {
    const html = renderToStaticMarkup(
      <ToastProvider>
        <YouScreen state={createDefaultState()} onOpenRules={() => undefined} />
      </ToastProvider>,
    );
    expect(html).not.toContain("<h3");
    expect(html).toContain("<h2");
  });
});

describe("names that match what is shown", () => {
  it("the dashboard brand link has no label of its own", () => {
    expect(read("src/ui/dashboard/DashboardPage.tsx")).not.toContain(
      'aria-label="FocusGate dashboard"',
    );
  });
});
