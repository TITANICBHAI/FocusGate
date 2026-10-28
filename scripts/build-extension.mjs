import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build as esbuild } from "esbuild";
import { build as viteBuild } from "vite";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const dist = resolve(root, "dist");

await viteBuild({
  configFile: resolve(root, "vite.config.ts"),
  root,
  publicDir: resolve(root, "public"),
  base: "./",
  build: {
    outDir: dist,
    emptyOutDir: true,
  },
});

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

await esbuild({
  absWorkingDir: root,
  entryPoints: ["src/content/index.ts"],
  outfile: resolve(dist, "content.js"),
  bundle: true,
  platform: "browser",
  format: "iife",
  target: "chrome110",
  sourcemap: false,
});

// Stage the v2 content script without referencing it from the active manifest.
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
