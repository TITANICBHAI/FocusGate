import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import releaseLib from "../../scripts/release-lib.cjs";

const lib = releaseLib as {
  RELEASE_ASSETS: string[];
  STORE_LINKS: { firefox: string; edge: string };
  parseHighlightsFile(text: string): { tagline: string; highlights: string };
  firstSentence(paragraph: string, max?: number): string;
  deriveHighlights(changelogNotes: string): string;
  buildReleaseNotes(input: {
    version: string;
    tag: string;
    repo?: string;
    tagline?: string;
    highlights?: string;
    changelogNotes: string;
  }): string;
  loadReleaseNotes(input: { root: string; version: string; tag: string; repo?: string; changelogPath?: string; notesDir?: string }): string;
  extractReleaseNotes(changelog: string, version: string): string;
  findBrowserZips(dir: string): Record<"chrome" | "edge" | "firefox", string>;
  manifestProblems(manifest: Record<string, unknown>, browser: string, version: string): string[];
};

const CHANGELOG = `# Changelog

## [1.0.1] - 2026-11-06

First paragraph of 1.0.1.

Second paragraph.

## [1.1.0] - 2026-10-31

Older release text.

### Added

- Something.
`;

describe("the release notes", () => {
  it("are the changelog section for that version, without its heading", () => {
    expect(lib.extractReleaseNotes(CHANGELOG, "1.0.1")).toBe("First paragraph of 1.0.1.\n\nSecond paragraph.");
  });

  it("keep sub-headings of the last section", () => {
    const notes = lib.extractReleaseNotes(CHANGELOG, "1.1.0");
    expect(notes.startsWith("Older release text.")).toBe(true);
    expect(notes).toContain("### Added");
    expect(notes).toContain("- Something.");
  });

  it("are refused when the version is not in the changelog or its section is empty", () => {
    expect(() => lib.extractReleaseNotes(CHANGELOG, "9.9.9")).toThrow(/9\.9\.9/);
    expect(() => lib.extractReleaseNotes("## [2.0.0] - 2026-01-01\n\n## [1.0.0] - 2025-01-01\n\ntext", "2.0.0")).toThrow(/empty/i);
  });
});

describe("the release page", () => {
  const page = lib.buildReleaseNotes({
    version: "2.0.0",
    tag: "v2.0.0",
    repo: "me/focus",
    tagline: "Sharper than ever.",
    highlights: "- **One.** First thing.\n- **Two.** Second thing.",
    changelogNotes: "Long paragraph one.\n\nLong paragraph two.",
  });

  it("opens with the banner, the version, the tagline and the three get-it buttons", () => {
    expect(page).toContain("raw.githubusercontent.com/me/focus/v2.0.0/store-assets/marketplace/promo-marquee-1400x560.png");
    expect(page).toContain("<h1 align=\"center\">FocusGate 2.0.0</h1>");
    expect(page).toContain("Sharper than ever.");
    expect(page).toContain(`href="${lib.STORE_LINKS.firefox}"`);
    expect(page).toContain(`href="${lib.STORE_LINKS.edge}"`);
    expect(page).toContain("https://github.com/me/focus/releases/download/v2.0.0/focusgate-chrome.zip");
  });

  it("shows the highlights as the what's new list and tucks the full changelog into a collapsed block", () => {
    expect(page).toContain("## What's new\n\n- **One.** First thing.\n- **Two.** Second thing.");
    const details = page.slice(page.indexOf("<details>"), page.indexOf("</details>"));
    expect(details).toContain("Long paragraph one.");
    expect(page.slice(0, page.indexOf("<details>"))).not.toContain("Long paragraph one.");
  });

  it("explains the Chrome install and names the three files", () => {
    expect(page).toContain("chrome://extensions");
    expect(page).toContain("Load unpacked");
    for (const name of lib.RELEASE_ASSETS) expect(page).toContain(name);
  });

  it("falls back to the first sentence of each changelog paragraph when there is no highlights file", () => {
    const fallback = lib.buildReleaseNotes({ version: "2.0.0", tag: "v2.0.0", changelogNotes: "Alpha is new. More about alpha.\n\nBeta changed! Details.\n\n- a list item\n\n### Heading" });
    expect(fallback).toContain("## What's new\n\n- Alpha is new.\n- Beta changed!\n\n");
    expect(fallback).not.toContain("- a list item\n\n|");
  });

  it("cuts a very long first sentence at a word", () => {
    const long = `${"word ".repeat(60).trim()}.`;
    const cut = lib.firstSentence(long, 40);
    expect(cut.length).toBeLessThanOrEqual(40);
    expect(cut.endsWith("…")).toBe(true);
    expect(cut).not.toMatch(/wor…$/);
  });

  it("reads a highlights file with a tagline in its front matter", () => {
    expect(lib.parseHighlightsFile("---\ntagline: Hello there.\n---\n- **A.** b.\n")).toEqual({ tagline: "Hello there.", highlights: "- **A.** b." });
    expect(lib.parseHighlightsFile("- just bullets")).toEqual({ tagline: "", highlights: "- just bullets" });
  });

  it("is built for this repository's current version from its own highlights file", () => {
    const version = (JSON.parse(readFileSync("package.json", "utf8")) as { version: string }).version;
    const real = lib.loadReleaseNotes({ root: process.cwd(), version, tag: `v${version}` });
    expect(real).toContain(`FocusGate ${version}`);
    expect(real).toContain("## What's new");
    expect(real).toContain("Firefox 140+");
    expect(real).toContain("Chrome 116+");
    // Curated, not pasted: the bullets are short.
    const list = real.slice(real.indexOf("## What's new"), real.indexOf("| | |")).split("\n").filter((line) => line.startsWith("- "));
    expect(list.length).toBeGreaterThanOrEqual(3);
    for (const line of list) expect(line.length).toBeLessThan(260);
  });
});

describe("the three browser files", () => {
  it("are named as they are on the release page", () => {
    expect(lib.RELEASE_ASSETS).toEqual(["focusgate-chrome.zip", "focusgate-edge.zip", "focusgate-firefox.zip"]);
  });

  it("are checked against the manifest: version, Manifest V3, and the Firefox-only rules", () => {
    const chrome = { manifest_version: 3, version: "1.0.1", icons: { "128": "i.png" }, background: { service_worker: "background.js" } };
    expect(lib.manifestProblems(chrome, "chrome", "1.0.1")).toEqual([]);
    expect(lib.manifestProblems(chrome, "chrome", "1.0.2")[0]).toMatch(/1\.0\.1/);
    expect(lib.manifestProblems({ ...chrome, manifest_version: 2 }, "edge", "1.0.1").join(" ")).toMatch(/Manifest V3/);
    expect(lib.manifestProblems(chrome, "firefox", "1.0.1").join(" ")).toMatch(/service_worker/);
    const firefox = {
      manifest_version: 3,
      version: "1.0.1",
      icons: { "128": "i.png" },
      background: { scripts: ["background.js"] },
      browser_specific_settings: { gecko: { id: "a@b.c", data_collection_permissions: { required: ["none"] } } },
    };
    expect(lib.manifestProblems(firefox, "firefox", "1.0.1")).toEqual([]);
  });
});

function hasTool(name: string): boolean {
  return spawnSync(name, ["-v"], { stdio: "ignore" }).error === undefined;
}

/** The end-to-end cases write a shell script and need zip and unzip, so they run on Linux and macOS only. */
const canRunEndToEnd = process.platform !== "win32" && hasTool("zip") && hasTool("unzip");
const describeEndToEnd = canRunEndToEnd ? describe : describe.skip;

/** A stand-in for the GitHub command line that records what it was asked and makes real zip files. */
function fakeGh(dir: string, options: { releaseExists: boolean; version?: string }) {
  const log = join(dir, "gh-calls.txt");
  const script = join(dir, "gh");
  const version = options.version ?? "1.0.1";
  writeFileSync(
    script,
    `#!/bin/bash
echo "$@" >> "${log}"
case "$1 $2" in
  "repo view") echo "owner/focusgate" ;;
  "run list") echo '[{"databaseId":4242,"headSha":"abc123"}]' ;;
  "run download")
    out=""; while [ $# -gt 0 ]; do [ "$1" = "-D" ] && out="$2"; shift; done
    for b in chrome edge firefox; do
      d="$out/focusgate-$b-abc123"; mkdir -p "$d/stage"
      if [ $b = firefox ]; then
        echo '{"manifest_version":3,"version":"${version}","icons":{"128":"i.png"},"background":{"scripts":["background.js"]},"browser_specific_settings":{"gecko":{"id":"a@b.c","data_collection_permissions":{"required":["none"]}}}}' > "$d/stage/manifest.json"
      else
        echo '{"manifest_version":3,"version":"${version}","icons":{"128":"i.png"},"background":{"service_worker":"background.js"}}' > "$d/stage/manifest.json"
      fi
      (cd "$d/stage" && zip -q "../focusgate-$b.zip" manifest.json) && rm -rf "$d/stage"
    done ;;
  "release view") ${options.releaseExists ? "exit 0" : "exit 1"} ;;
  *) ;;
esac
`,
  );
  chmodSync(script, 0o755);
  return { script, log };
}

function runRelease(args: string[], gh: string, cwd: string) {
  return spawnSync("node", [join(process.cwd(), "scripts/github-release.cjs"), "--gh", gh, "--out", join(cwd, "out"), ...args], {
    cwd,
    encoding: "utf8",
  });
}

function workspace(): string {
  const dir = mkdtempSync(join(tmpdir(), "fg-release-"));
  mkdirSync(join(dir, "out"), { recursive: true });
  writeFileSync(join(dir, "CHANGELOG.md"), CHANGELOG);
  return dir;
}

describeEndToEnd("the release script, with a stand-in for GitHub", () => {
  it("makes the notes, downloads the latest build, extracts it, names the three files and creates the release", () => {
    const dir = workspace();
    const gh = fakeGh(dir, { releaseExists: false });
    const result = runRelease(["--version", "1.0.1", "--changelog", join(dir, "CHANGELOG.md")], gh.script, dir);
    expect(result.status, result.stderr + result.stdout).toBe(0);
    for (const name of ["focusgate-chrome.zip", "focusgate-edge.zip", "focusgate-firefox.zip"]) {
      expect(existsSync(join(dir, "out", "assets", name))).toBe(true);
      expect(execFileSync("unzip", ["-tq", join(dir, "out", "assets", name)], { encoding: "utf8" })).toContain("No errors");
    }
    const notes = readFileSync(join(dir, "out", "notes.md"), "utf8");
    expect(notes).toContain("FocusGate 1.0.1");
    expect(notes).toContain("- First paragraph of 1.0.1.");
    expect(notes).toContain("<details>");
    expect(notes).toContain("Second paragraph.");
    const calls = readFileSync(gh.log, "utf8");
    expect(calls).toMatch(/run list .*build-extension\.yml/);
    expect(calls).toMatch(/run download 4242/);
    const create = calls.split("\n").find((line) => line.startsWith("release create"));
    expect(create).toContain("v1.0.1");
    expect(create).toContain("--notes-file");
    expect(create).toContain("--target abc123");
    expect(create).toContain("focusgate-edge.zip");
    expect(create).not.toContain("--draft");
  });

  it("uploads to a release that already exists, replacing the files and the notes", () => {
    const dir = workspace();
    const gh = fakeGh(dir, { releaseExists: true });
    const result = runRelease(["--version", "1.0.1", "--changelog", join(dir, "CHANGELOG.md")], gh.script, dir);
    expect(result.status, result.stderr).toBe(0);
    const calls = readFileSync(gh.log, "utf8");
    expect(calls).toMatch(/release upload v1\.0\.1 .*--clobber/);
    expect(calls).toMatch(/release edit v1\.0\.1 .*--notes-file/);
    expect(calls).not.toMatch(/release create/);
  });

  it("with --dry-run does everything except publish", () => {
    const dir = workspace();
    const gh = fakeGh(dir, { releaseExists: false });
    const result = runRelease(["--version", "1.0.1", "--changelog", join(dir, "CHANGELOG.md"), "--dry-run"], gh.script, dir);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toMatch(/dry run/i);
    expect(existsSync(join(dir, "out", "assets", "focusgate-firefox.zip"))).toBe(true);
    expect(readFileSync(gh.log, "utf8")).not.toMatch(/release (create|upload|edit)/);
  });

  it("can make a draft", () => {
    const dir = workspace();
    const gh = fakeGh(dir, { releaseExists: false });
    runRelease(["--version", "1.0.1", "--changelog", join(dir, "CHANGELOG.md"), "--draft"], gh.script, dir);
    expect(readFileSync(gh.log, "utf8")).toMatch(/release create .*--draft/);
  });

  it("uses the run it is given instead of looking for the latest", () => {
    const dir = workspace();
    const gh = fakeGh(dir, { releaseExists: false });
    runRelease(["--version", "1.0.1", "--changelog", join(dir, "CHANGELOG.md"), "--run", "777", "--dry-run"], gh.script, dir);
    const calls = readFileSync(gh.log, "utf8");
    expect(calls).toMatch(/run download 777/);
    expect(calls).not.toMatch(/run list/);
  });

  it("stops before publishing when a file's version is not the release version", () => {
    const dir = workspace();
    const gh = fakeGh(dir, { releaseExists: false, version: "1.0.0" });
    const result = runRelease(["--version", "1.0.1", "--changelog", join(dir, "CHANGELOG.md")], gh.script, dir);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/1\.0\.0/);
    expect(readFileSync(gh.log, "utf8")).not.toMatch(/release (create|upload|edit)/);
  });

  it("stops when the changelog has no section for the version", () => {
    const dir = workspace();
    const gh = fakeGh(dir, { releaseExists: false });
    const result = runRelease(["--version", "3.0.0", "--changelog", join(dir, "CHANGELOG.md")], gh.script, dir);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/3\.0\.0/);
    expect(existsSync(gh.log) ? readFileSync(gh.log, "utf8") : "").not.toMatch(/run download/);
  });
});
