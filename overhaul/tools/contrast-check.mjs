// FocusGate colour tokens: the values to paste into src/ui/styles.css, checked the way the repo's own test checks them.
//
//   node tools/contrast-check.mjs          prints every pair and exits 1 if any pair misses its target
//   node tools/contrast-check.mjs --css    prints the colour lines for the four token blocks of src/ui/styles.css
//
// This file is the source of truth for the palette in DESIGN.md. If you change a value here, change DESIGN.md too.
// It mirrors tests/ui/themeTokens.test.ts: text, text-muted, text-subtle, accent, danger, warning and info
// must reach 4.5:1 on bg, surface AND surface-2, and accent-contrast must reach 4.5:1 on accent.
// Run it with plain node. No packages are needed.
const dark = {
  bg: '#0F1420', surface: '#151C2B', 'surface-2': '#1D2638', border: '#2A3550',
  text: '#E9EDF6', 'text-muted': '#9AA6BD', 'text-subtle': '#8C98B0',
  accent: '#7C83FF', 'accent-contrast': '#0F1420',
  break: '#4BD6A0',
  danger: '#FF7B7B', 'danger-contrast': '#2A0708',
  warning: '#FFB23E', 'warning-contrast': '#2B1B00',
  info: '#5CC8E8',
};
const light = {
  bg: '#F6F7FB', surface: '#FFFFFF', 'surface-2': '#ECEFF6', border: '#C9D0E0',
  text: '#131A2B', 'text-muted': '#52607A', 'text-subtle': '#5B6882',
  accent: '#4349C9', 'accent-contrast': '#FFFFFF',
  break: '#0B7A53',
  danger: '#B42318', 'danger-contrast': '#FFFFFF',
  warning: '#9A5800', 'warning-contrast': '#FFFFFF',
  info: '#0A6B8A',
};
const SHADOW = { dark: 'rgba(0, 0, 0, 0.35)', light: 'rgba(19, 26, 43, 0.14)' };
const SCRIM = { dark: 'rgba(0, 0, 0, 0.45)', light: 'rgba(19, 26, 43, 0.32)' };

const BGS = ['bg', 'surface', 'surface-2'];
const pairs = [];
for (const fg of ['text', 'text-muted', 'text-subtle', 'accent', 'danger', 'warning', 'info']) for (const bg of BGS) pairs.push([fg, bg, 4.5, 'repo test']);
pairs.push(['accent-contrast', 'accent', 4.5, 'repo test: label on the primary button']);
pairs.push(['danger-contrast', 'danger', 4.5, 'label on a danger button']);
pairs.push(['warning-contrast', 'warning', 4.5, 'label on an amber chip or bar']);
pairs.push(['break', 'surface', 4.5, 'green text on a panel']);
pairs.push(['break', 'surface-2', 4.5, 'green text on a raised row']);
pairs.push(['accent', 'surface', 3, 'accent bar or focus ring against the panel (UI component, WCAG 1.4.11)']);
pairs.push(['warning', 'surface', 3, 'amber status bar against the panel (UI component, WCAG 1.4.11)']);
pairs.push(['border', 'bg', 1.2, 'hairline against the page (decorative, no WCAG minimum)']);

const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const lum = (hex) => { const n = parseInt(hex.slice(1), 16); return 0.2126 * lin(n >> 16) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255); };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

if (process.argv.includes('--css')) {
  const order = ['bg', 'surface', 'surface-2', 'border', 'text', 'text-muted', 'text-subtle', 'accent', 'accent-contrast', 'break', 'danger', 'danger-contrast', 'warning', 'warning-contrast', 'info'];
  const lines = (pal, name, indent) => order.map((k) => `${indent}--${k}: ${pal[k].toLowerCase()};`).concat([`${indent}--shadow-pop: 0 8px 24px ${SHADOW[name]};`, `${indent}--scrim: ${SCRIM[name]};`]);
  console.log('/* dark: :root, :root[data-theme="dark"]  AND  :root[data-theme="system"] (system has no shadow/scrim lines) */');
  console.log(lines(dark, 'dark', '  ').join('\n'));
  console.log('\n/* light: :root[data-theme="light"]  AND  the @media (prefers-color-scheme: light) :root[data-theme="system"] block */');
  console.log(lines(light, 'light', '  ').join('\n'));
  process.exit(0);
}

let bad = 0;
for (const [name, pal] of [['dark', dark], ['light', light]]) {
  console.log(`\n${name}`);
  for (const [fg, bg, min, what] of pairs) {
    const r = ratio(pal[fg], pal[bg]); const ok = r >= min; if (!ok) bad++;
    console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${r.toFixed(2).padStart(5)}  (need ${min})  ${fg} ${pal[fg]} on ${bg} ${pal[bg]}  - ${what}`);
  }
}
console.log(bad ? `\n${bad} pair(s) below target` : '\nall pairs meet their target');
process.exit(bad ? 1 : 0);
