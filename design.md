# FocusGate — UI Redesign, Complete Implementation Spec (v3)

> **For the implementing agent.** This document is the complete contract for
> rebuilding the FocusGate UI. It is written to be followed **literally, in
> phase order, with no invention**. If something is not specified here, do
> not decide it yourself — stop and ask the owner (see the Stop Rules in §0).
>
> **Read this entire file before writing any code.** Then work phase by phase
> (§10). After every phase: commit, push, wait for the GitHub Actions
> "Build browser extension" workflow to be green, append one line to
> `design-progress.md`, and only then start the next phase.
>
> **Scope:** UI only — `src/ui/`, `public/manifest.json`, the side-panel
> wiring in `src/background/`, the Firefox packaging script, and the tests
> listed in §9. Everything else is frozen (§0.3).

---

## 0. Rules for the implementing agent

These rules are mandatory. They exist because you will be working without
step-by-step supervision. Breaking any of them means stopping and reporting,
not improvising.

### 0.1 Working rules

1. **Follow this document exactly.** Where it gives code or CSS, paste it
   (adapting only import paths). Where it gives a list, the list is complete.
   Do not add features, screens, strings, or files that are not specified.
2. **Work alone.** Do not create, invoke, or delegate to sub-agents.
3. **One phase at a time, in order** (§10). Never start phase N+1 before
   phase N's CI gate is green and logged.
4. **The CI workflow is your only automated verifier.** After each phase:
   `git add` the changed files **by explicit name** (never `git add -A` with
   unrelated files dirty), commit with the message given in the phase, push
   with plain `git push origin main`, then check
   `https://github.com/TITANICBHAI/FocusGate/actions` until the run finishes.
   - Green → append the log line, continue.
   - Red → open the run page, read the red annotations (failing step log
     tails are shown as error annotations), fix **only that**, push again.
5. **Git safety (owner's hard rules):** never force-push, never use
   `--force-with-lease`, never rewrite or remove commit history, never
   rebase or amend pushed commits. Fast-forward pushes only. Before every
   push: `git fetch origin` and confirm `origin/main` is where you last saw
   it; if it moved unexpectedly, stop and report.
6. **Never make a failing test pass by weakening or deleting it.** The only
   permitted test edits are the ones specified in §9.
7. **No new dependencies.** No UI kit, no chart library, no animation
   library, no fonts. `react`, `react-dom`, `lucide-react`, `motion` are
   already available; use `lucide-react` icons and plain CSS.
8. **No network calls** (`fetch`, `XMLHttpRequest`, `WebSocket`) anywhere.
   No analytics. No `alert()`, `confirm()`, `prompt()`.
9. **Do not run `npm`/`node` on the owner's PC.** If your environment has
   Node (e.g. Replit), you may run `npm run typecheck`, `npm test`,
   `npm run build` locally before pushing — that is encouraged — but the CI
   gate is still mandatory.
10. **Keep `design-progress.md`** (create it in Phase 1): one line per phase,
    format given in §10.0.

### 0.2 Stop Rules — halt and report to the owner when:

- The same CI failure survives **3 fix attempts**.
- Any instruction here conflicts with the current code and you cannot
  resolve it by reading (e.g. a file this doc says to edit does not exist).
- You believe a spec choice breaks a pinned copy string (§6.2) or a test
  outside §9.
- You are tempted to change anything in the frozen list (§0.3).

Report format: what phase, what you did, the exact error/diff, what you
think the options are. Then wait.

### 0.3 Frozen — do not touch

- `src/shared/**`, `src/background/**` (exception: the one side-panel call in
  §8.2), `src/content/**`
- `fixes/plan.md`, `fixes/TRACKER.md`, `fixes/AGENT_PROMPT*.md`
- `tests/**` except the files/edits listed in §9
- `CHANGELOG.md`, `STORE_LISTING.md`, `docs/**`, `store-assets/**`
- Storage keys, message types, state shapes, all business logic
- The `.github/**` workflows (CI is already correct)
- `dist/` and `build/` (generated; never hand-edited)

---

## 1. Context: what exists and what is wrong

The extension's logic is finished and verified (361 tests, CI green). The UI
is functional but has no design point of view. Owner's verdict, verbatim:
*"we have fucking destroyed our ui, it looks horrible and it got no taste
and no sync of ui feel with what our app is for either… the full screen one
is just a blank page… ui arrangement is horrible even in pop-up, the focus
timer looks horrible."*

Concrete audit findings (all verified in source):

1. **The focus timer is not the hero.** `FocusView` renders a small
   `ProgressRing` with text inside, then three same-volume cards below it.
2. **The popup header is overcrowded**: brand + status chip + quick-block
   `<select>` + Block button + dashboard link, all inside 48px
   (`src/ui/popup/PopupPage.tsx`).
3. **Too much navigation**: 5 bottom tabs in the popup, 5 sub-tabs in Rules,
   **9** sub-tabs in Settings (`src/ui/popup/SettingsView.tsx`).
4. **Inconsistent surfaces**: popup, block page, onboarding, and dashboard
   each use different headers/spacing; the dashboard re-imports popup views
   (`DashboardPage.tsx`) so the two copies will drift.
5. **The full-tab dashboard shows blank** on the owner's machine — almost
   certainly a stale pre-cutover `dist/` (dashboard pages only moved to the
   dist root in the WP5 cutover build). §5.7 makes you verify + harden it.
6. **It is a popup.** A focus tool is consulted dozens of times a day and
   must stay open while the user works. The product belongs in a **side
   panel**.

### 1.1 Current file map (what you will restructure)

```
src/ui/
  popup/          PopupPage.tsx, FocusView, TasksView, RulesView,
                  StatsView, SettingsView, PasswordSettings, PresetManager   → replaced by panel/ views
  blocked/        BlockedPage.tsx                                            → restyle
  onboarding/     OnboardingPage.tsx                                         → restyle
  dashboard/      DashboardPage.tsx, HabitsCard.tsx, DashboardStats.tsx      → rebuild
  components/     primitives.tsx, feedback.tsx, Tabs.tsx, StorageGate.tsx,
                  GuardPromptHost.tsx, AchievementsCard.tsx                  → restyle/extend
  hooks/ lib/     keep as-is (storageStore, useStorage, guard*, etc.)
  styles.css      one stylesheet, ~1270 lines                                → rewrite core
  theme.tsx, mount.tsx, *.html                                               → keep pattern
```

The existing views contain **all the working state and handlers** — you are
re-skinning and re-arranging them, not rewriting logic. When a skeleton in
§5 says `// reuse: <existing thing>`, copy that logic from the current file.

---

## 2. Product identity

**FocusGate is a gate. It should feel like a calm, physical instrument:
quiet by default, legible at a glance, with one clear action at any moment.**

Principles, in priority order:

1. **Calm over clever** — no gradients-for-depth, no glows, no bounce. The
   UI is a dim room; the one thing that matters right now is lit.
2. **One hero per screen** — the timer on Focus, the list you came for on
   Rules, the reason on the block page.
3. **Attention is scarce — including attention spent on the UI.** If an
   element doesn't help the user start a session, hold a boundary, or review
   their day, it is not above the fold.
4. **Same voice everywhere** — one header pattern, one card, one list row,
   one button scale, one spacing rhythm across panel, dashboard, block page,
   onboarding.
5. **Honest, warm copy** — keep the existing tone. Banned words (CI-checked)
   in any user-facing string: *completely, instantly, cannot, always,
   guaranteed*.

---

## 3. Design tokens — paste this CSS exactly

Replace the `:root` token blocks at the top of `src/ui/styles.css` with
these (keep the `@import "tailwindcss";` line if present at the very top;
the tokens below are the single source of truth — **no hex values anywhere
else in any `.tsx`/`.css` file**; §10 Phase 1 adds a grep self-check):

```css
:root,
:root[data-theme="dark"] {
  color-scheme: dark;

  /* surfaces & lines */
  --bg: #0b0d0c;
  --surface: #141715;
  --surface-2: #1b1f1d;
  --border: #262b28;

  /* text */
  --text: #ecf2ee;
  --text-muted: #9aa5a0;
  --text-subtle: #8a958f;

  /* meaning */
  --accent: #34d399;
  --accent-contrast: #052e1f;
  --break: #7db1fa;
  --danger: #f87171;
  --danger-contrast: #2a0708;
  --warning: #fbbf24;
  --warning-contrast: #2b1d02;

  /* shape & depth */
  --radius-card: 14px;
  --radius-ctl: 8px;
  --shadow-pop: 0 8px 24px rgba(0, 0, 0, 0.35);
  --scrim: rgba(0, 0, 0, 0.45);

  /* rhythm (shared by every surface) */
  --header-h: 56px;
  --tabbar-h: 52px;
  --gutter: 16px;
  --gap: 12px;
  --ctl-h: 36px;
  --btn-h: 40px;

  /* motion */
  --dur-fast: 160ms;
  --dur-view: 200ms;
  --ease: cubic-bezier(0.2, 0.6, 0.2, 1);
}

:root[data-theme="light"] {
  color-scheme: light;
  --bg: #f7f8f7;
  --surface: #ffffff;
  --surface-2: #efefec;
  --border: #dddfdb;
  --text: #17201b;
  --text-muted: #5a6660;
  --text-subtle: #636e68;
  --accent: #047857;
  --accent-contrast: #ffffff;
  --break: #2563eb;
  --danger: #b91c1c;
  --danger-contrast: #ffffff;
  --warning: #9a4708;
  --warning-contrast: #ffffff;
  --shadow-pop: 0 8px 24px rgba(23, 32, 27, 0.14);
  --scrim: rgba(23, 32, 27, 0.32);
}
```

> **Contrast correction (2026-11-01):** the first draft of this palette
> (dark subtle `#6e7a74`, light subtle `#8b958f`, light accent `#0e9f6e`,
> light danger `#dc2626`, light warning `#b45309`) failed the WCAG-AA
> theme-token test on `--surface-2`. The values above are the corrected,
> CI-verified set — do not reintroduce the old ones.

Color discipline: **accent is earned** — one accent element per view (the
primary button, the live timer fill, or the active tab underline). Danger is
only for stop/remove/reset. Warning is only for active locks and the
standalone block. Body text is never colored.

Typography: `Inter, system-ui, -apple-system, "Segoe UI", sans-serif`. Body
14, secondary 13, micro-labels 12 (caps). Hero timer 72px. **Every timer
digits display uses `font-variant-numeric: tabular-nums`.** 12px is the
minimum text size (CI claims this — keep).

---

## 4. Foundation CSS and components

### 4.1 Foundation CSS — paste after the tokens

```css
* { box-sizing: border-box; }

html, body {
  margin: 0;
  padding: 0;
  background: var(--bg);
  color: var(--text);
  font: 400 14px/1.45 Inter, system-ui, -apple-system, "Segoe UI", sans-serif;
  -webkit-font-smoothing: antialiased;
}

*:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

button { font: inherit; color: inherit; }

/* ---------- app shells ---------- */

/* side panel / narrow column shell */
.fg-panel {
  display: flex;
  flex-direction: column;
  height: 100vh;
  min-width: 300px;
}
.fg-panel__main {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: var(--gutter);
  padding-bottom: calc(var(--gutter) + var(--tabbar-h));
}
.fg-panel__main > .fg-stack { max-width: 480px; margin: 0 auto; }

/* full-tab page shell (blocked / onboarding / dashboard) */
.fg-full-page {
  min-height: 100vh;
  background: var(--bg);
}
.fg-full-page__inner {
  max-width: 460px;
  margin: 0 auto;
  padding: 48px var(--gutter);
}

/* ---------- header (every surface) ---------- */

.fg-header {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--gap);
  height: var(--header-h);
  padding: 0 var(--gutter);
  background: color-mix(in srgb, var(--bg) 88%, transparent);
  backdrop-filter: blur(8px);
  border-bottom: 1px solid var(--border);
}
.fg-wordmark {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
}
.fg-wordmark img { width: 20px; height: 20px; }
.fg-header__actions { display: flex; align-items: center; gap: 4px; }

/* ---------- tab bar (panel only) ---------- */

.fg-tabbar {
  position: sticky;
  bottom: 0;
  z-index: 10;
  display: flex;
  height: var(--tabbar-h);
  background: var(--surface);
  border-top: 1px solid var(--border);
}
.fg-tabbar__btn {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  font-size: 12px;
  color: var(--text-muted);
  background: none;
  border: 0;
  border-top: 2px solid transparent;
  padding: 0;
  cursor: pointer;
  transition: color var(--dur-fast) var(--ease);
}
.fg-tabbar__btn[aria-selected="true"] {
  color: var(--text);
  border-top-color: var(--accent);
}

/* ---------- rhythm primitives ---------- */

.fg-stack {
  display: flex;
  flex-direction: column;
  gap: var(--gap);
}
.fg-wrap { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }

.fg-section-label {
  font-size: 12px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-muted);
  margin: 0 0 8px;
}
.fg-stack .fg-section-label { margin-top: 8px; }

/* ---------- card ---------- */

.fg-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  padding: 16px;
}
.fg-card__title { font-size: 14px; font-weight: 600; margin: 0 0 4px; }
.fg-card__desc { font-size: 13px; color: var(--text-muted); margin: 0 0 12px; }

/* ---------- list rows ---------- */

.fg-list { display: flex; flex-direction: column; }
.fg-list > .fg-row + .fg-row { border-top: 1px solid var(--border); }
.fg-row {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 44px;
  padding: 8px 0;
}
.fg-row__swatch {
  flex: none;
  width: 28px;
  height: 28px;
  border-radius: var(--radius-ctl);
  background: var(--surface-2);
  display: grid;
  place-items: center;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
  overflow: hidden;
}
.fg-row__copy { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.fg-row__title {
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.fg-row__sub { font-size: 13px; color: var(--text-muted); }
.fg-row__chips { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 2px; }
.fg-row__actions { display: flex; gap: 4px; flex: none; align-items: center; }

/* ---------- buttons ---------- */

.fg-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: var(--btn-h);
  padding: 0 16px;
  border-radius: var(--radius-ctl);
  border: 1px solid transparent;
  background: none;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background var(--dur-fast) var(--ease),
    border-color var(--dur-fast) var(--ease), opacity var(--dur-fast) var(--ease);
}
.fg-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.fg-btn--primary { background: var(--accent); color: var(--accent-contrast); }
.fg-btn--primary:not(:disabled):hover { filter: brightness(1.06); }
.fg-btn--secondary { background: var(--surface-2); border-color: var(--border); }
.fg-btn--secondary:not(:disabled):hover { border-color: var(--text-subtle); }
.fg-btn--quiet { color: var(--text-muted); padding: 0 8px; }
.fg-btn--quiet:not(:disabled):hover { color: var(--text); background: var(--surface-2); }
.fg-btn--danger { background: var(--danger); color: var(--danger-contrast); }
.fg-btn--danger-quiet { color: var(--danger); padding: 0 8px; }
.fg-btn--danger-quiet:not(:disabled):hover { background: color-mix(in srgb, var(--danger) 12%, transparent); }
.fg-btn--dense { height: 32px; padding: 0 10px; font-size: 13px; }
.fg-btn--wide { width: 100%; }
.fg-btn--jumbo { height: 48px; font-size: 15px; }

/* icon-only button sizing */
.fg-btn--icon { width: var(--btn-h); padding: 0; }
.fg-btn--icon.fg-btn--dense { width: 32px; }

/* ---------- chips ---------- */

.fg-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 22px;
  padding: 0 8px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: none;
  font-size: 12px;
  color: var(--text-muted);
}
.fg-chip--live { border-color: var(--accent); color: var(--accent); }
.fg-chip--lock { border-color: var(--warning); color: var(--warning); }
.fg-chip__btn {
  border: 0;
  background: none;
  padding: 0;
  color: inherit;
  cursor: pointer;
  line-height: 1;
}

/* ---------- progress ---------- */

.fg-progress {
  height: 4px;
  border-radius: 999px;
  background: var(--surface-2);
  overflow: hidden;
}
.fg-progress > span {
  display: block;
  height: 100%;
  border-radius: 999px;
  background: var(--accent);
  transition: width 1s linear;
}
.fg-progress--break > span { background: var(--break); }
.fg-progress--warn > span { background: var(--warning); }

/* ---------- stats ---------- */

.fg-stat { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.fg-stat__label {
  font-size: 12px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-muted);
}
.fg-stat__value {
  font-size: 20px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.fg-stat__sub { font-size: 13px; color: var(--text-muted); }
.fg-stat-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(92px, 1fr));
  gap: var(--gap);
}

/* ---------- form fields ---------- */

.fg-field { display: flex; flex-direction: column; gap: 6px; }
.fg-field__label { font-size: 13px; font-weight: 500; }
.fg-field__helper { font-size: 13px; color: var(--text-muted); }
.fg-field__error { font-size: 13px; color: var(--danger); }
.fg-input,
.fg-select,
.fg-textarea {
  width: 100%;
  height: var(--ctl-h);
  padding: 0 10px;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-ctl);
  color: var(--text);
  font: inherit;
}
.fg-textarea { height: auto; min-height: 72px; padding: 8px 10px; resize: vertical; }
.fg-input:focus-visible,
.fg-select:focus-visible,
.fg-textarea:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 0;
  border-color: transparent;
}
.fg-field.has-error .fg-input,
.fg-field.has-error .fg-select,
.fg-field.has-error .fg-textarea { border-color: var(--danger); }

/* segmented control */
.fg-seg {
  display: flex;
  gap: 4px;
  padding: 4px;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-ctl);
}
.fg-seg__btn {
  flex: 1;
  height: 28px;
  border: 0;
  border-radius: calc(var(--radius-ctl) - 2px);
  background: none;
  color: var(--text-muted);
  font-size: 13px;
  cursor: pointer;
}
.fg-seg__btn[aria-pressed="true"],
.fg-seg__btn[aria-selected="true"] {
  background: var(--surface);
  color: var(--text);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}

/* toggle */
.fg-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--gap);
  min-height: 40px;
}
.fg-toggle__copy { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.fg-toggle__track {
  flex: none;
  width: 36px;
  height: 20px;
  border-radius: 999px;
  background: var(--surface-2);
  border: 1px solid var(--border);
  position: relative;
  cursor: pointer;
  transition: background var(--dur-fast) var(--ease);
}
.fg-toggle__track::after {
  content: "";
  position: absolute;
  top: 2px;
  left: 2px;
  width: 14px;
  height: 14px;
  border-radius: 999px;
  background: var(--text-muted);
  transition: transform var(--dur-fast) var(--ease), background var(--dur-fast) var(--ease);
}
.fg-toggle__track[aria-pressed="true"] { background: var(--accent); border-color: var(--accent); }
.fg-toggle__track[aria-pressed="true"]::after { transform: translateX(16px); background: var(--accent-contrast); }

/* ---------- hero (focus timer) ---------- */

.fg-hero { text-align: center; padding: 8px 0 16px; user-select: none; }
.fg-hero__label {
  font-size: 12px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}
.fg-hero__time {
  font-size: 72px;
  font-weight: 600;
  line-height: 1.05;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
  margin: 8px 0 4px;
}
.fg-hero--smallest .fg-hero__time { font-size: 48px; } /* block page & dashboard */
.fg-hero__meta { font-size: 13px; color: var(--text-muted); }
.fg-hero__progress { margin: 12px auto 0; max-width: 280px; }
.fg-hero--break .fg-hero__time { color: var(--break); }
.fg-hero--warn .fg-hero__time { color: var(--warning); }
.fg-hero--editable .fg-hero__time { cursor: pointer; }
.fg-hero--editable .fg-hero__time:hover { color: var(--accent); }

/* ---------- sheet (panel bottom sheet) & modal ---------- */

.fg-scrim {
  position: fixed;
  inset: 0;
  background: var(--scrim);
  z-index: 20;
  animation: fg-fade var(--dur-fast) var(--ease);
}
.fg-sheet {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 30;
  max-height: 82%;
  overflow-y: auto;
  background: var(--surface);
  border-top: 1px solid var(--border);
  border-radius: 16px 16px 0 0;
  padding: 16px;
  box-shadow: var(--shadow-pop);
  animation: fg-rise var(--dur-view) var(--ease);
}
.fg-sheet__grip {
  width: 36px;
  height: 4px;
  border-radius: 999px;
  background: var(--border);
  margin: 0 auto 12px;
}
.fg-modal {
  position: fixed;
  inset: 0;
  z-index: 30;
  display: grid;
  place-items: center;
  padding: var(--gutter);
}
.fg-modal__card {
  width: min(420px, 100%);
  max-height: 82vh;
  overflow-y: auto;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  padding: 16px;
  box-shadow: var(--shadow-pop);
  animation: fg-rise var(--dur-view) var(--ease);
}
@keyframes fg-fade { from { opacity: 0; } }
@keyframes fg-rise { from { transform: translateY(12px); opacity: 0; } }

/* ---------- empty state ---------- */

.fg-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 24px 0;
  text-align: center;
  color: var(--text-muted);
}
.fg-empty svg { width: 24px; height: 24px; opacity: 0.7; }
.fg-empty__title { font-size: 14px; font-weight: 500; color: var(--text); }
.fg-empty__desc { font-size: 13px; }

/* ---------- toast ---------- */

.fg-toast-host {
  position: fixed;
  left: 50%;
  bottom: calc(var(--tabbar-h) + var(--gutter));
  transform: translateX(-50%);
  z-index: 40;
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: min(360px, calc(100% - 32px));
}
:root:not(.fg-in-panel) .fg-toast-host { bottom: var(--gutter); }
.fg-toast {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-radius: var(--radius-ctl);
  background: var(--surface);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-pop);
  font-size: 13px;
  animation: fg-rise var(--dur-view) var(--ease);
}
.fg-toast--error { border-color: var(--danger); }
.fg-toast--success { border-color: var(--accent); }

/* ---------- skeleton / loading ---------- */

.fg-skeleton { border-radius: var(--radius-ctl); background: var(--surface-2); animation: fg-pulse 1.4s ease-in-out infinite; }
@keyframes fg-pulse { 50% { opacity: 0.45; } }

/* ---------- dashboard layout ---------- */

.fg-dash { display: flex; min-height: 100vh; }
.fg-dash__rail {
  flex: none;
  width: 200px;
  border-right: 1px solid var(--border);
  padding: var(--gutter) 8px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  position: sticky;
  top: 0;
  height: 100vh;
}
.fg-dash__rail .fg-btn { justify-content: flex-start; }
.fg-dash__main {
  flex: 1;
  min-width: 0;
  padding: 24px;
  max-width: 860px;
  margin: 0 auto;
}
@media (max-width: 720px) {
  .fg-dash { flex-direction: column; }
  .fg-dash__rail {
    position: static;
    height: auto;
    width: auto;
    flex-direction: row;
    overflow-x: auto;
    border-right: 0;
    border-bottom: 1px solid var(--border);
  }
}

/* ---------- reduced motion ---------- */

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    scroll-behavior: auto !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

Migration note: the old stylesheet's classes (`fg-popup`, `fg-page`,
`fg-stats-grid`, etc.) stay until Phase 7 deletes them. Phase 1 appends the
blocks above; screens migrate onto them phase by phase so CI stays green at
every step.

### 4.2 Component APIs (edit `src/ui/components/primitives.tsx`)

Keep the existing exported names (tests import some). Restyle internals to
the classes above; add the new members:

```tsx
// existing, restyled to the new classes:
Button({variant: "primary"|"secondary"|"quiet"|"danger"|"danger-quiet",
        size?: "default"|"dense"|"jumbo", wide?: boolean, icon?: boolean, ...})
Card({title?, description?, actions?, children})          // .fg-card
Chip({tone?: "neutral"|"live"|"lock", onRemove?, children})// .fg-chip
Field({id, label, helper?, error?, children})              // .fg-field
Toggle({label, description?, checked, onCheckedChange})    // .fg-toggle
Segmented({label, options, value, onChange})               // .fg-seg
EmptyState({icon?, title, description?, action?})          // .fg-empty
Modal({open, title, description?, onClose, actions, children}) // .fg-modal
ConfirmDialog({...})  // keep API

// NEW members (add to primitives.tsx):
ListRow({swatch?: string /*1–2 chars*/, icon?: ReactNode, title: ReactNode,
         sub?: ReactNode, chips?: ReactNode, actions?: ReactNode,
         status?: ReactNode /* right-side, before actions */})
Stat({label, value, sub?})                                 // .fg-stat
Progress({value /*0..1*/, tone?: "accent"|"break"|"warn"}) // .fg-progress
Sheet({open, title, onClose, children, footer?})           // .fg-sheet + scrim
AppHeader({status?: "idle"|"focus"|"break"|"block", onOpenSettings: () => void})
HeroTimer({label, seconds, meta?, progress?, tone?: "accent"|"break"|"warn",
           editable?: boolean, onEditStart?: () => void, chip?: ReactNode})
SectionLabel({children})                                   // .fg-section-label
```

`feedback.tsx`: keep `ToastProvider`/`useToast`/toast API; restyle to
`.fg-toast`; the panel root adds class `fg-in-panel` to `<html>` so the
toast host positions above the tab bar.

---

## 5. Screen specifications

Wire every screen to the **existing** state and handlers — the skeletons
below mark reuse points. Never duplicate business logic.

### 5.1 The panel shell — `src/ui/panel/`

New page: `src/ui/panel/panel.html` (copy the shape of `popup.html`: root
div + `src="./panel/main.tsx"`), `src/ui/panel/main.tsx`
(`mountUiPage(<PanelPage />, { prepareMigratedStorage: false })` —
migration runs in the worker on install; panels don't need the gate), and
`PanelPage.tsx`:

```tsx
<StorageGate keys={APP_STATE_KEYS}>
  <ToastProvider>
    <ThemeRoot>
      <GuardPromptHost />
      <div className="fg-panel">           {/* adds .fg-in-panel to <html> */}
        <AppHeader status={statusFromState(state)} onOpenSettings={openDashboardSettings} />
        <main className="fg-panel__main" role="tabpanel" ...>
          {tab === "focus" && <FocusScreen state={state} .../>}
          {tab === "rules" && <RulesScreen state={state} .../>}
          {tab === "you"   && <YouScreen state={state} .../>}
        </main>
        <TabBar value={tab} onChange={setTab} options={FOCUS/RULES/YOU} />
      </div>
    </ThemeRoot>
  </ToastProvider>
</StorageGate>
```

- `AppHeader`: wordmark + one status dot (`--accent` focus/break colors:
  break uses `--break`, standalone uses `--warning`, idle = muted) + a
   single gear `IconButton` ("Open settings") →
  `chrome.tabs.create({ url: runtime.getURL("dashboard.html#settings") })`
  with the existing open-in-tab fallback pattern from `DashboardPage`.
- **Quick-block, the status chip text, and the dashboard link move OUT of
  the header** (they go to Rules and Focus respectively — below).
- Header must also honor the lock rule from the old popup: when
  `state.session.status !== "idle" && lockLevel !== "none"`, hide nothing —
  the header is navigation only; locks already disable in-content actions
  via `weakeningLockReason(state)` (reuse it).

### 5.2 Focus screen (default tab) — `src/ui/panel/FocusScreen.tsx`

Reuses state/handlers from today's `src/ui/popup/FocusView.tsx` (session
start/stop/extend messages, standalone actions, task start, duration
validation). New structure:

**Idle:**

```tsx
<div className="fg-stack">
  <div className="fg-hero fg-hero--editable">
    <div className="fg-hero__label">Focus session</div>
    <div className="fg-hero__time" onClick={beginEdit} onKeyDown={...}
         role="button" tabIndex={0} aria-label="Edit session length">
      {format(durationText)}                    {/* reuse validDuration/durationText state */}
    </div>
    <div className="fg-hero__meta">{lockSummaryFor(lockLevel, hasPassword)}</div>  {/* reuse LOCK_COPY strings §6.2 */}
  </div>
  <Progress value={0} />                        {/* flat, idle */}
  <div className="fg-wrap" role="group" aria-label="Duration presets">
    {DURATION_PRESETS.map(...)}                 {/* reuse; chip-style fg-btn--dense fg-btn--secondary */}
  </div>
  <Segmented label="Session lock" options={LOCK_OPTIONS} value={lockLevel}
             onChange={setLockLevel} />         {/* compact; summary text = hero meta */}
  <Button variant="primary" size="jumbo" wide onClick={startFocus}>
    Start focus
  </Button>
  <p className="fg-hero__meta">{blockScopeSummary(...)}   {/* reuse; renders as link to Rules when zero */}</p>

  <Card title="Today">
    <div className="fg-stat-row">
      <Stat label="Focused" value={fmt(focusMsToday)} />
      <Stat label="Goal" value={`${pct}%`} />
      <Stat label="Streak" value={`${streak}d`} />
    </div>
  </Card>
  <Card title="Up next" actions={<Button variant="quiet" onClick={openTasks}>Add task</Button>}>
    {nextTask ? <ListRow title={t.title} sub={windowLabel} actions={
        <Button variant="secondary" size="dense" onClick={startTask}>Start</Button>} />
      : <EmptyState icon={<CalendarPlus/>} title="Nothing scheduled"
            description="Add a task to plan your next focus session." />}
  </Card>
  <Card title="Block now" ...collapsed>
    {/* one ListRow summary: "3 sites · ends 18:30" + Button secondary dense "Set up…"
        opens Sheet with the existing standalone start form
        (reuse startStandalone/isValidStandaloneExpiry logic + presets + acknowledgement) */}
  </Card>
</div>
```

**Running (work):** hero shows the live countdown (reuse the 1s
`SessionClock` interval, but only the time text re-renders), label
"Focus" + a lock `Chip` ("Strict"/"Commit") when locked, meta "Ends 15:32".
Below: `Progress` draining; a `.fg-wrap` row of quiet extend chips
(`+10 +15 +20 +30 +45 +60`, reuse `sendSessionMessage session/extend`);
then one `fg-btn--danger-quiet` "Stop session…" opening the **existing**
password/phrase/wait `Modal` (reuse `submitStop` verbatim). No second
primary button. No ring. No debrief card (a success toast
"Session ended — clean, no blocked attempts" appears after stop; the full
debrief lives on You and in `src/shared/debrief.ts`).

**Break:** hero tone `break`, label "Break", meta "Ends …"; one quiet
"Skip break" button (reuse `session/skipBreak`).

**Standalone active:** hero tone `warn`, label + `Chip` "Block now — no
early stop", countdown to `standalone.until`; below, a compact Card with
"N sites blocked", the add-site inline form and quick-extend chips (reuse
`extendStandalone`/`addStandaloneSite`).

### 5.3 Rules screen — `src/ui/panel/RulesScreen.tsx`

- Top: **Check a URL** as an inline row (magnifier icon + input + quiet
  "Check" button; verdict line below; reuse `assessUrl` + reason copy from
  `RulesView`'s `UrlExplanation`, including the "Why?" modal trigger).
- `Segmented` with 4 options: **Sites · Keywords · Schedule · Limits**.
- Locked-state banner (reuse `weakeningLockReason`) above the segmented
  control when a lock runs.
- **Sites:** header row with the relocated quick-block:
  `Button secondary "Block current site"` (reuse the popup's
  `quickBlockCurrentTab` logic incl. the Focus/Always destination select —
  now a small `Select` next to the button — and the toast). Site list =
  `ListRow` per domain: swatch = first letter, title = domain, chips row =
  when-it-blocks (Focus/Always/schedule names — reuse `schedulesForSite`),
  status = live "Blocked now" chip when `isBlockedNow`, actions = "Why?"
  (quiet, opens the existing explanation modal) + Remove (quiet; keep the
  locked/disabled reason). Add form in a `Sheet`: input +
  During-focus/Always `Segmented` + alias chips with remove buttons (reuse
  `aliasesForSiteDisplay` + `removeAlias`). "Exceptions (n)" is a
  disclosure row expanding to exception ListRows + add-sheet (reuse
  normalizeException logic).
- **Keywords:** add via `Sheet` (textarea + Block/Hide/Both `Segmented` +
  During blocks/Always `Segmented` — reuse `addKeywords`); rows are
  `ListRow` with mode/scope chips + Remove; "Recent matches (n)" disclosure
  expanding to match ListRows (reuse `state.keywordMatches`) + "Clear"
  quiet button.
- **Schedule:** `ListRow` per schedule (title=name, sub="Mon–Fri · 09:00–
  17:00", inline `Toggle` for enabled); "Add schedule" opens `Sheet` with
  name + day chips + start/end (+ the existing 24:00 note); editing reuses
  `updateSchedule`/`deleteSchedule` + `ConfirmDialog`.
- **Limits:** `ListRow` per allowance: title=domain,
  sub="12 of 30 min used" + inline `Progress`; edit `Sheet` reuses the
  existing mode/value/period validation, `duringBlocks` toggle, and the
  EC37 mode-change reset call; presets and custom values unchanged.

### 5.4 You screen — `src/ui/panel/YouScreen.tsx`

One scroll of `Card`s: (1) **Today** — `Stat` row + goal `Progress` +
reflection (five 32px mood buttons — reuse `saveReflection` — and the note
field); (2) **This week** — the tiny inline-SVG bar chart (56px tall; reuse
`focusMinutesPerDay`; bars are 6px rounded `--accent`, muted axis digits)
+ sessions/minutes `Stat` row; (3) **Achievements** — horizontal scroll of
chips (reuse `AchievementsCard` data, restyled; tap → dashboard
`#achievements`); (4) **Habits** — reuse `HabitsCard` internals as
`ListRow`s with streak + check-in toggle; (5) link row
`Button quiet "Open full dashboard ›"`.

### 5.5 Block page — restyle `src/ui/blocked/BlockedPage.tsx`

`.fg-full-page` → `.fg-full-page__inner` column, centered text, max-width
460px: caps 12 label ("BLOCKED BY SCHEDULE" etc. — derive from
`reasonTitle`), 28px reason headline, **48px countdown only for
session/standalone** (keep the exact conditional string — §6.2), "ends
17:30" meta, one 16px context line (custom message or default), URL as
muted 13px plain text, optional quote (italic), then `.fg-wrap` with
secondary "Close tab" + quiet "Open new tab" (reuse the exact
`chrome.tabs.getCurrent()`/`remove` code). Block-ended state: headline
"Block ended", one primary "Open {host}". Keep the WebAudio tone logic
unchanged.

### 5.6 Onboarding — restyle `src/ui/onboarding/OnboardingPage.tsx`

Same 5 steps, same state/handlers. Visual frame: `.fg-full-page__inner`;
step dots (not "Step 1 of 4"); presets as selectable `ListRow`s (checkbox
→ selected border-accent); protection check as three status `ListRow`s
(icons + state) + quiet "Check again"; final screen primary button text
"Open FocusGate in the side panel" with the **existing** fallback message
string unchanged.

### 5.7 Dashboard — rebuild `src/ui/dashboard/DashboardPage.tsx`

- Structure: `.fg-dash` with `.fg-dash__rail` (Overview · Rules · Reports ·
  Settings · Data — quiet buttons, active = secondary) and
  `.fg-dash__main`. Below 720px the rail becomes a top scroll row (CSS
  above already does this).
- **Overview:** hero row (`.fg-hero--smallest` 48px focus time + goal
  `Progress`), Today/Week/Month `Segmented`, KPI `Stat` rows (completed,
  clean, completion rate, blocks), the existing inline-SVG chart restyled
  to the token colors, insights as a 2-col `Stat` grid (reuse
  `getFocusInsights`), top-blocked `ListRow`s, habits + achievements
  detail (reuse `HabitsCard`/`AchievementsCard` data).
- **Rules:** import `RulesScreen` from the panel with `density="wide"`:
  in wide mode the Sheets become inline side-by-side layout
  (list left, editor right at ≥720px). One component, two densities —
  this is how the two surfaces stop drifting.
- **Reports:** existing weekly report cards as `ListRow`s/`Stat` rows.
- **Settings:** **one scrolling page**, all groups with `SectionLabel`s —
  Security (reuse `PasswordSettings`), Appearance, Timer, Alerts
  (notifications + reminders), Block page, Content, Protection, About.
  No tabs. (This absorbs the nine-tab popup Settings entirely.)
- **Data:** existing BackupPanel logic restyled.
- **Blank-page hardening (mandatory):** `body.full-page` gets
  `background: var(--bg)`; `#root` gets `min-height: 100vh`; wrap the page
  in an error boundary (a small class component in `DashboardPage.tsx`)
  that renders the `.fg-full-page__inner` error card with the message on
  crash. Then verify `dist/dashboard.html` after a fresh build. If it is
  still blank with no console error, stop and report (Stop Rule).

### 5.8 Shared-view rule

`FocusScreen`, `RulesScreen`, `YouScreen` live in `src/ui/panel/views/` and
accept `{ state, density?: "narrow"|"wide" }`. The dashboard imports the
same components for Rules/You content. The popup directory is deleted in
Phase 7 — nothing may import from `src/ui/popup/` after that phase.

---

## 6. Copy deck

### 6.1 New strings (use verbatim)

| Where | String |
|---|---|
| Focus idle label | `Focus session` |
| Focus running label | `Focus` (+ chip `Strict` / `Commit`) |
| Break label | `Break` |
| Standalone label | `Block now — no early stop` |
| Primary CTA | `Start focus` |
| Stop action | `Stop session…` |
| Skip | `Skip break` |
| Extend chips | `+10` `+15` `+20` `+30` `+45` `+60` |
| End time meta | `Ends 15:32` (formatted) |
| Session-end toast | `Session ended` (append ` — no blocked attempts` when 0) |
| Quick block (Rules) | `Block current site` |
| Check URL | placeholder `Paste any address to check` |
| Rules sub-tabs | `Sites · Keywords · Schedule · Limits` |
| Exceptions disclosure | `Exceptions (n)` / `Recent matches (n)` |
| You cards | `Today` `This week` `Achievements` `Habits` |
| Empty tasks | title `Nothing scheduled`, description `Add a task to plan your next focus session.` |
| Block now collapsed | `{n} sites · ends {time}` + `Set up…` |
| Onboarding final CTA | `Open FocusGate in the side panel` |
| Panel settings hint | `The panel can sit on either side of the window — drag it where you like.` |

### 6.2 Pinned strings — must appear unchanged (CI tests match them)

From `tests/claims.test.ts` and the views (do not reword):

- `You can stop any time with a confirmation.`
- `There is no early-stop action. You can still disable or remove the extension.`
- `Stopping early needs your password. You can still disable or remove the extension.`
- `Stopping early needs the phrase “I GIVE UP” and a 15-second wait. You can still disable or remove the extension.`
- `title="No tasks yet"` empty state strings and
  `Add one to plan your next focus session.`
- `This task is linked to the running session.`
- The PasswordSettings friction sentence containing
  `It does not prevent this extension from being disabled or`
- Onboarding: `Open FocusGate`, the `Setup is saved. Open FocusGate from
  your browser toolbar to continue.` fallback, `Check browser access`,
  `Incognito access`, `Website access`, `Notifications`
- Block page internals: the countdown conditional
  `reason.kind === "session" || reason.kind === "standalone"`,
  `state.dayStats[dateKey]?.blocks`, `chrome.tabs.getCurrent()`,
  `chrome.tabs.remove(current.id)`
- Keyword splitting: `input.split(/[,\\n]/)`
- Settings About links `focusflowpc.pages.dev` / `focusflowapp.pages.dev`
  (must stay OUT of the block page)

If a redesign element would break one of these, stop and report.

---

## 7. Consistency contract (enforced in review)

- `--header-h`, `--tabbar-h`, `--gutter`, `--gap` are the only spacing
  authorities; no magic margins in components.
- Every list is `ListRow`; every metric is `Stat`; every form control is
  `Field` + the input classes; every add/edit flow in the panel is a
  `Sheet`, in the dashboard an inline panel.
- Exactly one accent element visible per view; one primary button per view.
- Empty/loading/error states use the shared components and the copy voice.
- Dark and light themes both pass 4.5:1 (extend the existing
  `themeTokens.test.ts` with the new token values).

## 8. Side-panel integration (Phase 7 — exact changes)

### 8.1 Manifest (`public/manifest.json`)

```jsonc
"minimum_chrome_version": "116",
"permissions": [ ...existing..., "sidePanel" ],        // add, keep order tidy
"side_panel": { "default_path": "panel.html" },
// REMOVE "action.default_popup" (keep action with default_title + icons)
```

Firefox (handled in `scripts/package-firefox.cjs` — it already rewrites
`background`; extend it): strip `side_panel` and `sidePanel` from
permissions, and add:

```jsonc
"sidebar_action": {
  "default_title": "FocusGate",
  "default_panel": "panel.html",
  "default_icon": { "...same icon set..." },
  "open_at_install": false
}
```

### 8.2 Worker (`src/background/chrome.ts` only)

In `createChromeWorker`, before `createWorker(api)` add — feature-detected,
never throwing:

```ts
try {
  (chrome as unknown as {
    sidePanel?: { setPanelBehavior(o: { openPanelOnActionClick: boolean }): Promise<void> };
  }).sidePanel?.setPanelBehavior({ openPanelOnActionClick: true });
} catch { /* older browsers keep the popup fallback path */ }
```

Firefox toolbar click: in the worker's `handleCommand` you may also try
`chrome.sidebarAction?.open()` guarded the same way (only exists in FF).

**Which side:** the browser decides; the user drags the panel to either
side (native Chrome/Edge). Do not attempt to control it. The Settings
Appearance section shows the pinned hint string from §6.1.

### 8.3 Build (`scripts/build-extension.mjs`, `vite.staged-ui.config.ts`)

Vite inputs become `panel.html, blocked.html, onboarding.html,
dashboard.html` (drop popup.html). Delete: `src/ui/popup/` entirely,
`vite.config.ts` (the dead root-UI config) **only if** nothing imports it —
check `scripts/` and `.replit` first; if referenced, leave it and note it in
the progress log. Remove all now-unused CSS blocks (`.fg-popup`, old
`.fg-page`, `.fg-stats-*`, old nav styles) from `styles.css`.

## 9. Test edits (the ONLY permitted test changes)

| File | Change |
|---|---|
| `tests/claims.test.ts` | C05 block: replace the 380×580 assertions with: `styles.css` contains `.fg-panel` and `min-width: 300px`, and does NOT contain `width: 380px`. Keep every other claim untouched. |
| `tests/ui/pages.test.ts` | entry table: `popup.html → panel.html` with entry `./panel/main.tsx`; the "manifest routes" case asserts `side_panel.default_path === "panel.html"` and that `action.default_popup` is absent. |
| `tests/manifest.smoke.test.js` | popup assertions → `manifest.side_panel?.default_path === "panel.html"`; permissions include `sidePanel`; `minimum_chrome_version === "116"`; content entry checks unchanged. |
| `tests/ui/themeTokens.test.ts` | extend for the new token values (both themes ≥4.5:1 where applicable). |
| NEW `tests/ui/panelRender.test.tsx` | mounts `FocusScreen` idle + running in a 360px container: asserts the hero time element has inline/class font-size 72px semantics (class `fg-hero__time`), exactly one `.fg-btn--primary` exists per state, and the extend chips appear only when running. |
| NEW `tests/ui/foundation.test.ts` | asserts `styles.css` defines every token from §3 and the foundation classes from §4.1 (substring checks), and contains no hex color outside the two `:root` blocks (regex over the file, excluding the token blocks). |

## 10. Phase plan (execute in order; CI gate after each)

Create `design-progress.md` in Phase 1 with the header
`# UI redesign progress` and append one line per phase:
`<date> | P<n> <name> | commit <sha> | CI run #<n> green`.

- **P1 Foundation.** Rewrite token blocks + append foundation CSS in
  `styles.css` (keep old blocks). Restyle `primitives.tsx` + `feedback.tsx`
  to the new classes; add the new components (`ListRow`, `Stat`,
  `Progress`, `Sheet`, `AppHeader`, `HeroTimer`, `SectionLabel`). Existing
  screens keep working (they may look mixed — fine). Self-check: `grep -n
  "#[0-9a-fA-F]\{6\}" src/ui/components/*.tsx` returns nothing. Commit:
  `UI P1: design tokens, foundation CSS, and shared components`.
- **P2 Panel shell.** Create `panel.html`, `panel/main.tsx`,
  `PanelPage.tsx` with header/tabs and placeholder views. Not in the
  manifest yet. Commit: `UI P2: side panel shell`.
- **P3 Focus screen.** Build `FocusScreen` per §5.2 (reuse FocusView
  logic; delete nothing yet). Commit: `UI P3: focus screen`.
- **P4 Rules + You.** §5.3–5.4 (reuse RulesView/StatsView/HabitsCard/
  AchievementsCard logic). Commit: `UI P4: rules and you screens`.
- **P5 Block page + onboarding.** §5.5–5.6 restyles. Commit:
  `UI P5: block page and onboarding restyle`.
- **P6 Dashboard.** §5.7 rebuild + blank-page hardening + shared
  density views. Commit: `UI P6: dashboard rebuild`.
- **P7 Cutover to the panel.** §8 manifest/build/deletions + §9 test
  updates together in one commit (this mirrors the earlier WP5 atomic
  cutover — one commit, all routes). Delete `src/ui/popup/`. Commit:
  `UI P7: activate the side panel, remove the popup`.
- **P8 Verification extras.** Add the two new test files from §9; final
  sweep greps: banned words, `console.log`, hex-outside-tokens, leftover
  `fg-popup` references. Commit: `UI P8: verification tests and sweep`.

Each phase's done-when: CI green (typecheck + full suite + build +
packaging), the phase's screens/components exist and compile, the progress
log line appended.

## 11. Final acceptance (owner checks in a real browser)

1. Toolbar click opens the **side panel** (Chrome/Edge; Firefox sidebar),
   draggable to either side by the user, usable at 300–512px with no
   horizontal scroll.
2. Focus screen: one hero (72px tabular timer), exactly one primary action
   in every state.
3. Panel, dashboard, block page, onboarding read as one product.
4. Dashboard renders styled (not blank).
5. CI fully green; dark+light contrast passes; keyboard-only works.
6. No banned words; pinned strings intact.

---

*Prepared 2026-11-01 by the planning agent. The product beneath this UI is
finished and verified — treat it as fixed. Make it feel like the calm,
deliberate tool it is — by following this document, not by improvising.*
