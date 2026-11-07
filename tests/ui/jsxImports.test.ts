import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = new URL("../../src/ui", import.meta.url).pathname;

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? tsxFiles(path) : path.endsWith(".tsx") ? [path] : [];
  });
}

/** Names a file brings into scope: imports and local declarations. */
function declared(source: string): Set<string> {
  const names = new Set<string>();
  for (const match of source.matchAll(/import\s+(?:type\s+)?([^;]*?)\s+from\s+["'][^"']+["']/gs)) {
    for (const part of (match[1] ?? "").replace(/[{}]/g, ",").split(",")) {
      const name = part.trim().split(/\s+as\s+/).pop()?.replace(/^type\s+/, "").replace(/^\*\s+as\s+/, "").trim();
      if (name) names.add(name);
    }
  }
  for (const match of source.matchAll(/(?:function|const|class)\s+([A-Z][A-Za-z0-9]*)/g)) {
    names.add(match[1] ?? "");
  }
  return names;
}

describe("UI files", () => {
  it("import every component they use in JSX", () => {
    const problems: string[] = [];
    for (const file of tsxFiles(root)) {
      const source = readFileSync(file, "utf8");
      const known = declared(source);
      const used = new Set<string>();
      for (const match of source.matchAll(/(?<![A-Za-z0-9_$])<([A-Z][A-Za-z0-9]*)[\s/>.]/g)) used.add(match[1] ?? "");
      for (const name of used) {
        if (!known.has(name) && name !== "Fragment") {
          problems.push(`${file.slice(root.length + 1)}: <${name}> is used but not imported or declared`);
        }
      }
    }
    expect(problems).toEqual([]);
  });
});
