"use strict";
// Pure helpers for scripts/github-release.cjs. No network, no GitHub calls.

const { execFileSync } = require("node:child_process");
const { readdirSync, statSync } = require("node:fs");
const { join } = require("node:path");

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

module.exports = { BROWSERS, RELEASE_ASSETS, extractReleaseNotes, findBrowserZips, manifestProblems, readZipManifest };
