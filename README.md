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

## GitHub sync and extension build watch from Replit

The Replit project includes a `FocusGate GitHub Sync` one-shot workflow. It
commits tracked changes, pushes them to:

```text
https://github.com/TITANICBHAI/FocusGate
```

It then watches the `Build browser extension` GitHub Actions workflow for that
commit. The Replit workflow exits after the GitHub build succeeds or fails; it
does not stay running or poll forever. Set
`GITHUB_ACTION_POLL_SECONDS` or `GITHUB_ACTION_TIMEOUT_SECONDS` if needed.

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

Firefox support is not automatically guaranteed by a Chromium Manifest V3
build. Firefox's extension APIs and store metadata differ in some areas.
Temporary testing is available from `about:debugging` → **This Firefox** →
**Load Temporary Add-on**, then select the extracted `manifest.json`.

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
