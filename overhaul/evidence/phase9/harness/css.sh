#!/bin/bash
# Rebuild only the stylesheet of the harness from the repo.
S=/tmp/claude-0/-home-claude/1d3d810c-0866-503f-8b36-d437fcdf9427/scratchpad/store
sed 's#@import "tailwindcss";#*, *::before, *::after { box-sizing: border-box; border: 0 solid; } body { margin: 0; } button, input, select, textarea { font: inherit; color: inherit; background-color: transparent; border-radius: 0; }#' /home/claude/work/focusgate/src/ui/styles.css > $S/styles.css
