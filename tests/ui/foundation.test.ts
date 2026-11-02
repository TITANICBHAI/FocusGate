import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * P8 verification (design.md §9): the stylesheet keeps the §3 token
 * contract and the §4.1 foundation classes, and no hex color leaks
 * outside the two theme token blocks.
 */

const styles = readFileSync(
  new URL("../../src/ui/styles.css", import.meta.url),
  "utf8",
);

const THEME_TOKENS = [
  "--bg",
  "--surface",
  "--surface-2",
  "--border",
  "--text",
  "--text-muted",
  "--text-subtle",
  "--accent",
  "--accent-contrast",
  "--break",
  "--danger",
  "--warning",
  "--info",
] as const;

const RHYTHM_TOKENS = [
  "--header-h",
  "--tabbar-h",
  "--gutter",
  "--gap",
] as const;

const FOUNDATION_CLASSES = [
  ".fg-panel",
  ".fg-panel__main",
  ".fg-full-page",
  ".fg-full-page__inner",
  ".fg-header",
  ".fg-tabbar",
  ".fg-card",
  ".fg-card__title",
  ".fg-row",
  ".fg-row__title",
  ".fg-btn",
  ".fg-btn--primary",
  ".fg-btn--secondary",
  ".fg-btn--quiet",
  ".fg-btn--danger",
  ".fg-btn--jumbo",
  ".fg-btn--wide",
  ".fg-chip",
  ".fg-progress",
  ".fg-stat",
  ".fg-stat__value",
  ".fg-field",
  ".fg-seg",
  ".fg-toggle",
  ".fg-hero",
  ".fg-hero__time",
  ".fg-sheet",
  ".fg-empty",
  ".fg-toast-host",
  ".fg-dash",
  ".fg-input",
  ".fg-select",
  ".fg-textarea",
  ".fg-scrim",
  ".fg-skeleton",
] as const;

describe("UI foundation contract", () => {
  it("defines every design token in both themes", () => {
    for (const selector of [
      ':root[data-theme="dark"]',
      ':root[data-theme="light"]',
    ]) {
      const at = styles.indexOf(selector);
      expect(at, selector).toBeGreaterThanOrEqual(0);
      const block = styles.slice(at, styles.indexOf("}", at));
      for (const token of THEME_TOKENS) {
        expect(block, `${selector} ${token}`).toContain(token);
      }
    }
    for (const token of RHYTHM_TOKENS) {
      expect(styles, token).toContain(`${token}:`);
    }
    expect(styles).toContain(".fg-panel {\n  display: flex;");
    expect(styles).toContain("min-width: 300px");
    expect(styles).not.toContain("width: 380px");
  });

  it("keeps every foundation class in the stylesheet", () => {
    for (const className of FOUNDATION_CLASSES) {
      expect(styles, className).toContain(className);
    }
  });

  it("allows hex colors only inside the theme token blocks", () => {
    const stripped = styles
      .replace(/:root\[data-theme="(?:dark|light|system)"\]\s*\{[^{}]*\}/g, "")
      .replace(
        /@media \(prefers-color-scheme: light\)\s*\{[^{}]*\{[^{}]*\}[^{}]*\}/,
        "",
      );
    expect(stripped).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});
