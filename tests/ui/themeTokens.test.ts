import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = readFileSync(
  new URL("../../src/ui/styles.css", import.meta.url),
  "utf8",
);

function themeTokens(selector: string): Record<string, string> {
  const selectorAt = styles.indexOf(selector);
  if (selectorAt < 0) throw new Error(`Theme selector not found: ${selector}`);
  const open = styles.indexOf("{", selectorAt);
  const close = styles.indexOf("}", open);
  if (open < 0 || close < 0) throw new Error(`Invalid theme block: ${selector}`);
  const block = styles.slice(open + 1, close);
  return Object.fromEntries(
    [...block.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{3,8})\s*;/g)].map(
      ([, name, value]) => [name, value],
    ),
  );
}

function systemLightTokens(): Record<string, string> {
  const match = styles.match(
    /@media \(prefers-color-scheme: light\)\s*\{\s*:root\[data-theme="system"\]\s*\{([\s\S]*?)\s*\}\s*\}/,
  );
  if (!match) throw new Error("System light theme block not found");
  return Object.fromEntries(
    [...match[1].matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{3,8})\s*;/g)].map(
      ([, name, value]) => [name, value],
    ),
  );
}

function luminance(hex: string): number {
  let digits = hex.slice(1);
  if (digits.length === 3) digits = [...digits].map((digit) => digit + digit).join("");
  const [red, green, blue] = [0, 2, 4].map((start) => {
    const value = Number.parseInt(digits.slice(start, start + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrast(foreground: string, background: string): number {
  const first = luminance(foreground);
  const second = luminance(background);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

describe("UI theme accessibility", () => {
  it.each([
    ["dark", ':root[data-theme="dark"]'],
    ["light", ':root[data-theme="light"]'],
  ])("%s theme text tokens meet WCAG AA contrast", (_theme, selector) => {
    const tokens = themeTokens(selector);
    const foregrounds = [
      "text",
      "text-muted",
      "text-subtle",
      "accent",
      "danger",
      "warning",
      "info",
    ];
    const backgrounds = ["bg", "surface", "surface-2"];

    for (const foreground of foregrounds) {
      for (const background of backgrounds) {
        expect(
          contrast(tokens[foreground], tokens[background]),
          `${foreground} on ${background}`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
    expect(contrast(tokens["accent-contrast"], tokens.accent)).toBeGreaterThanOrEqual(4.5);
  });

  it("maps system theme to the verified dark and light palettes", () => {
    expect(themeTokens(':root[data-theme="system"]')).toEqual(
      themeTokens(':root[data-theme="dark"]'),
    );
    expect(systemLightTokens()).toEqual(themeTokens(':root[data-theme="light"]'));
  });

  it("keeps declared type sizes at least 12px and supports reduced motion and focus-visible", () => {
    const fontSizes = [...styles.matchAll(/font-size\s*:\s*([^;]+);/g)].map(
      ([, value]) => value,
    );
    expect(fontSizes.length).toBeGreaterThan(0);
    for (const value of fontSizes) {
      const smallestPixelValue = [...value.matchAll(/(\d+(?:\.\d+)?)px/g)]
        .map(([, number]) => Number(number))
        .sort((a, b) => a - b)[0];
      expect(smallestPixelValue, `font-size: ${value}`).toBeGreaterThanOrEqual(12);
    }
    expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
    expect(styles).toContain("button:focus-visible");
    expect(styles).not.toContain("pb-safe");
  });
});
