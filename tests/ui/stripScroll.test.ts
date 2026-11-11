import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("../../src/ui/styles.css", import.meta.url), "utf8");

/** Every rule block as [selector, body], ignoring nesting depth and comments. */
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

const pinned = (selectorPart: string) =>
  rules(css).filter(
    ([selector, body]) =>
      selector.includes(selectorPart) && /position\s*:\s*(sticky|fixed)/.test(body),
  );

describe("the status strip scrolls with the page", () => {
  it("is never pinned, so it does not hover over the content", () => {
    expect(pinned(".fg-nowline")).toEqual([]);
    expect(pinned(".fg-panel__strip")).toEqual([]);
  });

  it("leaves only the header and the tab bar pinned in the panel", () => {
    const names = rules(css)
      .filter(([, body]) => /position\s*:\s*sticky/.test(body))
      .map(([selector]) => selector)
      .filter((selector) => selector.startsWith(".fg-header") || selector.startsWith(".fg-tabbar"));
    expect(names).toEqual([".fg-header", ".fg-tabbar"]);
  });
});
