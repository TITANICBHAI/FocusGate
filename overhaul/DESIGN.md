# FocusGate design brief: the gate board

For the coding agent and for the owner. `plan.md` says what to build. This file says how it looks and reads. `AUDIT.md` says why.
Where this file disagrees with the repo's `design.md` (v3), this file wins for the items in section 10. Everything else in `design.md` still holds (side-panel structure, shared components, class names, spacing variables, the one-primary-button rule).

## 1. The idea

FocusGate is a gate. A gate is open or closed, and anyone standing at it can tell which at a glance, what it is closed to, and when it opens. The UI is the little board next to a gate. Every screen answers four questions, in this order:

1. Is the gate closed right now?
2. What is closed?
3. Until when?
4. Can I change it?

Everything that does not help answer those is quiet.

What you will see in the finished UI:

- **One status strip** under the header is the board. It is the only place that uses colour and weight to say what is happening. It is the same strip on the panel and the dashboard.
- **Amber means "blocking right now".** Nothing else is amber.
- **Periwinkle means "press me".** It is the colour of the logo ring. One primary button per view, as before.
- **Green means open or on a break.**
- **Numbers look like signage.** Tabular figures, same width every second, so a countdown never wobbles.
- **Rows have a 3 px status bar on the left** instead of being boxed in cards. The bar says if that row is blocking right now.
- **One animation.** When blocking starts, the status bar closes from top to bottom (280 ms). Nothing else moves on its own.

Why this is TBTechs and not a template: it is built from the product's own word ("gate"), the logo's own colours, and the owner's own v3 line ("a calm, physical instrument"). There are no gradients, glows, emoji, mascots, confetti or cheering copy.

## 2. Colour

Keep the existing token names. Change only the values. `tools/contrast-check.mjs` holds the values and checks them the way `tests/ui/themeTokens.test.ts` does. Run `node tools/contrast-check.mjs --css` to print the exact lines.

| Token | Dark | Light | Meaning |
|---|---|---|---|
| `--bg` | `#0f1420` | `#f6f7fb` | page |
| `--surface` | `#151c2b` | `#ffffff` | panel, sheet |
| `--surface-2` | `#1d2638` | `#eceff6` | raised or hovered row |
| `--border` | `#2a3550` | `#c9d0e0` | hairlines |
| `--text` | `#e9edf6` | `#131a2b` | body |
| `--text-muted` | `#9aa6bd` | `#52607a` | secondary text |
| `--text-subtle` | `#8c98b0` | `#5b6882` | tertiary text (still 4.5:1) |
| `--accent` | `#7c83ff` | `#4349c9` | the primary action, the live timer fill, focus ring |
| `--accent-contrast` | `#0f1420` | `#ffffff` | label on a primary button |
| `--break` | `#4bd6a0` | `#0b7a53` | open, on a break, success |
| `--danger` | `#ff7b7b` | `#b42318` | stop, remove, reset |
| `--danger-contrast` | `#2a0708` | `#ffffff` | label on a danger button |
| `--warning` | `#ffb23e` | `#9a5800` | **blocking right now** (text, bar, chip) |
| `--warning-contrast` | `#2b1b00` | `#ffffff` | label on an amber chip |
| `--info` | `#5cc8e8` | `#0a6b8a` | neutral information |

Where to paste (all in `src/ui/styles.css`, lines 3 to 109 today). There are **four** copies, and a test compares them:

1. `:root, :root[data-theme="dark"]` (dark values; also keeps shape, rhythm and motion tokens)
2. `:root[data-theme="light"]`
3. `:root[data-theme="system"]` (must equal the dark colour tokens)
4. `@media (prefers-color-scheme: light) { :root[data-theme="system"] { … } }` (must equal the light colour tokens)

Rules that the tests enforce (`tests/ui/foundation.test.ts`, `tests/ui/themeTokens.test.ts`):

- Hex colours appear **only** inside those blocks. Anywhere else use `var(--token)`.
- Do not put `{` or `}` inside a token block.
- `--info` and `--break` must exist in every block even if little uses them.
- `text`, `text-muted`, `text-subtle`, `accent`, `danger`, `warning`, `info` reach 4.5:1 on `bg`, `surface` and `surface-2`.

Usage rules:

- Text and thin lines in amber use `--warning`. A filled amber chip or bar uses `--warning` with `--warning-contrast` for its label. (One token does both jobs in both themes; the values were chosen so it works.)
- A blue-ish `--info` and the periwinkle `--accent` must never sit side by side as two "colours". Use `--info` only for neutral notices.
- No tinted backgrounds made by mixing colours (`color-mix`, rgba of the accent). Use `--surface-2`.
- Body text is never coloured.

## 3. Type

- Family: `--font-ui: "Barlow", system-ui, -apple-system, "Segoe UI", sans-serif;` and `--font-num: "Barlow Semi Condensed", "Barlow", system-ui, sans-serif;` Barlow is a signage grotesque (the family that road and rail signs are drawn from), which is what the gate board needs. Both are SIL OFL fonts.
- Decision D2: do **not** add `@font-face` and do not download anything until the owner supplies the `.woff2` files in `public/fonts/`. A missing file logs a console error and fails the smoke test. Until then the stack falls back to the system font and everything still works.
- Replace the font declarations at `styles.css:125` (body) and `:572` (the `Inter` rule) with `var(--font-ui)`. The timer, stat values and countdowns use `var(--font-num)`.
- Use only `px` or `rem` in `font-size` and never below 12 (a test checks this; `em`, `%` and bare `var()` fail it).

| Role | Size / line | Weight | Used for |
|---|---|---|---|
| Timer | 72 / 1 (48 for the existing `--smallest` rule) | 600, `--font-num` | focus timer only. Keep the `fg-hero__time` class; a test looks for it. |
| Title | 28 / 32 | 600 | block page headline, stat values |
| Screen title | 20 / 28 | 600 | dashboard page heading |
| Heading | 16 / 24 | 600 | section titles, status strip headline |
| Body | 14 / 20 | 400 | everything else |
| Label | 13 / 18 | 500 | field labels, row meta |
| Micro | 12 / 16 | 400 | chart ticks, helper text |

- **Sentence case everywhere.** Delete every `text-transform: uppercase` and the matching `letter-spacing` (four places today: `styles.css` near lines 675, 829, 940, 1104). No eyebrows above headings.
- All numbers (times, counts, minutes, percentages) use `font-variant-numeric: tabular-nums`.
- Line length for prose: at most 60 characters on the dashboard.

## 4. Shape and depth

- Tokens: `--radius-ctl: 6px` (buttons, inputs, toggles), `--radius-card: 10px` (sheets, the timer card, dialogs). Tags (chips, the header status) use 4 px. Status bars use 2 px.
- Borders are 1 px `--border`. Separation comes from space, one hairline per group, and the `--surface` to `--surface-2` step.
- **No shadows** except `--shadow-pop` on popovers, sheets and dialogs. No glows. No gradients (the logo is the only gradient in the product).
- Focus ring: 2 px `--accent`, offset 2 px, on every interactive element (`:focus-visible`).

## 5. Layout

### Panel (the side panel, minimum width 300 px as the tests require)

```
┌────────────────────────────────┐  header 56 px: logo mark 24 px, "FocusGate" 16/600, status pill on the right
├▌───────────────────────────────┤
▌ Focus session is on.             status strip: 3 px bar on the left, headline 16/600,
▌ Ends 12:48 PM. Blocking 9 sites.   detail 14 muted, optional text button
├────────────────────────────────┤
│ (this tab, scrolls)            │
│                                │
├────────────────────────────────┤  tab bar 52 px: Focus | Rules | You
└────────────────────────────────┘
```

- **Status pill** (right of the header), text not a dot: `Not blocking` (muted), `Blocking` (amber, plus a lock icon when the session is locked), `Break` (green). 22 px tall, 4 px radius, 12/500.
- **Status strip** colours its bar: idle `--border`, break `--break`, focus or schedule or locked `--warning`. It has `role="status"`. Its button (if any) is a quiet or secondary button, never primary: `tests/ui/panelRender.test.tsx` requires exactly one primary button per Focus state (one when idle, none while running).
- **Sections** are a heading (16/600) and a group, separated by 24 px of space and at most one hairline. A card (`fg-card`) is kept only for: the timer, sheets, dialogs, the status strip's host. Do not delete the `.fg-*` foundation classes; restyle them (the foundation test lists them).
- **Row** (`fg-row`): minimum height 48 px, padding 10 px 16 px, 3 px left bar, title 14/500, meta 13 muted, trailing control at least 36 px high.
  - Site row: bar amber if that domain is blocking right now (use `computeBlockPlan(state, now)`; if the plan does not hand you per-domain state in a line or two of code, use `--border` and skip this), muted otherwise. Chips go under the title on narrow widths. **Nothing may overlap or truncate at 300 px** (AUDIT section 5: the `tiktok.com` row).
  - Schedule row: bar amber while that schedule is on now, muted otherwise; a disabled schedule is dimmed (`opacity: 0.6`) and its text still passes contrast because it keeps its own colour tokens (check with the tool before using opacity on text).
- Touch and click targets at least 36 px.

### Dashboard (full tab)

- Single column below 1100 px. From 1100 px: two columns, `minmax(0, 1fr)` and 340 px, 24 px gap, content width at most 1120 px.
- Right rail: the status strip's detail (not a second copy), schedule week strip, limits, protection status.
- Hero shows **today** (focused against goal). The weekly figure moves into the chart caption. Do not show the same number twice (AUDIT section 5).
- Charts: `WeekBars` (full width, weekday labels, value on today's bar and the tallest, text alternative). No tiny fixed-width bar chart.

### Block page

```
FocusGate                                 logo 20 px + name, 14/500 muted, top left

▌ Blocked by schedule: Study hours        28/600, 3 px amber bar on the left
▌ youtube.com                             16/500
▌ Ends 12:00 PM                           14 muted

  47:12                                   timer style, only for session or standalone (see below)

  Your reason                             13/500 muted label (only when the user wrote one)
  "I want to pass my board exams."        16/400

  [ Close tab ]  [ Open new tab ]         one primary (Close tab), one secondary

  3 pages blocked today.                  13 muted
```

- Left-aligned in a single column, `max-width: 480px`, vertically a little above centre. Do not centre the text.
- The countdown shows only when `reason.kind === "session" || reason.kind === "standalone"` (this exact expression is pinned by `tests/claims.test.ts`). Keep `state.dayStats[dateKey]?.blocks`, `chrome.tabs.getCurrent()` and `chrome.tabs.remove(current.id)` exactly as they are. No promo links on this page.
- Keep all seven `case "…"` reason branches.

## 6. Components (restyle, do not rename)

| Component | Spec |
|---|---|
| Button | height `--btn-h`; primary = `--accent` fill with `--accent-contrast`; secondary = `--surface-2` fill, 1 px border; quiet = text only; danger = `--danger` fill, only on destructive confirm. Label is a verb: "Start focus", "Save schedule". No arrows, no trailing icons that repeat the label. |
| Toggle | `role="switch"` with `aria-checked`. Track 36 x 20, thumb 16, 120 ms move. On = `--accent` track. |
| Segmented | buttons with `aria-pressed`. Selected = `--surface-2` fill + 1 px `--border` + `--text`; unselected = transparent + `--text-muted`. |
| Chip | 22 px tall, 4 px radius, 12/500, sentence case. Tones are the union in `primitives.tsx` after T0.5 (neutral, accent, warning, danger, live, lock). `lock` is the amber "blocking" tag, `live` is the running state. Do not add tones. A chip never carries more than 2 words. |
| Sheet | slides in 160 ms (answers a tap, so it may move). `--radius-card` top corners, `--shadow-pop`. The first field is focused. Escape closes. |
| Toast | bottom, 4 s, text only, one line. No icon-plus-title-plus-body stacks. |
| Empty state | one sentence saying what is missing, one sentence saying what to do, one button that does it. No illustration. |
| Progress | thin (6 px) bar, `--accent` fill on `--surface-2`; always has an `aria-label` that names what it measures. |
| Week strip | see `plan.md` T2.2. 7 rows (Monday first), spans in `--warning`, now marker in `--text`, text alternative per row. |

## 7. Motion

- Not allowed: entrance fades or slides on sections, hover transitions on every card, bouncing, parallax. Remove existing ones (`grep -rn "motion" src/ui`).
- Allowed because it answers a tap: sheet open (160 ms), toggle (120 ms), dialog open (160 ms), a button's pressed state.
- **The one signature moment, "the gate closes":** when the status tone changes from idle or break to focus, schedule or locked, the strip's bar scales from `scaleY(0)` to `scaleY(1)` from the top over 280 ms with `var(--ease)`. Implementation: `StatusStrip` remembers the previous tone in a ref, and adds the class `fg-strip--closing` for 300 ms only when the tone changes into a blocking tone (never on first render). The keyframes live inside `@media (prefers-reduced-motion: no-preference)`. Add a `--dur-gate: 280ms` token beside `--dur-fast`.
- `@media (prefers-reduced-motion: reduce)` already exists in `styles.css` (a test needs the string). Keep it.

## 8. Icons

- App icon: `assets/icons/icon-{16,32,48,128}.png` from this pack. The old files have opaque white corners; these are cleaned and transparent. Do not redraw the logo.
- In the UI keep `lucide-react`. Sizes 16 (inline), 18 (in buttons), 20 (header). `strokeWidth={1.75}`. Outline only. No emoji anywhere in the UI.

## 9. Copy

### 9.1 Voice

- Sentence case. Plain verbs. Facts, not cheering. Say what is happening, then what you can do.
- No exclamation marks. No "Oops", "Awesome", "Welcome back", "You've got this", "Let's go".
- Never use these words (the repo's own rule; check with `grep -rniE "\b(completely|instantly|cannot|always|guaranteed)\b" src/ui --include "*.tsx"`): *completely, instantly, cannot, always, guaranteed*. The one allowed exception is the existing list name `Always` exactly as the Rules screen already spells it ("Always list").
- Errors do not apologise and are never vague. They say what happened and what to do.
- One name for one thing: **Focus session**, **Block now**, **Focus list**, **Always list**, **Schedule**, **Daily limit**, **Break**, **Lock** (None, Strict, Commit). Do not invent synonyms.
- Times use the user's locale (`toLocaleTimeString`, hour and minute only).

### 9.2 Strings that already exist and must not change (tests pin them)

- `You can stop any time with a confirmation.`
- `There is no early-stop action. You can still disable or remove the extension.`
- `Stopping early needs your password. You can still disable or remove the extension.`
- `Stopping early needs the phrase “I GIVE UP” and a 15-second wait. You can still disable or remove the extension.`
- Empty tasks: title `No tasks yet`, text `Add one to plan your next focus session.`; `This task is linked to the running session.`
- Onboarding: `Open FocusGate`, `Setup is saved. Open FocusGate from your browser toolbar to continue.`, `Check browser access`, `Incognito access`, `Website access`, `Notifications`.
- The default block-page message stays `Stay focused. You've got this.` in `src/shared/defaults.ts` (a fixture and a test pin it). The block page simply stops showing the default (plan T4.3).

### 9.3 New strings (use verbatim)

Header status pill: `Not blocking` · `Blocking` · `Break`

Lock explainer (plan T3.3). Each row is the pinned sentence from 9.2, then one new sentence:

| Lock | New second sentence |
|---|---|
| None | `You can add, change or remove rules at any time.` |
| Strict | `You can add rules, but not remove or relax them until the session ends.` |
| Commit | `You can add rules, but not remove or relax them until the session ends.` |

Schedules (plan T2.x):

| Where | String |
|---|---|
| Card title | `Schedules` |
| Description | `Block sites on a weekly timetable. Schedules start and stop on their own, so you don't need to start a session.` |
| Empty title | `Block sites on a timetable` |
| Empty text | `Pick a starting point. You can change the days, times and sites afterwards.` |
| Templates | `Work hours` (Mon to Fri, 9:00 AM – 5:00 PM) · `Study` (Mon to Fri, 6:00 PM – 9:00 PM) · `Sleep` (every day, 10:00 PM – 7:00 AM) · text button `Start from scratch` |
| Row chip while on | `On now` |
| Warning on a row | `This schedule blocks nothing yet.` with button `Fix` |
| Sheet titles | `Add a schedule` · `Edit schedule` |
| Field labels | `Name` · `Days` · `From` · `Until` · `What should it block?` · `Sites` |
| Sites helper | `One site per line, like youtube.com.` |
| Day presets | `Weekdays` · `Weekends` · `Every day` |
| Block choices | `My Focus list (N sites)` · `Only these sites` · `My Focus list and these sites` |
| Validation | `Enter a name for this schedule.` · `Choose at least one day.` · `Add at least one site, or use your Focus list.` |
| Buttons | `Save schedule` · `Cancel` · `Delete schedule` |
| Delete dialog | title `Delete this schedule?` · text `{name} will stop blocking. This is permanent.` · buttons `Delete` and `Keep` |
| Toasts | `Schedule saved. ` + the status line · `Schedule deleted.` |
| Status lines | `On now: {name}, until {time}.` · `Next: {name}, {when} {time}.` · `No schedules yet.` · `All schedules are off.` |
| Targets | `Blocks your Focus list (N sites)` · `Blocks nothing yet. Your Focus list is empty.` · `Blocks nothing yet. Add sites to this schedule.` · `Blocks a.com, b.com` · `Blocks a.com, b.com, c.com and 2 more` · `Blocks your Focus list and 2 more sites` |

Profile (plan T4.2): tab label stays `You`. Name placeholder `Your name`. Heading `Your reason`; placeholder `Why are you doing this?`; helper `Shown on the block page.` Headings `What you're protecting`, `Today and this week`, `Achievements`, `Journal and tasks`. Protection rows: `Focus list`, `Always list`, `Keywords`, `Schedules`, `Daily limits`, `Default lock`, `Password` with values like `9 sites`, `None`, `Set` and `Not set`.

Block page (plan T2.5, T4.3, T5.6): headlines use the form `Blocked by …`: `Blocked by your focus session`, `Blocked by Block now`, `Blocked by schedule: {name}`, `Blocked by keyword: {keyword}`, `Blocked by your Always list`. Keep the existing wording for the allowance and allow-only reasons, but in sentence case. Detail line: `Ends {time}`. Labels `Your reason`. Buttons `Close tab` and `Open new tab`. Footer: `{n} {page|pages} blocked today.`

Errors and first run:

| Where | String |
|---|---|
| Crash screen | heading `FocusGate hit a problem` · text `This screen crashed. Your rules and data were not changed.` · button `Reload` · disclosure `Technical details` |
| Shortcut not set | `Not set. Another app or Chrome itself may be using this key.` |
| Shortcuts row | title `Keyboard shortcuts`, button `Change in Chrome` |
| About | `FocusGate v{version} by TBTechs` and the existing sentence `Your data stays in browser storage.` |

## 10. What this file overrides in `design.md` (v3)

| design.md says | Now |
|---|---|
| Accent is mint (`#34d399`); warning only for active locks and Block now | Accent is periwinkle; **amber means any blocking that is on now** (session, schedule, Always list, Block now) |
| `Inter, system-ui…` | `--font-ui` / `--font-num` (Barlow stack, system fallback) |
| Micro-labels 12 px caps | sentence case, no letter-spacing |
| `--radius-card: 14px`, `--radius-ctl: 8px` | 10 px and 6 px |
| Cards for each group | headed groups and rows; cards only where section 5 says |
| Break colour blue | `--break` is green; `--info` is the neutral blue |
| "Exactly one accent element" | still true: the accent is the primary button or the live timer fill, and the amber strip bar is not "accent" |
| Frozen: `src/shared/**`, `src/background/**` | unfrozen **only** for the files a task names in its Files line |

## 11. Do not

1. No gradients, glows, glass, blur, or soft grey drop shadows on cards.
2. No ALL-CAPS labels, no letter-spaced eyebrows, no numbered markers (the content is not a sequence).
3. No emoji, mascots, confetti, illustrations, stock cheer.
4. No card inside a card. No grid of identical stat cards.
5. No centred body text on content screens (the timer is the exception).
6. No information that only lives in a `title` attribute.
7. No placeholder used as a label.
8. No second primary button in a view.
9. No hex colour outside the token blocks. No `font-size` under 12 px.
10. No new dependency, no network call, no `alert`/`confirm`/`prompt`.
11. No "A · B · C" strings built with middle dots, no `WORD — fragment` labels, no `→` on buttons.

## 12. Visual checks before calling a phase done

- Panel at 300, 360 and 400 px wide, dark and light. Dashboard at 640 and 1280 px, dark and light. Browser zoom 200 % on both.
- Idle with nothing set up; idle with rules; focus session running; strict session running; break; a schedule on now; the block page for a schedule and for a session.
- `node tools/contrast-check.mjs` prints `all pairs meet their target`.
- If you cannot run a browser, say so in the tracker and list these screenshots as "needs owner".
