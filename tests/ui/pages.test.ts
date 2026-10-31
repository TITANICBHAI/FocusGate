import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const uiRoot = new URL("../../src/ui/", import.meta.url);
const manifest = JSON.parse(
  readFileSync(new URL("../../public/manifest.json", import.meta.url), "utf8"),
) as {
  action?: { default_popup?: string };
  options_ui?: { page?: string };
  web_accessible_resources?: { resources?: string[] }[];
};

describe("cutover UI page routing", () => {
  it.each([
    ["popup.html", "./popup/main.tsx"],
    ["blocked.html", "./blocked/main.tsx"],
    ["onboarding.html", "./onboarding/main.tsx"],
    ["dashboard.html", "./dashboard/main.tsx"],
  ])("%s has its own first-paint entrypoint", (page, entrypoint) => {
    const html = readFileSync(new URL(page, uiRoot), "utf8");
    expect(html).toContain(`src="${entrypoint}"`);
  });

  it("routes the manifest to the v2 pages after the WP5 cutover", () => {
    expect(manifest.action?.default_popup).toBe("popup.html");
    expect(manifest.options_ui?.page).toBe("dashboard.html");
    expect(
      manifest.web_accessible_resources?.some((resource) =>
        resource.resources?.includes("blocked.html"),
      ),
    ).toBe(true);
  });

  it("keeps the worker and content entries on the v2 composition", () => {
    const background = readFileSync(
      new URL("../../src/background/index.ts", import.meta.url),
      "utf8",
    );
    expect(background).toContain("createChromeWorker");
    expect(background).not.toContain("public/background.js");

    const manifestSource = readFileSync(
      new URL("../../public/manifest.json", import.meta.url),
      "utf8",
    );
    expect(manifestSource).toContain("content-v2.js");
    expect(manifestSource).not.toContain('"content.js"');
  });
});
