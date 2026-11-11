#!/bin/bash
# Bundle the real UI pages (src copied from the repo) with real Lucide icons, no network.
S=/tmp/claude-0/-home-claude/1d3d810c-0866-503f-8b36-d437fcdf9427/scratchpad/store
R=/home/claude/work/focusgate
cd $S && rm -rf src && cp -r $R/src src && mkdir -p public && cp $R/public/icon.png public/
E=/opt/npm-tools/node_modules/esbuild/bin/esbuild
export NODE_PATH=$(npm root -g)
for page in panel blocked onboarding dashboard; do
  main=$(ls src/ui/$page/main.tsx src/ui/$page/*main*.tsx 2>/dev/null | head -1)
  $E $main --bundle --format=iife --jsx=automatic --loader:.css=empty --define:import.meta.env.DEV=true --define:import.meta.env.PROD=false --define:import.meta.env.MODE='"development"' --alias:lucide-react=$S/lucide.js --outfile=$S/$page.js --log-level=warning || exit 1
done
sed 's#@import "tailwindcss";#*, *::before, *::after { box-sizing: border-box; border: 0 solid; } body { margin: 0; } button, input, select, textarea { font: inherit; color: inherit; background-color: transparent; border-radius: 0; }#' src/ui/styles.css > styles.css
ls -la *.js
