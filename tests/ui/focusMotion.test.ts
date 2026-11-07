import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("../../src/ui/styles.css", import.meta.url), "utf8");

/** Every rule block as [selector, body], ignoring nesting depth. */
function rules(source: string): Array<[string, string]> {
  const found: Array<[string, string]> = [];
  const clean = source.replace(/\/\*[\s\S]*?\*\//g, "");
  const pattern = /([^{}]+)\{([^{}]*)\}/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(clean)) !== null) {
    found.push([(match[1] ?? "").trim(), match[2] ?? ""]);
  }
  return found;
}

describe("focus ring", () => {
  const focusRules = rules(css).filter(([selector]) => selector.includes(":focus-visible"));

  it("every focus-visible rule that draws a ring uses 2px accent with a 2px offset", () => {
    const rings = focusRules.filter(([, body]) => /outline\s*:/.test(body));
    expect(rings.length).toBeGreaterThan(0);
    for (const [selector, body] of rings) {
      expect(body, selector).toMatch(/outline:\s*2px solid var\(--accent\)/);
      expect(body, selector).toMatch(/outline-offset:\s*2px/);
    }
  });

  it("covers every element, not only a list of tags", () => {
    expect(focusRules.some(([selector]) => selector === "*:focus-visible")).toBe(true);
  });

  it("never removes the outline", () => {
    expect(css).not.toMatch(/outline\s*:\s*(none|0)\b/);
  });

  it("text fields do not swap the ring for a colour change alone", () => {
    const field = focusRules.find(([selector]) => selector.startsWith(".fg-input:focus-visible"));
    expect(field?.[1]).not.toMatch(/border-color:\s*transparent/);
  });
});

describe("motion", () => {
  it("has one reduced-motion rule that stills animation, transition and scrolling", () => {
    const block = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));
    const body = block.slice(0, block.indexOf("}\n}") + 3);
    expect(body).toContain("animation-duration: 0.01ms !important");
    expect(body).toContain("animation-iteration-count: 1 !important");
    expect(body).toContain("transition-duration: 0.01ms !important");
    expect(body).toContain("scroll-behavior: auto !important");
  });

  it("applies the reduced-motion rule to every element and pseudo-element", () => {
    const [selector] =
      rules(css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"))).find(([, body]) =>
        body.includes("animation-duration: 0.01ms"),
      ) ?? [""];
    expect(selector.replace(/\s+/g, " ")).toBe("*, *::before, *::after");
  });

  it("keeps the gate-closing sweep behind no-preference", () => {
    expect(css).toMatch(
      /@media \(prefers-reduced-motion: no-preference\) \{[^@]*fg-gate-close/,
    );
  });

  it("never scrolls smoothly from script", () => {
    const sources = ["src/ui/panel/PanelPage.tsx", "src/ui/components/feedback.tsx"].map((path) =>
      readFileSync(new URL(`../../${path}`, import.meta.url), "utf8"),
    );
    for (const source of sources) expect(source).not.toContain('behavior: "smooth"');
  });
});

describe("narrow widths", () => {
  it("lets segmented controls wrap instead of forcing a sideways scroll", () => {
    const group = rules(css).find(([selector]) => selector === ".fg-seg");
    expect(group?.[1]).toMatch(/flex-wrap:\s*wrap/);
    const button = rules(css).find(([selector]) => selector === ".fg-seg__btn");
    expect(button?.[1]).toMatch(/min-height:\s*28px/);
    expect(button?.[1]).not.toMatch(/(^|[^-])height:\s*28px/);
  });

  it("lets the header wrap when the window is very narrow", () => {
    const header = rules(css).find(([selector]) => selector === ".fg-header");
    expect(header?.[1]).toMatch(/flex-wrap:\s*wrap/);
    expect(header?.[1]).toMatch(/min-height:\s*var\(--header-h\)/);
    expect(header?.[1]).not.toMatch(/(^|[^-])height:\s*var\(--header-h\)/);
  });
});
