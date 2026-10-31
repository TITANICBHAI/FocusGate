import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CONTENT_SCRIPT_MATCHES } from "../src/content/sites.ts";

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
    // WP5 cutover: the popup is the staged UI page (built to dist root).
    expect(manifest.action.default_popup).toBe("popup.html");
    expect(
      existsSync(resolve(projectRoot, "src/ui", manifest.action.default_popup)),
    ).toBe(true);

    expect(manifest.background.service_worker).toBe("background.js");
    expect(
      existsSync(resolve(projectRoot, "src/background/index.ts")),
    ).toBe(true);

    for (const contentScript of manifest.content_scripts ?? []) {
      expect(contentScript.matches).not.toContain("<all_urls>");
      // WP5 cutover: the content entry is the v2 script built from
      // src/content/v2-entry.ts.
      for (const scriptPath of contentScript.js ?? []) {
        expect(scriptPath).toBe("content-v2.js");
        expect(
          existsSync(resolve(projectRoot, "src/content/v2-entry.ts")),
        ).toBe(true);
      }
    }
  });

  it("exposes the block page to web-initiated redirects and the dashboard as options", () => {
    expect(manifest.options_ui).toMatchObject({
      page: "dashboard.html",
      open_in_tab: true,
    });
    expect(
      manifest.web_accessible_resources?.some((resource) =>
        resource.resources?.includes("blocked.html"),
      ),
    ).toBe(true);
  });

  it("keeps manifest matches aligned with the supported site table", () => {
    const matches = manifest.content_scripts[0].matches;
    expect(matches).toEqual(CONTENT_SCRIPT_MATCHES);
  });

  it("declares the focus and quick-block commands with their shortcuts", () => {
    const commands = manifest.commands ?? {};
    expect(commands["toggle-focus"]?.suggested_key?.default).toBe("Alt+Shift+F");
    expect(commands["block-current-site"]?.suggested_key?.default).toBe(
      "Alt+Shift+B",
    );
  });
});
