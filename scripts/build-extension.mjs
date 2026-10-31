import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build as esbuild } from "esbuild";
import { build as viteBuild } from "vite";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const dist = resolve(root, "dist");

// WP5 cutover build: the v2 popup/blocked/onboarding/dashboard pages are the
// only UI; the Vite build also copies public/ (manifest, icons) into dist/.
await viteBuild({
  configFile: resolve(root, "vite.staged-ui.config.ts"),
});

// The v2 worker composition is the service worker (src/background/index.ts
// imports worker.ts via the chrome adapter at the cutover).
await esbuild({
  absWorkingDir: root,
  entryPoints: ["src/background/index.ts"],
  outfile: resolve(dist, "background.js"),
  bundle: true,
  platform: "browser",
  format: "esm",
  target: "chrome110",
  sourcemap: false,
});

// The v2 content script replaces the v1 content script (manifest
// content_scripts now reference content-v2.js).
await esbuild({
  absWorkingDir: root,
  entryPoints: ["src/content/v2-entry.ts"],
  outfile: resolve(dist, "content-v2.js"),
  bundle: true,
  platform: "browser",
  format: "iife",
  target: "chrome110",
  sourcemap: false,
  define: {
    "import.meta.env.DEV": "false",
  },
});
