import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("../../src/ui/styles.css", import.meta.url), "utf8");

function rule(selector: string): string {
  const at = css.indexOf(`${selector} {`);
  if (at < 0) throw new Error(`rule not found: ${selector}`);
  return css.slice(css.indexOf("{", at), css.indexOf("}", at));
}

describe("type system", () => {
  it("defines the two font stacks without loading any font file", () => {
    expect(css).toMatch(/--font-ui:\s*"Barlow",\s*system-ui/);
    expect(css).toMatch(/--font-num:\s*"Barlow Semi Condensed",\s*"Barlow",\s*system-ui/);
    expect(css).not.toContain("@font-face");
    expect(css).not.toMatch(/url\([^)]*\.woff2?\)/);
  });

  it("uses the UI font for the page and has no leftover Inter", () => {
    expect(css).not.toContain("Inter");
    expect(css).toMatch(/font:\s*400 14px\/1\.45 var\(--font-ui\)/);
    expect(css).toMatch(/font-family:\s*var\(--font-ui\)/);
  });

  it("has no all-caps labels and no tracked-out letters", () => {
    expect(css).not.toContain("text-transform: uppercase");
    expect(css).not.toMatch(/letter-spacing:\s*0\.0\d+em/);
  });

  it("shows numbers in the number font with equal-width digits", () => {
    for (const selector of [".fg-hero__time", ".fg-stat__value", ".fg-block-countdown"]) {
      const body = rule(selector);
      expect(body, selector).toContain("var(--font-num)");
      expect(body, selector).toContain("tabular-nums");
    }
  });
});
