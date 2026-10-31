import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const projectRoot = resolve(fileURLToPath(new URL(".", import.meta.url)));
const uiRoot = resolve(projectRoot, "src/ui");

// WP5 cutover: this is the only UI build. publicDir copies the manifest and
// icons to the dist root so the extension loads from a single folder.
export default defineConfig({
  root: uiRoot,
  base: "./",
  publicDir: resolve(projectRoot, "public"),
  plugins: [react(), tailwindcss()],
  build: {
    outDir: resolve(projectRoot, "dist"),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(uiRoot, "popup.html"),
        blocked: resolve(uiRoot, "blocked.html"),
        onboarding: resolve(uiRoot, "onboarding.html"),
        dashboard: resolve(uiRoot, "dashboard.html"),
      },
    },
  },
});
