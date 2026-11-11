import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Phase 8 gave the product colour: lavender for the brand and for notes, sand for blocking, mint
 * for open and on a break, rose for danger. These tests read the real stylesheet, so they guard
 * what ships: every wash keeps its text readable, the layer stays made of tokens, and amber stays
 * the colour of blocking.
 */
const css = readFileSync("src/ui/styles.css", "utf8");

const WASHES = ["accent", "break", "warning", "danger"] as const;
const NEW_TOKENS = WASHES.flatMap((name) => [`${name}-soft`, `${name}-edge`]);

function tokenBlocks(selector: string): string[] {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return [...css.matchAll(new RegExp(`${escaped}\\s*\\{([^{}]*)\\}`, "g"))].map(
    (match) => match[1] ?? "",
  );
}

function tokensIn(block: string): Record<string, string> {
  const tokens: Record<string, string> = {};
  for (const match of block.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) {
    tokens[match[1] ?? ""] = match[2] ?? "";
  }
  return tokens;
}

const themes: Record<string, Record<string, string>> = {
  dark: tokensIn(tokenBlocks(':root[data-theme="dark"]')[0] ?? ""),
  light: tokensIn(tokenBlocks(':root[data-theme="light"]')[0] ?? ""),
  "system (dark)": tokensIn(tokenBlocks(':root[data-theme="system"]')[0] ?? ""),
  "system (light)": tokensIn(tokenBlocks(':root[data-theme="system"]')[1] ?? ""),
};

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * channel(n >> 16) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

function contrast(a: string, b: string): number {
  for (const colour of [a, b]) {
    if (!/^#[0-9a-f]{6}$/i.test(colour)) throw new Error(`not a solid colour: "${colour}"`);
  }
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((high ?? 0) + 0.05) / ((low ?? 0) + 0.05);
}

describe("the wash tokens", () => {
  for (const [theme, tokens] of Object.entries(themes)) {
    it(`${theme}: all eight are defined as solid colours`, () => {
      for (const name of NEW_TOKENS) {
        expect(tokens[name], `${theme}: --${name}`).toMatch(/^#[0-9a-f]{6}$/i);
      }
    });
  }

  for (const [theme, tokens] of Object.entries(themes)) {
    it(`${theme}: text stays readable (4.5:1) on every wash`, () => {
      for (const wash of WASHES) {
        const ground = tokens[`${wash}-soft`] ?? "";
        for (const text of ["text", "text-muted", "text-subtle"]) {
          expect(
            contrast(tokens[text] ?? "", ground),
            `${theme}: --${text} on --${wash}-soft`,
          ).toBeGreaterThanOrEqual(4.5);
        }
      }
    });

    it(`${theme}: a wash's own colour is readable (4.5:1) on it, for chips, pills and marks`, () => {
      for (const wash of WASHES) {
        expect(
          contrast(tokens[wash] ?? "", tokens[`${wash}-soft`] ?? ""),
          `${theme}: --${wash} on --${wash}-soft`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    });

    it(`${theme}: the focus ring (the accent) shows on the brand wash (3:1)`, () => {
      expect(contrast(tokens.accent ?? "", tokens["accent-soft"] ?? "")).toBeGreaterThanOrEqual(3);
    });
  }
});

describe("the colour layer", () => {
  const marker = "colour layer (Phase 8)";
  const layer = css.slice(css.indexOf(marker));

  it("exists, and is the end of the stylesheet", () => {
    expect(css.indexOf(marker)).toBeGreaterThan(0);
    expect(layer.length).toBeGreaterThan(500);
  });

  it("is made of tokens: no raw colours, tints, gradients or shadows", () => {
    expect(layer).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(layer).not.toMatch(/rgba?\(|hsla?\(|color-mix\(/);
    expect(layer).not.toMatch(/gradient\(/);
    expect(layer).not.toMatch(/box-shadow|text-shadow|filter:/);
    expect(layer).not.toMatch(/!important/);
  });

  it("uses no font size below 12px", () => {
    for (const match of layer.matchAll(/font-size:\s*(\d+(?:\.\d+)?)px/g)) {
      expect(Number(match[1])).toBeGreaterThanOrEqual(12);
    }
  });
});

describe("amber is for blocking", () => {
  const body = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const rules = [...body.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((match) => ({
    selector: (match[1] ?? "").split(/\s+/).join(" ").trim(),
    declarations: match[2] ?? "",
  }));
  const amber = rules.filter(({ declarations }) => /var\(--warning/.test(declarations));

  // A rule may use the amber tokens only for something that is blocking, locked, or a warning.
  const BLOCKING = [
    ".fg-row--on",
    ".fg-chip--lock",
    ".fg-pill--standing",
    ".fg-nowline--standing",
    ".fg-progress--warn",
    ".fg-hero--warn",
    ".fg-block-head",
    ".fg-strip__span",
    ".fg-sched.is-on",
    ".fg-block-inner",
    ".fg-full-page:has(.fg-block-inner)",
  ];

  it("finds the amber rules it is checking", () => {
    expect(amber.length).toBeGreaterThanOrEqual(10);
  });

  it("uses the amber tokens only in rules about blocking", () => {
    for (const { selector } of amber) {
      expect(
        BLOCKING.some((allowed) => selector.includes(allowed)),
        `amber used by "${selector}"`,
      ).toBe(true);
    }
  });
});
