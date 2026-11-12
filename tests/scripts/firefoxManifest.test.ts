import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import firefoxManifestModule from "../../scripts/firefox-manifest.cjs";

const { toFirefoxManifest } = firefoxManifestModule as {
  toFirefoxManifest(manifest: Record<string, unknown>): Record<string, unknown>;
};

/** The parts of the Firefox manifest these tests look at. */
interface FirefoxManifest {
  manifest_version: number;
  name: string;
  version: string;
  description: string;
  background: { service_worker?: string; scripts?: string[]; type?: string };
  side_panel?: unknown;
  minimum_chrome_version?: unknown;
  permissions: string[];
  host_permissions: string[];
  sidebar_action: { default_panel: string; open_at_install: boolean; default_icon: unknown };
  action: { default_popup?: string };
  browser_specific_settings: {
    gecko: { id: string; strict_min_version: string; data_collection_permissions: unknown };
    gecko_android: { strict_min_version: string };
  };
  content_scripts: unknown;
  commands: unknown;
  options_ui: unknown;
  web_accessible_resources: unknown;
}

const chromeManifest = JSON.parse(
  readFileSync(new URL("../../public/manifest.json", import.meta.url), "utf8"),
) as Record<string, unknown>;

const firefox = toFirefoxManifest(chromeManifest) as unknown as FirefoxManifest;

describe("the Firefox manifest made from the Chrome one", () => {
  it("is Manifest V3 and keeps the name, version and description", () => {
    expect(firefox.manifest_version).toBe(3);
    expect(firefox.name).toBe(chromeManifest.name);
    expect(firefox.version).toBe(chromeManifest.version);
    expect(firefox.description).toBe(chromeManifest.description);
  });

  it("runs the background as scripts, not a service worker, which Firefox does not run", () => {
    expect(firefox.background.service_worker).toBeUndefined();
    expect(firefox.background.scripts).toEqual(["background.js"]);
    expect(firefox.background.type).toBe("module");
  });

  it("drops what only Chrome understands", () => {
    expect(firefox.side_panel).toBeUndefined();
    expect(firefox.minimum_chrome_version).toBeUndefined();
    expect(firefox.permissions).not.toContain("sidePanel");
    expect(JSON.stringify(firefox)).not.toContain("sidePanel");
  });

  it("keeps every other permission and the site access", () => {
    const kept = (chromeManifest.permissions as string[]).filter((p) => p !== "sidePanel");
    expect(firefox.permissions).toEqual(kept);
    expect(firefox.host_permissions).toEqual(chromeManifest.host_permissions);
    expect(firefox.permissions).toContain("declarativeNetRequest");
  });

  it("opens the panel in Firefox's sidebar on desktop", () => {
    expect(firefox.sidebar_action).toMatchObject({
      default_panel: "panel.html",
      open_at_install: false,
    });
    expect(firefox.sidebar_action.default_icon).toEqual(chromeManifest.icons);
  });

  it("has no popup, so a click on the toolbar button reaches the extension's own handler", () => {
    expect(firefox.action.default_popup).toBeUndefined();
  });

  it("has a stable add-on id and declares that it collects no data", () => {
    const gecko = firefox.browser_specific_settings.gecko;
    expect(gecko.id).toMatch(/^[^@\s]+@[^@\s]+\.[^@\s]+$/);
    expect(gecko.data_collection_permissions).toEqual({ required: ["none"] });
    expect(Number.parseFloat(gecko.strict_min_version)).toBeGreaterThanOrEqual(140);
  });

  it("allows Firefox for Android from a stated version", () => {
    expect(Number.parseFloat(firefox.browser_specific_settings.gecko_android.strict_min_version)).toBeGreaterThanOrEqual(142);
  });

  it("keeps the content scripts, shortcuts, options page and the block page", () => {
    expect(firefox.content_scripts).toEqual(chromeManifest.content_scripts);
    expect(firefox.commands).toEqual(chromeManifest.commands);
    expect(firefox.options_ui).toEqual(chromeManifest.options_ui);
    expect(firefox.web_accessible_resources).toEqual(chromeManifest.web_accessible_resources);
  });

  it("does not change the Chrome manifest it was given", () => {
    const before = JSON.stringify(chromeManifest);
    toFirefoxManifest(chromeManifest);
    expect(JSON.stringify(chromeManifest)).toBe(before);
    expect((chromeManifest.background as Record<string, unknown>).service_worker).toBe("background.js");
  });

  it("refuses a manifest that is not Manifest V3 or has no service worker to convert", () => {
    expect(() => toFirefoxManifest({ ...chromeManifest, manifest_version: 2 })).toThrow(/Manifest V3/);
    expect(() => toFirefoxManifest({ ...chromeManifest, background: {} })).toThrow(/service worker/);
  });
});
