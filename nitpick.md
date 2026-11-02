# nitpick.md — UI follow-up fixes for the implementing agent

You are implementing a nitpick pass over the FocusGate extension UI.
The redesign (design.md phases P1–P8) is **complete and CI-green (run #130,
commit 2360bf5)**. This document lists real, verified defects and rough edges
that remain in the shipped UI. Fix them exactly as written. Do not redesign
anything. Do not "improve" anything that is not on this list.

Read order before starting: this file top to bottom, `design.md` §6 (copy
deck) and §7 (consistency contract), `design-progress.md` (what has been
done so far).

---

## 0. Hard rules (identical to the previous phases — breaking one means stop)

1. Work alone. No sub-agents. No new dependencies. No network calls in code.
2. **Never run npm/node locally on the owner's PC.** CI on GitHub is your only
   verifier: push, then read the run's `::error::` annotations anonymously
   from the run page. Wait for the run to finish before the next batch.
3. Git protocol: `git fetch origin` before every push; confirm `origin/main`
   is exactly where you last saw it; **plain fast-forward pushes only —
   NEVER `--force` or `--force-with-lease`, never rewrite history**; stage
   files by explicit name, never `git add -A`.
4. tsconfig does **not** include `src/ui` — TypeScript will not catch a
   broken import in UI files locally. The CI build and Vitest will. This is
   why rule 2 exists: a red import only surfaces in CI.
5. Test edits are forbidden **except** the two named in batch N2 (C40
   correction) and mechanical updates a batch explicitly instructs. Never
   weaken an assertion to make it pass.
6. Pinned strings (design.md §6.2) must survive verbatim. Extra traps:
   - `src/ui/panel/views/TasksView.tsx` contains the C14-pinned pair
     `title="No tasks yet"` / `Add one to plan your next focus session.` —
     do not reword it, and do not confuse it with the FocusScreen fix in N3.
   - The lock copy in FocusScreen (`You can stop any time with a
     confirmation.`, the password/phrase sentences) is pinned.
   - The onboarding fallback `Setup is saved. Open FocusGate from your
     browser toolbar to continue.` is pinned.
7. Banned UI copy words (must not appear in `src/ui` strings):
   `completely`, `instantly`, `cannot`, `always`, `guaranteed`.
8. No hex colors outside the two `:root[data-theme=...]` token blocks
   (`tests/ui/foundation.test.ts` enforces this — use tokens).
9. After every green run, append one line to `design-progress.md`:
   `2026-11-XX | Nitpick N<n> <name> | commit <sha> | CI run #<m> green`.
10. Stop and report (do not improvise) if: a fix would break a pinned string,
    a listed line number no longer matches the code, or the same batch is red
    twice for reasons the instructions do not cover.

Do not touch: `src/background/worker.ts`, `src/shared/**`, the manifest
routing (already cut over), `scripts/build-extension.mjs`, any file not named
in a batch.

---

## N1 — Functional loose ends from the cutover

Commit: `Nitpick N1: dashboard hash routing and firefox sidebar click`

**N1.1 The panel gear lands on the wrong tab.**
`src/ui/panel/PanelPage.tsx` line 70 opens `dashboard.html#settings`, but
`src/ui/dashboard/DashboardPage.tsx` never reads `location.hash` — the
dashboard always opens on Overview.

Fix in `DashboardShell` (add `useEffect` to the existing react import):

```tsx
useEffect(() => {
  const hash = window.location.hash.replace("#", "");
  if ((["overview", "rules", "reports", "settings", "data"] as const).some(
    (value) => value === hash,
  )) {
    setTab(hash as DashboardTab);
  }
}, []);
```

**N1.2 In Firefox the toolbar button does nothing.**
There is no `default_popup` any more. On Chromium, `setPanelBehavior` opens
the panel. On Firefox there is no `sidePanel` API — the sidebar must be
opened via `sidebarAction.open()`, and nothing wires the action click.

In `src/background/chrome.ts`, replace the existing `setPanelBehavior`
try-block (just before `return createWorker(api);`) with:

```ts
// The toolbar action opens the side panel on Chromium 116+; on Firefox the
// sidebar API is used instead. Feature-detected, never throwing.
try {
  const globalChrome = (globalThis as unknown as {
    chrome?: {
      sidePanel?: {
        setPanelBehavior(options: {
          openPanelOnActionClick: boolean;
        }): Promise<void>;
      };
      sidebarAction?: { open(windowId: number): Promise<void> };
      action?: {
        onClicked?: {
          addListener(listener: (tab: { windowId: number }) => void): void;
        };
      };
    };
  }).chrome;
  if (globalChrome?.sidePanel?.setPanelBehavior) {
    void globalChrome.sidePanel.setPanelBehavior({
      openPanelOnActionClick: true,
    });
  } else if (globalChrome?.sidebarAction?.open && globalChrome.action?.onClicked) {
    globalChrome.action.onClicked.addListener((tab) => {
      void globalChrome.sidebarAction?.open(tab.windowId);
    });
  }
} catch {
  // Feature-detected: no side panel or sidebar API, nothing to configure.
}
```

Verify: CI green (typecheck covers `src/background`). No unit test changes.

---

## N2 — Two regressions against the design contract

Commit: `Nitpick N2: restore the about links and the side-panel hint`

**N2.1 The About links were over-deleted in P7.**
design.md §6.2 keeps `focusflowpc.pages.dev` / `focusflowapp.pages.dev` **in
the Settings About card** (they must only stay out of the block page). The
P7 cutover deleted the popup and the C40 test was rewritten to ban them from
the entire UI — the links are now gone from the product entirely.

1. In `src/ui/dashboard/DashboardSettings.tsx`, inside the final
   `Card title="About FocusGate"`, after the muted paragraph add:

```tsx
<div className="fg-wrap">
  <a href="https://focusflowpc.pages.dev" target="_blank" rel="noreferrer">
    FocusGate PC
  </a>
  <a href="https://focusflowapp.pages.dev" target="_blank" rel="noreferrer">
    FocusGate App
  </a>
</div>
```

2. In `tests/claims.test.ts`, rewrite the C40 block so it asserts: the block
   page contains neither link, AND `src/ui/dashboard/DashboardSettings.tsx`
   contains both. (This restores the claim's original intent.)

**N2.2 The pinned side-panel hint is missing.**
design.md §6.1 pins the string
`The panel can sit on either side of the window — drag it where you like.`
(note the em dash). It exists nowhere in `src/ui`.

Add it to `DashboardSettings.tsx` inside the Appearance `Card`, directly
under the two fields, as:
`<p className="fg-field__helper">The panel can sit on either side of the window — drag it where you like.</p>`

Verify: CI green; grep `drag it where` finds the string once in `src/ui`.

---

## N3 — Focus empty state and onboarding step semantics

Commit: `Nitpick N3: focus empty state copy and step announcement`

**N3.1 FocusScreen "Up next" empty state is off-copy-deck.**
`src/ui/panel/views/FocusScreen.tsx` ~line 636 renders a quiet Button reading
`Nothing scheduled — add a task.` The copy deck (§6.1) specifies an
EmptyState: title `Nothing scheduled`, description
`Add a task to plan your next focus session.`

Replace the whole `: ( <Button ...> ... </Button> )` fallback branch with:

```tsx
) : (
  <EmptyState
    icon={<CalendarPlus aria-hidden="true" />}
    title="Nothing scheduled"
    description="Add a task to plan your next focus session."
  />
)}
```

`EmptyState` already accepts `icon`/`title`/`description`. Keep the card's
`actions` Add-task button as is. **Do not touch TasksView's strings (trap in
rule 6).**

**N3.2 The onboarding step dots announce nothing useful.**
`src/ui/onboarding/OnboardingPage.tsx` ~line 288: the dots container carries
`aria-live="polite"` + an `aria-label` — screen readers hear dot noise, and
the "Step X of 4" text exists only in an attribute.

Change to:

```tsx
<div className="fg-dots">
  <span className="fg-sr-only" aria-live="polite">
    Step {step + 1} of 4
  </span>
  {[0, 1, 2, 3].map((dot) => (
    <span
      key={dot}
      className={`fg-dot${dot === step ? " fg-dot--active" : ""}`}
    />
  ))}
</div>
```

(The `.fg-sr-only` class is added in N4. If you do N3 before N4, add the
class in N4's CSS yourself in the same commit — order N3/N4 may be swapped,
but each commit must be self-consistent and green.)

---

## N4 — CSS contract violations

Commit: `Nitpick N4: inline styles out, shell dedupe, sr-only utility`

**N4.1 Duplicate `.fg-full-page`.** `src/ui/styles.css` defines it twice:
line ~155 (with the accent radial gradient) and line ~999 (plain). The later
plain block wins, so the intended soft glow is dead and the two fight.
Delete the **later** plain `.fg-full-page` block (keep `.fg-full-page__inner`
which sits next to it, keep the gradient definition at the top).

**N4.2 `.fg-sr-only` utility.** Add once to styles.css:

```css
.fg-sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}
```

**N4.3 `hidden` headings are invisible to screen readers too.** The
`hidden` attribute removes elements from the accessibility tree — the four
dashboard `h1`s are dead weight. Replace `hidden` with the class on exactly
these (keep the ids):
- `DashboardStats.tsx` ~97 `Overview`
- `DashboardPage.tsx` ~145 `Reports`, ~317 `Data`
- `DashboardSettings.tsx` ~193 `Settings`

i.e. `<h1 id="..." className="fg-sr-only">...</h1>`.

**N4.4 Inline styles → classes.** These are the static offenders (the
dynamic ones — `Progress` width %, `ProgressRing` size — are fine and stay):

| Where | Inline | Replace with |
|---|---|---|
| `primitives.tsx` ~570 Sheet footer | `style={{ marginTop: "var(--gap)" }}` | new class `.fg-sheet__footer { margin-top: var(--gap); }` |
| `RulesScreen.tsx` 142, 407, 428, 718; `FocusScreen.tsx` 688; `YouScreen.tsx` 152 | `style={{ width: 16, height: 16 ... }}` on lucide icons | class `fg-icon-16` (`svg.fg-icon-16 { width: 16px; height: 16px; flex: none; }`) |
| `FocusScreen.tsx` ~638 CalendarPlus | `style={{ width: 24, height: 24 }}` | class `fg-icon-24` |
| `RulesScreen.tsx` 145, 483; `FocusScreen.tsx` 661; `YouScreen.tsx` 373 | `style={{ flex: 1 }}` on inputs | class `fg-grow` (`.fg-grow { flex: 1; min-width: 0; }`) |
| `RulesScreen.tsx` 479, 561 | `style={{ paddingTop: 8 }}` | class `fg-stack--offset` (`.fg-stack--offset { padding-top: 8px; }`) |
| `RulesScreen.tsx` ~1143 | `style={{ gap: 6, paddingBottom: 8 }}` | wrap in `fg-stack` + class `fg-stack--offset` (gap already var) |
| `FocusScreen.tsx` ~842 | `style={{ marginRight: 8 }}` | class `fg-mr-8` (`.fg-mr-8 { margin-right: 8px; }`) |
| `YouScreen.tsx` ~383 | `style={{ flex: "none", width: 64 }}` | class `fg-w-64` (`.fg-w-64 { flex: none; width: 64px; }`) |
| `YouScreen.tsx` ~81 week-chart svg | `style={{ width: "100%", height: 110, color: "var(--accent)" }}` | reuse `className="fg-stats-chart"` (N6 restyles it) |
| `primitives.tsx` ~100–101 (Card header) | `justifyContent` / `gap: 2` | leave as is (noted, acceptable) — do NOT change Card |

After the sweep, `grep -rn 'style={{' src/ui` may only match:
`primitives.tsx` lines ~100/101 (Card header), the `Progress` width span, and
the `ProgressRing` size style. Anything else static, convert the same way.

---

## N5 — Finish the kit migration (three components)

Commit: `Nitpick N5: tasks, habits, and achievements on the shared kit`

Only these three files still render legacy classes visibly:

1. `src/ui/panel/views/TasksView.tsx` — its root is
   `<section className="fg-page" aria-labelledby="tasks-title">` with an
   `fg-page__heading` block. Replace the wrapper with
   `<section className="fg-stack" aria-labelledby="tasks-title">` and put a
   `<SectionLabel>Tasks</SectionLabel>` above the first card (import it from
   `../../components/primitives.tsx`). Keep the h1 if present, converted to
   `className="fg-sr-only"`. **Do not touch any logic, form, or string.**
2. `src/ui/dashboard/HabitsCard.tsx` — `.fg-list` / `.fg-list-item` rows →
   `ListRow` (title = habit name, sub = the muted line, actions = the
   existing buttons). Keep the add-habit form markup as is.
3. `src/ui/components/AchievementsCard.tsx` — same: each achievement becomes
   a `ListRow` with the unlocked/locked state as `status` (unlocked →
   `<Chip tone="live">Unlocked</Chip>`, locked → muted text `Locked`).
   Keep the card title and counts.

Then, only if `grep -rn "fg-page\b\|fg-list\b\|fg-list-item\b" src/ui`
returns nothing (excluding styles.css), delete the `.fg-page`,
`.fg-page__heading`, `.fg-list`, `.fg-list-item*` rule blocks from
styles.css. If the grep still finds users, leave the CSS and say so in the
log line.

`fg-grid-two`, `fg-card__desc`, `fg-stats-focus*`, `fg-usage-cell` stay —
they are sanctioned helpers now.

---

## N6 — Charts must not stretch

Commit: `Nitpick N6: charts stop stretching horizontally`

`DashboardStats.tsx` (~166): the svg has `preserveAspectRatio="none"` plus
CSS `width: 100%` — on the 7-day range the 168-unit viewBox is stretched to
~800px, so bars and the day labels distort badly.

1. Remove `preserveAspectRatio="none"` and add explicit size attributes:
   `width={chart.length * 24} height={130}` (keep the viewBox and aria-label).
2. In styles.css change `.fg-stats-chart` to:

```css
.fg-stats-chart {
  display: block;
  margin: 0 auto;
  max-width: 100%;
  height: auto;
  color: var(--accent);
}
```

3. `YouScreen.tsx` (~80): drop the inline style (N4 already moved it), set
   `className="fg-stats-chart"` and add `width={week.length * 28} height={120}`
   alongside the existing viewBox. Bars keep `fill="currentColor"`.

No test changes.

---

## N7 — Selection, hover, and focus parity

Commit: `Nitpick N7: selection and hover states, link focus`

In styles.css:

1. Onboarding/goal select rows — extend the existing blocks:

```css
button.fg-row:hover {
  border-color: var(--text-subtle);
}
button.fg-row[aria-pressed="true"] {
  border-color: var(--accent);
  background: var(--surface-2);
}
```

2. Links currently have no visible keyboard focus. Add next to the existing
   `button:focus-visible` rule:

```css
a:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
```

3. (Optional, skippable) Give `Sheet` the same focus trap `Modal` has by
   reusing its FOCUSABLE list. If this is not a clean lift-and-shift, skip it
   and note "Sheet trap skipped" in the log line — do not hand-roll a new
   trap.

---

## N8 — Token spacing in the new sections + final sweep

Commit: `Nitpick N8: token spacing and final sweep`

1. In the P5/P6 CSS sections (block page, onboarding, dashboard hardening —
   the blocks after the `design.md §5.5` comment), replace raw margins with
   token math (sizing like `width: 96px` stays):
   - `.fg-block-brand` margin `0 auto 24px` → `0 auto calc(var(--gap) * 2)`
   - `.fg-block-btnrow` `margin-top: 24px` → `calc(var(--gap) * 2)`
   - `.fg-block-count-label` `margin: 16px 0 0` → `var(--gutter) 0 0`
   - `.fg-dots` `margin: 0 0 20px` → `0 0 var(--gutter)`
   - `.fg-onboard-head` `margin-bottom: 20px` → `var(--gutter)`
   - `.fg-onboard-actions` `margin-top: 16px` → `var(--gutter)`
2. Final sweep — all must be clean before the last push:
   - `grep -rn "console.log" src/ui` → nothing
   - `grep -rniE "\b(completely|instantly|cannot|always|guaranteed)\b" src/ui --include "*.tsx"` → nothing
   - `grep -rn "fg-popup" src/ tests/` → nothing
   - `grep -rn "hidden>" src/ui` → nothing
   - `grep -rn "width: 380px" src/ui/styles.css` → nothing
   - CI green including `tests/ui/foundation.test.ts` (tokens + no hex
     outside theme blocks) and `tests/ui/panelRender.test.tsx`.

---

## Done report

When N1–N12 are green, reply with: the list of batch commits + run numbers,
which optional items were skipped, and anything that matched a stop rule.
Everything browser-visible beyond this list (fonts, colors, layout taste)
needs the owner's real-browser pass per design.md §11 — do not attempt it.

---

# Round 2 (issued 2026-11-02, verified against commit 07a56cf / run #132)

The batches below were found in a second, deeper pass. Same rules as §0.
Work in order N9 → N12, one commit + one CI gate each, one progress-log line
each. Line numbers refer to the tree as of commit 07a56cf — if a listed line
no longer matches, stop and report.

## N9 — CSS duplicates, orphans, and two silent visual bugs

Commit: `Nitpick N9: css dedupe, orphan removal, row spread, editable hover`

All edits in `src/ui/styles.css`. Deletion method: brace-matched rule
removal (the P7 technique) — when a rule's selector is a grouped list, only
remove it if **every** selector in the group is dead; if a live selector
shares the group, re-emit the live selector with the same body before
deleting. After the batch, `grep -c` each deleted class must return 0.

**N9.1 Duplicate `.fg-row` (silent Settings bug).** `.fg-row` is defined
twice: ~line 403 (legacy, includes `justify-content: space-between`) and
~line 1100 (foundation, no `space-between`). The later block wins, so the
seven+ bare `<div className="fg-row">` label/value rows in
`DashboardSettings.tsx` (Protection section, ~lines 594–646) render their
labels and values crammed left instead of spread apart.

1. Delete the early `.fg-row` block (~403) entirely.
2. In the foundation `.fg-row` block (~1100), add
   `justify-content: space-between;` after `align-items: center;`.
   (`ListRow` is unaffected — its `__copy` child is `flex: 1`.)

**N9.2 Duplicate `.fg-chip`.** Defined at ~593 (legacy: `background:
var(--surface-2)`, `min-height: 24px`) and ~1168 (foundation: `background:
none`, `height: 22px`). The later block is the design. Delete the early
block. Do not re-emit anything.

**N9.3 Dead editable-timer hover.** `HeroTimer` applies
`fg-hero__time--clickable` (styled at ~1205 with `cursor: pointer`), but the
hover rule targets the never-applied parent class:
`.fg-hero--editable .fg-hero__time:hover { color: var(--accent); }`
(~1363) plus `.fg-hero--editable .fg-hero__time { cursor: pointer; }`
(~1362) are dead. Replace both dead rules with one live rule next to the
existing `--clickable` rule:

```css
.fg-hero__time--clickable:hover { color: var(--accent); }
```

**N9.4 Orphan class deletion.** Each of these is defined in styles.css and
referenced nowhere in `src/` or `tests/` (verified by scan at commit
07a56cf). Delete every rule (and any group whose remaining selectors are
also dead) for:

```
.fg-brand
.fg-card__header
.fg-chip--accent
.fg-chip--warning
.fg-chip-list
.fg-chip-remove
.fg-dashboard-link
.fg-dashboard__main
.fg-divider
.fg-eyebrow
.fg-empty-state
.fg-header-status
.fg-modal__card
.fg-page--full
.fg-protection-dot
.fg-quick-block
.fg-quick-block-mode
.fg-report-sites
.fg-schedule-lists
.fg-segmented
.fg-segmented-wrap
.fg-stats-goal-ring
.fg-switch
.fg-switch__thumb
.fg-tabs
.fg-tabs--compact
.fg-toast-stack
.fg-toggle-row
.fg-toggle-row__copy
.fg-toggle-row__label
.fg-visually-hidden
.full-page__header
.is-on
```

**Do NOT delete** these scan matches — they are dynamically composed and
alive: `.fg-btn--danger-quiet` (composed from `fg-btn--${variant}`),
`.fg-status-dot--idle/--focus/--break/--block` (composed from
`fg-status-dot--${status}`), `.fg-toast--error/--success` (composed from
`fg-toast--${toast.tone}`), `.fg-hero--break/--warn` (composed in
`HeroTimer`), `.fg-chip--live/--lock/--danger` (mapped in `Chip`).
`fg-btn--icon`/`fg-btn--dense` are also composed. If a rule you are about to
delete contains one of these as a co-selector in a group, keep the group and
remove only the dead selector from the selector list.

Verification: CI green, and
`grep -n "fg-row {" src/ui/styles.css` returns exactly 1 match.

---

## N10 — The session debrief card is on the wrong screen

Commit: `Nitpick N10: session debrief moves to the You tab`

design.md §5.2 is explicit for the running state: "**No debrief card** (a
success toast ... appears after stop; **the full debrief lives on You** and
in `src/shared/debrief.ts`)." Today the opposite is true: FocusScreen renders
a `Card title="Session debrief"` on the idle screen (~line 578, gated on a
completed session within the last hour), and YouScreen has no debrief at all.

1. In `src/ui/panel/views/FocusScreen.tsx`: delete the debrief `Card` block
   (~lines 580–585), the `latestCompleted`/`debrief` computation
   (~lines 443–449), and the now-unused `sessionDebrief` import (line 5).
2. In `src/ui/panel/views/YouScreen.tsx`: add the debrief above
   `<ReflectionCard ... />`. YouScreen already imports
   `calculateStreaks`/`localDateKey` — add `sessionDebrief` from
   `../../../shared/debrief.ts` and compute:

```tsx
const latestCompleted = [...state.sessionHistory]
  .filter((record) => record.status === "completed")
  .sort((left, right) => right.endedAt - left.endedAt)[0];
const debrief =
  latestCompleted !== undefined &&
  Date.now() - latestCompleted.endedAt < 60 * 60_000
    ? sessionDebrief(latestCompleted)
    : null;
```

Render it exactly where the Focus card was, as:

```tsx
{debrief && (
  <Card title="Last session">
    <p className="fg-card__desc">{debrief.headline}</p>
    {debrief.pace && <p className="fg-card__desc">{debrief.pace}</p>}
  </Card>
)}
```

No test changes (no pinned strings involved).

---

## N11 — Switching panel tabs destroys in-progress work

Commit: `Nitpick N11: keep tab state across panel switches`

`PanelShell` renders `{tab === "focus" && <FocusScreen ... />}` etc., so
switching Focus → You → Focus unmounts and remounts every screen: a
half-filled site form, a typed keyword list, an edited duration — all gone.
The tab bar reads as navigation, not as a destructive action.

In `src/ui/panel/PanelPage.tsx`, mount all three screens once and hide the
inactive ones. Keep each screen's existing props and the outer
`.fg-stack`/`main` structure:

```tsx
<main
  className="fg-panel__main"
  id={`panel-${tab}-panel`}
  role="tabpanel"
  aria-labelledby={`panel-${tab}-tab`}
  tabIndex={0}
>
  <div className="fg-stack">
    <div hidden={tab !== "focus"}>
      <FocusScreen
        state={state}
        onOpenRules={() => setTab("rules")}
        onOpenTasks={() => setTab("you")}
      />
    </div>
    <div hidden={tab !== "rules"}>
      <RulesScreen state={state} />
    </div>
    <div hidden={tab !== "you"}>
      <YouScreen state={state} />
    </div>
  </div>
</main>
```

Notes: the `hidden` attribute also removes the inactive screens from the
accessibility tree and tab order — that is the desired behavior. FocusScreen
keeps its 1-second ticker while hidden; that is acceptable (same cost as
letting it run while visible). Do not lazy-mount, do not add CSS.

Check before pushing: `tests/ui/panelRender.test.tsx` renders FocusScreen
directly (not through PanelShell) — it is unaffected.

---

## N12 — Round-2 sweep additions

Commit: `Nitpick N12: round-2 sweep`

1. In `src/ui/onboarding/OnboardingPage.tsx` the goal rows are plain
   `<button className="fg-row fg-row--select">` inside a
   `role="group"` div with `aria-label="Focus goal"` — good — but the
   selected row gives no text alternative for screen readers beyond
   `aria-pressed`. That is acceptable; **do not change it**. Instead:
2. Extend the final sweep from N8 with these greps (all must be clean):
   - `grep -n "fg-eyebrow\|fg-brand\b\|fg-switch\|fg-tabs\b\|fg-visually-hidden" src/ui/styles.css` → nothing
   - `grep -c "fg-row {" src/ui/styles.css` → exactly 1
   - `grep -c "fg-chip {" src/ui/styles.css` → exactly 1
   - `grep -rn "Session debrief" src/ui` → nothing (N10 renamed it)
   - `grep -rn 'hidden={tab' src/ui/panel/PanelPage.tsx` → 3 matches (N11)
3. Run the full CI gate. Green → log line, then the Done report covering
   N1–N12.

---

*Round 2 issued 2026-11-02 by the reviewing agent; every item verified
against commit 07a56cf (CI run #132). Round 2 also re-confirms the Focus
empty state (N3.1), hint string (N2.2), and chart stretch (N6) findings
against this commit — they still stand.*
