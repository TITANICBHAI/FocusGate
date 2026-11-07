import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ListRow } from "../../src/ui/components/primitives.tsx";
import { RulesScreen } from "../../src/ui/panel/views/RulesScreen.tsx";
import { ToastProvider } from "../../src/ui/components/feedback.tsx";
import { createDefaultState } from "../../src/shared/defaults.ts";

const css = readFileSync(new URL("../../src/ui/styles.css", import.meta.url), "utf8");

function rule(selector: string): string {
  const at = css.lastIndexOf(`\n${selector} {`);
  if (at < 0) throw new Error(`rule not found: ${selector}`);
  return css.slice(css.indexOf("{", at), css.indexOf("}", at));
}

describe("list rows", () => {
  it("mark a row that is blocking right now", () => {
    expect(renderToStaticMarkup(<ListRow title="a.com" blocking />)).toContain("fg-row--on");
    expect(renderToStaticMarkup(<ListRow title="a.com" />)).not.toContain("fg-row--on");
  });

  it("have a 48px minimum height and a 3px left bar", () => {
    const body = rule(".fg-row");
    expect(body).toContain("min-height: 48px");
    expect(body).toContain("border-left: 3px solid");
    expect(rule(".fg-row--on")).toContain("var(--warning)");
  });

  it("show whole titles instead of cutting them with an ellipsis", () => {
    const body = rule(".fg-row__title");
    expect(body).not.toContain("ellipsis");
    expect(body).not.toContain("nowrap");
    expect(body).toContain("overflow-wrap");
  });

  it("let chips wrap instead of overlapping at 300px", () => {
    expect(rule(".fg-chip")).toContain("max-width: 100%");
  });

  it("flatten panel sections: no box around a group", () => {
    const at = css.indexOf(".fg-panel__main .fg-card {");
    expect(at).toBeGreaterThan(-1);
    const body = css.slice(css.indexOf("{", at), css.indexOf("}", at));
    expect(body).toContain("border: 0");
    expect(body).toContain("background: transparent");
  });
});

describe("sites list", () => {
  it("puts the amber bar on a site that is blocking now, and not on one that is not", () => {
    const base = createDefaultState();
    const state = {
      ...base,
      blockedSites: ["example.com"],
      alwaysBlockedSites: ["example.org"],
    };
    const html = renderToStaticMarkup(
      <ToastProvider>
        <RulesScreen state={state} />
      </ToastProvider>,
    );
    // example.org is always blocked; example.com only blocks during focus.
    const orgRow = html.slice(html.indexOf("example.org") - 600, html.indexOf("example.org"));
    expect(orgRow).toContain("fg-row--on");
    const comRow = html.slice(html.indexOf("example.com") - 600, html.indexOf("example.com"));
    expect(comRow.split("fg-row").pop()).not.toContain("--on");
  });
});
