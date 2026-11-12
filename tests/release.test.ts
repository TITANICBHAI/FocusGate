import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("release 1.0.2", () => {
  it("uses the same version in package.json and the manifest", () => {
    const pkg = JSON.parse(read("package.json")) as { version: string };
    const manifest = JSON.parse(read("public/manifest.json")) as { version: string };
    expect(pkg.version).toBe("1.0.2");
    expect(manifest.version).toBe("1.0.2");
  });

  it("retains the pinned 1.0.1 changelog entry above 1.1.0", () => {
    const log = read("CHANGELOG.md");
    const entry = log.indexOf("## [1.0.1]");
    expect(entry).toBeGreaterThan(-1);
    expect(entry).toBeLessThan(log.indexOf("## [1.1.0]"));
    expect(log).toContain(
      'Focus sessions and schedules end on time again. The dashboard opens again. "Check a URL" no longer blanks the side panel. A crash now shows a message instead of a blank screen.',
    );
  });
});
