"use strict";
// Pure helpers for scripts/github-release.cjs. No network, no GitHub calls.

const { execFileSync } = require("node:child_process");
const { existsSync, readFileSync, readdirSync, statSync } = require("node:fs");
const { join, resolve } = require("node:path");

const BROWSERS = ["chrome", "edge", "firefox"];
const RELEASE_ASSETS = BROWSERS.map((browser) => `focusgate-${browser}.zip`);

/** The text under `## [version]` in the changelog, up to the next `## [` heading. */
function extractReleaseNotes(changelog, version) {
  const lines = changelog.replace(/\r\n/g, "\n").split("\n");
  const heading = `## [${version}]`;
  const start = lines.findIndex((line) => line.startsWith(heading));
  if (start === -1) throw new Error(`CHANGELOG.md has no section for ${version}.`);
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    if (lines[i].startsWith("## [")) {
      end = i;
      break;
    }
  }
  const notes = lines.slice(start + 1, end).join("\n").trim();
  if (!notes) throw new Error(`The CHANGELOG.md section for ${version} is empty.`);
  return notes;
}

function walk(dir) {
  const found = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) found.push(...walk(full));
    else found.push(full);
  }
  return found;
}

/** Finds focusgate-<browser>.zip anywhere under a downloaded run, exactly once each. */
function findBrowserZips(dir) {
  const files = walk(dir);
  const result = {};
  for (const browser of BROWSERS) {
    const name = `focusgate-${browser}.zip`;
    const matches = files.filter((file) => file.endsWith(`/${name}`));
    if (matches.length === 0) throw new Error(`The build has no ${name}.`);
    if (matches.length > 1) throw new Error(`The build has ${matches.length} copies of ${name}.`);
    result[browser] = matches[0];
  }
  return result;
}

/** Reasons a browser's manifest is not fit to release. Empty means fine. */
function manifestProblems(manifest, browser, version) {
  const problems = [];
  if (manifest.manifest_version !== 3) problems.push("not Manifest V3");
  if (manifest.version !== version) problems.push(`manifest version ${String(manifest.version)}, expected ${version}`);
  if (!manifest.icons) problems.push("no icons");
  const background = manifest.background || {};
  if (browser === "firefox") {
    if (background.service_worker) problems.push("background.service_worker is not allowed in Firefox, use background.scripts");
    if (!Array.isArray(background.scripts) || background.scripts.length === 0) problems.push("no background.scripts");
    const gecko = (manifest.browser_specific_settings || {}).gecko || {};
    if (!gecko.id) problems.push("no browser_specific_settings.gecko.id");
    if (!gecko.data_collection_permissions) problems.push("no gecko.data_collection_permissions");
  } else if (!background.service_worker) {
    problems.push("no background.service_worker");
  }
  return problems;
}

/** Reads manifest.json from the root of a zip using the system unzip. */
function readZipManifest(zipPath) {
  execFileSync("unzip", ["-tq", zipPath], { stdio: "pipe" });
  return JSON.parse(execFileSync("unzip", ["-p", zipPath, "manifest.json"], { encoding: "utf8" }));
}

const DEFAULT_REPO = "TITANICBHAI/FocusGate";
const STORE_LINKS = {
  firefox: "https://addons.mozilla.org/en-US/firefox/addon/focusgate-web/",
  edge: "https://microsoftedge.microsoft.com/addons/detail/mmjhejklaaljidnmabjiloceniacihkk",
};
const DEFAULT_TAGLINE = "Website blocker and focus timer for Chrome, Edge and Firefox.";

/**
 * A curated highlights file (release-notes/<version>.md): an optional `tagline:` line in a front-matter
 * block, then the bullet list shown under "What's new". Returns { tagline, highlights }.
 */
function parseHighlightsFile(text) {
  let body = text.replace(/\r\n/g, "\n").trim();
  let tagline = "";
  const front = /^---\n([\s\S]*?)\n---\n?/.exec(body);
  if (front) {
    body = body.slice(front[0].length).trim();
    for (const line of front[1].split("\n")) {
      const match = /^tagline:\s*(.+)$/.exec(line.trim());
      if (match) tagline = match[1].trim();
    }
  }
  return { tagline, highlights: body };
}

/** First sentence of a paragraph, cut at a word boundary when it is longer than `max`. */
function firstSentence(paragraph, max = 140) {
  const flat = paragraph.replace(/\s+/g, " ").trim();
  const match = /^(.+?[.!?])(\s|$)/.exec(flat);
  const sentence = match ? match[1] : flat;
  if (sentence.length <= max) return sentence;
  const cut = sentence.slice(0, max - 1);
  return `${cut.slice(0, cut.lastIndexOf(" ")).replace(/[,;:\s]+$/, "")}…`;
}

/** Fallback when there is no curated file: one bullet per changelog paragraph, using its first sentence. */
function deriveHighlights(changelogNotes) {
  return changelogNotes
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph && !/^(#|[-*] |\d+\. |\||```)/.test(paragraph))
    .map((paragraph) => `- ${firstSentence(paragraph)}`)
    .join("\n");
}

/**
 * The GitHub release page: a banner, the three ways to get FocusGate, what is new, Chrome install steps,
 * the files, and the full changelog tucked away. Pure: every input is a parameter.
 */
function buildReleaseNotes({ version, tag, repo = DEFAULT_REPO, tagline, highlights, changelogNotes, minChrome = "116", minFirefox = "140", minFirefoxAndroid = "142" }) {
  const github = `https://github.com/${repo}`;
  const raw = (path) => `https://raw.githubusercontent.com/${repo}/${tag}/${path}`;
  const file = (name) => `${github}/releases/download/${tag}/${name}`;
  const shot = (name, alt) => `<img src="${raw(`store-assets/marketplace/screenshots/${name}`)}" alt="${alt}" width="100%">`;
  const bullets = (highlights && highlights.trim()) || deriveHighlights(changelogNotes);
  return `<p align="center">
  <img src="${raw("store-assets/marketplace/promo-marquee-1400x560.png")}" alt="FocusGate: Website Blocker &amp; Focus Timer" width="100%">
</p>

<h1 align="center">FocusGate ${version}</h1>

<p align="center">
  <b>${tagline || DEFAULT_TAGLINE}</b><br>
  Free &middot; Open source &middot; No account &middot; Your data stays in your browser
</p>

<p align="center">
  <a href="${STORE_LINKS.firefox}"><b>Add to Firefox</b></a> &nbsp;&middot;&nbsp;
  <a href="${STORE_LINKS.edge}"><b>Add to Edge</b></a> &nbsp;&middot;&nbsp;
  <a href="${file("focusgate-chrome.zip")}"><b>Download for Chrome</b></a>
</p>

## What's new

${bullets}

| | |
|---|---|
| ${shot("02-focus-session.png", "Start a focus session in one click")} | ${shot("01-dashboard-overview.png", "See your focus at a glance")} |
| <sub>Start a focus session in one click</sub> | <sub>See your focus at a glance</sub> |

## Get FocusGate

| Browser | Get it | Needs |
|---|---|---|
| **Firefox** | [Add to Firefox](${STORE_LINKS.firefox}) | Firefox ${minFirefox}+ (Android ${minFirefoxAndroid}+) |
| **Microsoft Edge** | [Add to Edge](${STORE_LINKS.edge}) | Microsoft Edge |
| **Chrome** | [Download focusgate-chrome.zip](${file("focusgate-chrome.zip")}) | Chrome ${minChrome}+ |

Firefox and Edge install from their official stores and update themselves. FocusGate is not on the Chrome Web Store, so Chrome installs from this release.

### Install on Chrome in a minute

1. Download **focusgate-chrome.zip** above and extract it to a folder you will keep.
2. Open \`chrome://extensions\` and turn on **Developer mode**.
3. Choose **Load unpacked** and select the folder that contains \`manifest.json\`.
4. Pin FocusGate and click its icon to open the side panel.

> Keep the folder where it is: Chrome runs the extension from it. Export a backup in Settings before you move it or load it from a new place.

## Files in this release

| File | For |
|---|---|
| \`focusgate-chrome.zip\` | Chrome: load unpacked |
| \`focusgate-edge.zip\` | Microsoft Edge, also on Edge Add-ons |
| \`focusgate-firefox.zip\` | Firefox, also on Firefox Add-ons. This file loads only as a temporary add-on, so most people should use the store |

<details>
<summary><b>Everything in ${version}</b></summary>

${changelogNotes}

</details>

---

<p align="center">
  <a href="${github}/blob/${tag}/CHANGELOG.md">Full changelog</a> &middot;
  <a href="${github}/issues">Report an issue</a> &middot;
  <a href="${github}">Source code</a> &middot;
  MIT licence
</p>
`;
}

/** Reads the changelog section, the optional curated highlights and the manifests, then builds the release page. */
function loadReleaseNotes({ root, version, tag, repo, changelogPath, notesDir }) {
  const changelog = readFileSync(resolve(changelogPath || join(root, "CHANGELOG.md")), "utf8");
  const changelogNotes = extractReleaseNotes(changelog, version);
  const curatedPath = join(resolve(notesDir || join(root, "release-notes")), `${version}.md`);
  const curated = existsSync(curatedPath) ? parseHighlightsFile(readFileSync(curatedPath, "utf8")) : { tagline: "", highlights: "" };
  const mins = {};
  try {
    const shared = JSON.parse(readFileSync(join(root, "public", "manifest.json"), "utf8"));
    if (shared.minimum_chrome_version) mins.minChrome = String(shared.minimum_chrome_version);
    const { toFirefoxManifest } = require("./firefox-manifest.cjs");
    const settings = toFirefoxManifest(shared).browser_specific_settings;
    mins.minFirefox = String(settings.gecko.strict_min_version).replace(/\.0$/, "");
    mins.minFirefoxAndroid = String(settings.gecko_android.strict_min_version).replace(/\.0$/, "");
  } catch {
    // Not run from a checkout (a test, say): the defaults in buildReleaseNotes apply.
  }
  return buildReleaseNotes({ version, tag, repo, tagline: curated.tagline, highlights: curated.highlights, changelogNotes, ...mins });
}

module.exports = {
  BROWSERS, DEFAULT_REPO, RELEASE_ASSETS, STORE_LINKS,
  buildReleaseNotes, deriveHighlights, extractReleaseNotes, findBrowserZips, firstSentence, loadReleaseNotes,
  manifestProblems, parseHighlightsFile, readZipManifest,
};
