import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const manifest = JSON.parse(
  readFileSync(resolve(projectRoot, "public/manifest.json"), "utf8"),
);

describe("extension manifest smoke test", () => {
  it("uses Manifest V3 and points to existing source entrypoints", () => {
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.minimum_chrome_version).toBe("110");
    expect(manifest.permissions).toContain("idle");
    expect(manifest.action.default_popup).toBeTruthy();
    expect(
      existsSync(resolve(projectRoot, manifest.action.default_popup)),
    ).toBe(true);

    expect(manifest.background.service_worker).toBeTruthy();
    expect(
      existsSync(
        resolve(projectRoot, "public", manifest.background.service_worker),
      ),
    ).toBe(true);

    for (const contentScript of manifest.content_scripts ?? []) {
      expect(contentScript.matches).not.toContain("<all_urls>");
      for (const scriptPath of contentScript.js ?? []) {
        expect(
          existsSync(resolve(projectRoot, "public", scriptPath)),
        ).toBe(true);
      }
    }
  });

  it("limits the content script to hosts supported by the current script", () => {
    const matches = manifest.content_scripts[0].matches;
    expect(matches).toEqual([
      "*://*.youtube.com/*",
      "*://*.google.com/*",
      "*://*.reddit.com/*",
      "*://*.twitter.com/*",
      "*://*.x.com/*",
      "*://*.instagram.com/*",
      "*://*.tiktok.com/*",
      "*://*.linkedin.com/*",
    ]);
  });
});
