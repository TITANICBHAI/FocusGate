// Prints the contrast of every colour pair added in Phase 8, read from the real stylesheet.
// Run from the repo root: node overhaul/evidence/phase8/colour-report.mjs
import { readFileSync } from "node:fs";
const css = readFileSync("src/ui/styles.css", "utf8");
const blocks = (sel) => [...css.matchAll(new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*\\{([^{}]*)\\}", "g"))].map((m) => m[1]);
const toks = (b) => Object.fromEntries([...b.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)].map((m) => [m[1], m[2]]));
const themes = { light: toks(blocks(':root[data-theme="light"]')[0]), dark: toks(blocks(':root[data-theme="dark"]')[0]) };
const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const lum = (h) => { const n = parseInt(h.slice(1), 16); return 0.2126 * lin(n >> 16) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255); };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
let failures = 0;
const row = (label, value, min) => { const ok = value >= min; if (!ok) failures++; console.log(`  ${ok ? "ok  " : "FAIL"} ${label.padEnd(44)} ${value.toFixed(2)}:1  (needs ${min}:1)`); };
for (const [name, t] of Object.entries(themes)) {
  console.log(`\n${name} theme`);
  for (const wash of ["accent", "break", "warning", "danger"]) {
    for (const text of ["text", "text-muted", "text-subtle"]) row(`--${text} on --${wash}-soft`, ratio(t[text], t[`${wash}-soft`]), 4.5);
    row(`--${wash} on --${wash}-soft`, ratio(t[wash], t[`${wash}-soft`]), 4.5);
  }
  for (const text of ["text", "text-muted", "text-subtle", "accent", "danger", "warning", "break"]) for (const ground of ["bg", "surface", "surface-2"]) row(`--${text} on --${ground}`, ratio(t[text], t[ground]), 4.5);
  row("focus ring --accent on --accent-soft", ratio(t.accent, t["accent-soft"]), 3);
}
console.log(failures ? `\n${failures} pairs below their target` : "\nall Phase 8 pairs meet their target");
process.exit(failures ? 1 : 0);
