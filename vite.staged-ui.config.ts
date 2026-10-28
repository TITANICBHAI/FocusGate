import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const projectRoot = resolve(fileURLToPath(new URL(".", import.meta.url)));
const uiRoot = resolve(projectRoot, "src/ui");

export default defineConfig({
  root: uiRoot,
  base: "./",
  publicDir: false,
  plugins: [react(), tailwindcss()],
  build: {
    outDir: resolve(projectRoot, "dist/staged-ui"),
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
