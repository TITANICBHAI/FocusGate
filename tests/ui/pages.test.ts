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

describe("staged UI page routing", () => {
  it.each([
    ["popup.html", "./popup/main.tsx"],
    ["blocked.html", "./blocked/main.tsx"],
    ["onboarding.html", "./onboarding/main.tsx"],
    ["dashboard.html", "./dashboard/main.tsx"],
  ])("%s has its own first-paint entrypoint", (page, entrypoint) => {
    const html = readFileSync(new URL(page, uiRoot), "utf8");
    expect(html).toContain(`src="${entrypoint}"`);
  });

  it("keeps staged routes out of the active v1 manifest", () => {
    expect(manifest.action?.default_popup).toBe("index.html");
    expect(manifest.options_ui?.page).not.toBe("dashboard.html");
    expect(
      manifest.web_accessible_resources?.some((resource) =>
        resource.resources?.includes("blocked.html"),
      ),
    ).toBeFalsy();
  });
});
