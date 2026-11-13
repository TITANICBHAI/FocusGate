import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");
const manifest = JSON.parse(read("public/manifest.json")) as {
  icons: Record<string, string>;
  action: { default_icon: Record<string, string> };
};

describe("logo is declared everywhere the browser shows one", () => {
  it("has a real file for every manifest and toolbar icon size", () => {
    for (const size of ["16", "32", "48", "128"]) {
      expect(manifest.icons[size], `icons.${size}`).toBe(`icons/icon-${size}.png`);
      expect(manifest.action.default_icon[size], `action.${size}`).toBe(
        `icons/icon-${size}.png`,
      );
      expect(existsSync(`public/${manifest.icons[size]}`)).toBe(true);
    }
  });

  it("uses one 128px design for the in-app logo, the store icon and the manifest", () => {
    const manifest128 = readFileSync("public/icons/icon-128.png");
    expect(readFileSync("public/icon.png").equals(manifest128)).toBe(true);
    expect(readFileSync("store-assets/icon-128.png").equals(manifest128)).toBe(true);
    expect(
      readFileSync("store-assets/marketplace/icon-128.png").equals(manifest128),
    ).toBe(true);
  });

  it.each(["panel", "dashboard", "onboarding", "blocked"])(
    "gives the %s page a tab icon",
    (page) => {
      expect(read(`src/ui/${page}.html`)).toContain(
        '<link rel="icon" type="image/png" href="/icon.png" />',
      );
    },
  );
});
