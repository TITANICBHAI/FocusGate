# FocusGate

FocusGate is a Manifest V3 browser extension for blocking distracting websites,
filtering content by keyword, managing focus sessions, and tracking local focus
statistics.

The extension is built with React, TypeScript, and Vite. The compiled extension
is the contents of `dist/`; browser-specific packaged ZIPs are written to
`build/`.

## Build locally

Requirements:

- Node.js 20+ or Bun
- The `zip` command (available by default on GitHub's Ubuntu runners)

Install dependencies and create the extension ZIP:

```bash
bun install
bun run package:all
```

With npm, the equivalent commands are:

```bash
npm install
npm run package:all
```

The ZIP is ready to load after extraction because `manifest.json` is at the
archive root. Do not upload the repository ZIP or the `dist` folder wrapped in
another parent folder. `npm run package:all` also creates
`build/store-submission/`, containing all three browser packages, the MIT license,
listing copy, icon, and store screenshots.

## GitHub Actions build

The workflow at
[`.github/workflows/build-extension.yml`](.github/workflows/build-extension.yml)
runs on pushes to `main` or `master`, pull requests, version tags beginning
with `v`, and manual dispatches.

Every Actions run uploads three separate browser artifacts:

1. Open the repository's **Actions** tab and select a completed build.
2. Download the `focusgate-chrome-...`, `focusgate-edge-...`, or
   `focusgate-firefox-...` artifact.
3. Extract that artifact to get its single browser-specific ZIP.

GitHub wraps Actions artifacts in a download ZIP; that wrapper cannot be
disabled. To download the browser ZIP itself without an extra wrapper, push a
version tag such as `v1.0.2`, then download the ZIP directly from the resulting
GitHub Release. The Firefox validation checks its Gecko ID, background scripts
fallback, and data-collection declaration.

## GitHub sync from Replit

The Replit project includes a `FocusGate GitHub Sync` one-shot workflow. It
commits tracked changes, pushes them to:

```text
https://github.com/TITANICBHAI/FocusGate
```

The sync workflow exits after pushing. GitHub Actions builds the extension
separately according to its configured triggers.

The workflow reads `GITHUB_PERSONAL_ACCESS_TOKEN` only from Replit Secrets.
The token is never stored in the repository or embedded in the Git remote URL.

Secrets do not travel with GitHub commits. After importing this project into a
different Replit account, add `GITHUB_PERSONAL_ACCESS_TOKEN` to that account's
Secrets again. The workflow definition itself is stored in `.replit`, so it
returns with the project import.

## Install an unpacked build

### Chrome or Edge

1. Extract the browser-specific ZIP to a permanent folder.
2. Open `chrome://extensions` or `edge://extensions`.
3. Enable **Developer mode**.
4. Choose **Load unpacked**.
5. Select the extracted folder containing `manifest.json`.

### Firefox

`npm run package:firefox` (after `npm run build:extension`) writes
`build/focusgate-firefox.zip` with a Firefox manifest: a background script
instead of a service worker, a sidebar instead of the Chrome side panel, and a
stable add-on ID. Firefox on Android has no sidebar, so the toolbar button opens
the panel in a tab, and features Android lacks (notifications, shortcuts, idle
detection) are skipped instead of failing.

Temporary testing: `about:debugging` → **This Firefox** → **Load Temporary
Add-on**, then select the extracted `manifest.json`. Firefox asks you to grant
site access in its Add-ons manager. This build has not been tested in a real
Firefox yet, so do not describe it as Firefox-supported until it has been.

### Making a GitHub release

After the "Build browser extension" workflow succeeds, run
`npm run release:github` (needs the GitHub CLI, signed in, and `unzip`). It reads the
release notes from the `## [version]` section of `CHANGELOG.md`, downloads the
build's artifacts, checks each zip, and publishes `focusgate-chrome.zip`,
`focusgate-edge.zip` and `focusgate-firefox.zip` on release `v<version>`.
Options: `--dry-run`, `--draft`, `--run <id>`, `--tag`, `--repo`. If the release
already exists, its files and notes are replaced.

See [`STORE_PUBLISHING.md`](STORE_PUBLISHING.md) before submitting to a store.
After the docs site is published, follow [`AFTER_PUBLISHING.md`](AFTER_PUBLISHING.md)
for the exact upload and post-approval checklist.

## Project layout

- `src/` — React popup application
- `public/manifest.json` — extension manifest
- `public/background.js` — background service worker
- `public/content.js` — page content script
- `public/icon.png` — extension icon
- `docs/` — static product and installation documentation
- `scripts/package-extension.cjs` — validates and creates the extension ZIP

## Privacy and permissions

FocusGate stores its settings and usage data in browser-local storage. The
current manifest requests broad page access and permissions needed for website
blocking, navigation handling, alarms, notifications, and storage. Review and
explain every permission in the relevant store listing before publishing.

## Development

Run the extension UI locally:

```bash
npm run dev
```

Run the documentation site:

```bash
npm run docs:dev
```
