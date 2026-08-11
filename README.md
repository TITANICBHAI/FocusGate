# FocusGate

FocusGate is a Manifest V3 browser extension for blocking distracting websites,
filtering content by keyword, managing focus sessions, and tracking local focus
statistics.

The extension is built with React, TypeScript, and Vite. The compiled extension
is the contents of `dist/`; the packaged ZIP is written to
`build/focusgate-extension.zip`.

## Build locally

Requirements:

- Node.js 20+ or Bun
- The `zip` command (available by default on GitHub's Ubuntu runners)

Install dependencies and create the extension ZIP:

```bash
bun install
bun run build:extension
bun run package:extension
```

With npm, the equivalent commands are:

```bash
npm install
npm run build:extension
npm run package:extension
```

The ZIP is ready to load after extraction because `manifest.json` is at the
archive root. Do not upload the repository ZIP or the `dist` folder wrapped in
another parent folder.

## GitHub Actions build

The workflow at
[`.github/workflows/build-extension.yml`](.github/workflows/build-extension.yml)
runs on pushes to `main` or `master`, pull requests, version tags beginning
with `v`, and manual dispatches.

To download a build:

1. Open the repository's **Actions** tab.
2. Select **Build browser extension** and open a completed run.
3. Download the `focusgate-extension-...` artifact.
4. Extract the downloaded artifact. The extracted
   `focusgate-extension.zip` is the browser extension package.

For a permanent, named download, create a Git tag such as `v1.0.0`. The
workflow will still upload the ZIP as a workflow artifact; a GitHub Release
can then be created from that tag and the ZIP attached to it.

## Install an unpacked build

### Chrome or Edge

1. Extract `focusgate-extension.zip` to a permanent folder.
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

The Gemini API key described in `.env.example` is not required for the
extension packaging workflow unless the application code is changed to use
that API at build time.