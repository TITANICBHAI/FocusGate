#!/usr/bin/env node
"use strict";
/*
 * Writes the GitHub release page for a version: banner, store buttons, what's new, Chrome install steps,
 * files, and the full changelog tucked into a collapsible block.
 *
 *   node scripts/release-notes.cjs                     version from package.json, print to the screen
 *   node scripts/release-notes.cjs --tag v1.0.2 --out notes.md
 *   node scripts/release-notes.cjs --repo OWNER/NAME   (default: $GITHUB_REPOSITORY, then TITANICBHAI/FocusGate)
 *
 * "What's new" comes from release-notes/<version>.md when it exists (see release-notes/README.md),
 * otherwise from the first sentence of each paragraph in that version's CHANGELOG.md section.
 */

const { readFileSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");
const lib = require("./release-lib.cjs");

const FLAGS = ["--version", "--tag", "--repo", "--out", "--changelog", "--notes-dir"];

function parseArgs(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!FLAGS.includes(arg)) throw new Error(`Unknown option ${arg}. See the comment at the top of scripts/release-notes.cjs.`);
    const value = argv[i + 1];
    if (value === undefined || value.startsWith("--")) throw new Error(`${arg} needs a value.`);
    options[arg.slice(2)] = value;
    i += 1;
  }
  return options;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const root = process.cwd();
  const tag = options.tag;
  const version =
    options.version || (tag ? tag.replace(/^v/, "") : JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version);
  const notes = lib.loadReleaseNotes({
    root,
    version,
    tag: tag || `v${version}`,
    repo: options.repo || process.env.GITHUB_REPOSITORY || lib.DEFAULT_REPO,
    changelogPath: options.changelog,
    notesDir: options["notes-dir"],
  });
  if (options.out) {
    writeFileSync(options.out, notes);
    console.log(`Release notes for ${version}: ${options.out}`);
  } else {
    process.stdout.write(notes);
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
