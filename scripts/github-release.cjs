#!/usr/bin/env node
"use strict";
/*
 * Publishes a GitHub release from a finished CI build.
 *
 *   node scripts/github-release.cjs                      latest successful build -> release v<package version>
 *   node scripts/github-release.cjs --run 123456789      use that workflow run
 *   node scripts/github-release.cjs --dry-run            do everything except publish
 *
 * Steps: the release page (see scripts/release-notes.cjs) -> download the build's artifacts with `gh` ->
 * find focusgate-chrome/edge/firefox.zip -> check each (zip test, manifest version, Firefox rules) ->
 * copy them under their release names -> create the release, or replace files and notes if it exists.
 * Needs the GitHub CLI (`gh`), signed in. No other dependencies.
 */

const { spawnSync } = require("node:child_process");
const { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } = require("node:fs");
const { join, resolve } = require("node:path");
const lib = require("./release-lib.cjs");

const WORKFLOW = "build-extension.yml";
const FLAGS_WITH_VALUE = ["--gh", "--out", "--version", "--tag", "--repo", "--run", "--changelog", "--notes-dir", "--workflow"];

function parseArgs(argv) {
  const options = { draft: false, dryRun: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--draft") options.draft = true;
    else if (arg === "--dry-run") options.dryRun = true;
    else if (FLAGS_WITH_VALUE.includes(arg)) {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith("--")) throw new Error(`${arg} needs a value.`);
      options[arg.slice(2)] = value;
      i += 1;
    } else throw new Error(`Unknown option ${arg}. See the comment at the top of scripts/github-release.cjs.`);
  }
  return options;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const root = process.cwd();
  const gh = options.gh || "gh";
  const version = options.version || JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version;
  const tag = options.tag || `v${version}`;
  const out = resolve(options.out || join(root, "build", "release"));
  const repoArgs = options.repo ? ["--repo", options.repo] : [];

  function runGh(args, { allowFailure = false } = {}) {
    const result = spawnSync(gh, [...args, ...repoArgs], { encoding: "utf8" });
    if (result.error) throw new Error(`Could not run "${gh}": ${result.error.message}. Install the GitHub CLI and sign in with gh auth login.`);
    if (result.status !== 0 && !allowFailure) throw new Error(`gh ${args.slice(0, 2).join(" ")} failed: ${(result.stderr || result.stdout).trim()}`);
    return result;
  }

  // 1. The release page first, so a missing changelog section stops everything before any download.
  const notes = lib.loadReleaseNotes({
    root,
    version,
    tag,
    repo: options.repo || process.env.GITHUB_REPOSITORY || lib.DEFAULT_REPO,
    changelogPath: options.changelog,
    notesDir: options["notes-dir"],
  });
  rmSync(out, { recursive: true, force: true });
  mkdirSync(join(out, "assets"), { recursive: true });
  const notesFile = join(out, "notes.md");
  writeFileSync(notesFile, notes);
  console.log(`Release notes for ${version}: ${notesFile}`);

  // 2. Which build.
  let runId = options.run;
  let sha;
  if (!runId) {
    const workflow = options.workflow || WORKFLOW;
    const list = (extra) =>
      JSON.parse(runGh(["run", "list", "--workflow", workflow, "--status", "success", "--limit", "1", "--json", "databaseId,headSha", ...extra]).stdout || "[]");
    let runs = list(["--branch", tag]);
    if (runs.length === 0) {
      console.log(`No successful ${workflow} run for ${tag}; using the latest successful run instead.`);
      runs = list([]);
    }
    if (runs.length === 0) throw new Error(`No successful ${workflow} run found. Push the tag or run the workflow first.`);
    runId = String(runs[0].databaseId);
    sha = runs[0].headSha;
  }
  console.log(`Build run: ${runId}`);

  // 3. Download and find the three zips.
  const download = join(out, "download");
  runGh(["run", "download", runId, "-D", download]);
  const zips = lib.findBrowserZips(download);

  // 4. Check every file before anything is published.
  const problems = [];
  for (const browser of lib.BROWSERS) {
    const name = `focusgate-${browser}.zip`;
    try {
      for (const problem of lib.manifestProblems(lib.readZipManifest(zips[browser]), browser, version)) problems.push(`${name}: ${problem}`);
    } catch (error) {
      problems.push(`${name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (problems.length > 0) throw new Error(`Not publishing, the build does not match ${version}:\n  ${problems.join("\n  ")}`);

  // 5. The files under the names the release page should show.
  const assets = lib.RELEASE_ASSETS.map((name, index) => {
    const target = join(out, "assets", name);
    copyFileSync(zips[lib.BROWSERS[index]], target);
    return target;
  });
  console.log(`Files ready in ${join(out, "assets")}:\n  ${lib.RELEASE_ASSETS.join("\n  ")}`);

  if (options.dryRun) {
    console.log(`Dry run: nothing was published. ${tag} is ready to publish.`);
    return;
  }

  // 6. Publish.
  const exists = runGh(["release", "view", tag], { allowFailure: true }).status === 0;
  if (exists) {
    runGh(["release", "upload", tag, ...assets, "--clobber"]);
    runGh(["release", "edit", tag, "--notes-file", notesFile]);
    console.log(`Updated release ${tag}: files replaced, notes refreshed.`);
  } else {
    const create = ["release", "create", tag, ...assets, "--title", `FocusGate ${tag}`, "--notes-file", notesFile];
    if (sha) create.push("--target", sha);
    if (options.draft) create.push("--draft");
    runGh(create);
    console.log(`Created release ${tag}${options.draft ? " as a draft" : ""}.`);
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
