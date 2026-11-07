# FocusGate v1.1.0 — audit

Method: I built your zip, loaded the **real built extension** in Chromium (Playwright, unpacked), drove it with the same messages the UI sends, and watched what happened. Then I read the source behind every symptom. Raw proof is in `evidence/` (probe scripts, JSON results, screenshots).

Tags used everywhere: **[V]** verified by running it · **[R]** verified by reading code (file:line) · **[I]** inference, not executed · **[U]** unknown / not checked.

## Answer / Confidence / Caveats

**Answer.** "Half good, half bad" is accurate, and the bad half is worse than it looks: three things are *broken for every user right now*, and none of them is a design problem.

1. Every alarm throws (`name.startsWith is not a function`) → focus sessions never finish, schedules never end, weekly report / midnight rollover / task reminders / usage sampling never run. One-line fix, validated. [V]
2. The whole full-page dashboard (options page) is dead — two stacked crashes (missing `useState` import, then a `Date.now()` passed where a `Date` is required). Both fixed in a scratch copy; dashboard then renders on all 5 tabs. [V]
3. The first control on the Rules tab, **Check a URL**, blanks the entire side panel (`assessUrl` is never imported). [V]

Under those sits a quieter engine problem: edits made in the UI are not applied to the network-level blocker until some unrelated event happens, so new blocks leak for a moment and removed blocks keep blocking ("ghost blocks"). [V]

Your two product complaints are also real and have specific causes: the **schedule** is unexplained and under-built (no status, no edit, no site choice, hard-coded to "use my whole focus list"), and the **"You" tab is a stats/tasks/habits drawer, not a profile**. The look is competent but is the stock dark-mode SaaS kit (near-black + one bright green accent, identical rounded cards, ALL-CAPS micro-labels) with a logo whose colours don't match the UI.

**Confidence.** 0.95 on the three blockers and the engine findings (reproduced in a real browser; the fixes were re-tested). ~0.8 on UX/layout findings (I looked at the real screens at 320/400/640/1280 px in both themes, but not every state). ~0.65 on the design direction (taste + your brand decisions are involved).

**Caveats.** Not verified: notifications actually appearing, weekly-report content, content-script filters on YouTube/etc., daily-limit accumulation, browser-zoom behaviour, Windows shortcut behaviour. Details in §9. One claim from my first message is retracted in §8.

## 1. Scoreboard

| Area you asked about | Verdict | Conf. |
|---|---|---|
| Does it work as intended | Core blocker/DNR works; timers, dashboard, Check-a-URL broken (§2–3) | 0.95 |
| Visual design | Competent but generic; logo/UI palette mismatch; icon corners broken on dark | 0.75 |
| UI arrangement / hierarchy | Focus tab good; Rules/You squeeze at 400 px; dashboard = one long repetitive column | 0.8 |
| Side panel + full-screen page | Panel is the right primary surface; full page was dead, and after repair is stats-heavy | 0.8 |
| Interaction design | Solid primitives (confirm dialogs, disabled+reason); shortcut gaps; no feedback on schedule effects | 0.65 |
| UX: onboarding / empty / errors / a11y | Onboarding unreachable; empty states passive; a crash = blank panel; 8 axe rules fail | 0.85 |
| Responsiveness | No horizontal overflow 320–1280 px; rows squeeze and truncate at 400 px; zoom untested | 0.7 |
| Dark / light themes | Both consistent and persisted (`settings.theme`, default "system"); logo asset breaks on dark | 0.8 |
| Functionality presentation | Status is not surfaced; lock rules explained in scattered, hover-only places | 0.8 |
| Polish | "1 pages blocked", truncated task titles, 196 px chart, ALL-CAPS labels, generic block-page copy | 0.75 |
| Performance | UI render cost is tiny; background work unmeasured | 0.7 |

## 2. The crash you pasted

- **Where:** `background.js:2789` is `src/background/alarmHandler.ts:69`, `if (name.startsWith(TASK_REMINDER_ALARM_PREFIX))`. [R]
- **Why:** `src/background/chrome.ts:175` hands `chrome.alarms.onAlarm` to the worker unadapted. Chrome calls alarm listeners with an `Alarm` **object** (`{name, scheduledTime, periodInMinutes}`); the worker expects a string. The local type on line 67 (`onAlarm: ChromeEvent<string>`) tells the compiler something false, so nothing caught it. The adapter helper `adaptEvent` (chrome.ts:141–163) already exists and is used for three other events. [R] Reproduced: listener argument was an object with keys `name, scheduledTime`; error text identical to yours. [V probe1]
- **Because it is the first line of the handler, every alarm throws before doing anything.**
- **What that broke (all observed on the shipped build, probe3):**
  - A 1-minute strict session, 8 s after its end: still `status: work`, **no history record, no focus time credited, lock still "strict"**, panel frozen on `00:00`, and the user is refused with `LOCKED`. After the fix: session recorded (`sessionsCompleted 1`, `focusMs 60000`), break phase starts, rules editable. [V]
  - A schedule window that has ended: the DNR rule for it was **still installed 20 s after the end**, and the block page itself said "BLOCK ENDED — no longer blocked" while still redirecting. After the fix the rule is removed. [V]
  - Same handler also gates weekly report, midnight rollover, task reminders and usage sampling (`tick → attention.sample`). They could not have run. [R] After the fix they run without errors; whether a report/notification actually appears I could not confirm headless. [U]
- **Fix (validated):** `onAlarm: adaptEvent(chrome.alarms.onAlarm, (alarm) => alarm.name)` plus the corrected type. See `evidence/p0-reference.patch`.
- **Why nobody saw it:** effect errors are swallowed — the browser API object has no `onError` (`chrome.ts`, `worker.ts:170–171` calls `api.onError?.()`), and `onAlarmListener` is `void handleAlarm(name)` with no `.catch` (`worker.ts:455–457`). Tests fake alarms as plain strings. [R]

## 3. Broken right now (besides the alarm bug)

| # | What | Proof |
|---|---|---|
| B1 | **Dashboard/options page never renders.** `DashboardPage.tsx:1` imports `Component, useEffect` but uses `useState` (lines ~87, 221–228) → "FocusGate could not start". After fixing, `HabitsCard.tsx:20` calls `localDateKey(Date.now())`; the helper takes a `Date` → `getFullYear is not a function` → same screen again. | [V] probe1, probe5. Fixed copy renders all tabs, 0 console errors. |
| B2 | **Check a URL blanks the side panel.** `RulesScreen.tsx:105` calls `assessUrl`; line 11 imports only `computeBlockPlan`. The panel has no error boundary (only the dashboard has one: `DashboardPage.tsx:40`), so React unmounts everything. | [V] probe5: `pageerror: assessUrl is not defined`, screenshot is a blank panel. |
| B3 | **Why none of this was caught:** `src/ui` is not type-checked (`tsconfig.json` include list omits it); checking it gives **30 errors** incl. B2 (`evidence/ui-typecheck-30-errors.log`). No test loads the built pages. | [V] |
| B4 | **UI edits don't reach the network blocker.** Guarded writes (`worker.ts:366`, no `afterChange`) and quick-block `addSites` (`worker.ts:391–395`) never call reconcile, and the 1-minute `tick` only re-arms alarms (`alarms.ts:41–93`, `alarmHandler.ts:89–107`), it does not reconcile. Observed on the **repaired** build (probe6): (a) always-site added → DNR unchanged, page still blocked by the slower webNavigation fallback, but **the site's server received 2 requests first**; (b) site removed after a legit reconcile → DNR rule still there after a full tick, navigation still redirected to a page that says **"BLOCK ENDED — no longer blocked"**, and its "Open ghost.test" button loops back. A ghost lasts until the next boundary/session/standalone event (boundary defaults to next midnight with no schedules [V fresh-install alarms]; so up to ~24 h [I]). | [V] probe6 |
| B5 | **Expired session still counts as active in read-side logic.** `computeBlockPlan` and `lockSource` use `status === "work"` without `phaseEndsAt > now`; the only place a session is transitioned is `session.ts recoverLocked`, reached from start/stop/extend/skipBreak/handleAlarm/recover/install. If the alarm is late (browser closed, laptop asleep) blocks and locks outlive the session. | [R] — not executed; write the failing test first. |
| B6 | **No startup recovery.** Nothing in `src/background` listens to `runtime.onStartup` or re-arms alarms/reconciles when the service worker starts. Chrome documents that alarms are *not guaranteed* to survive a browser restart. | [R] no handler; [U] whether alarms are actually cleared on restart. |
| B7 | **Future schedules do work** once the alarm bug is fixed: saved via the UI path 3 min before start → `boundary` alarm re-armed by the next tick (00:00 → 10:37:00), rule installed at start, 0 requests reached the site. (Schedules that are *already active when saved* rely on the leaky fallback — B4.) | [V] probe6 |

## 4. Your specific complaints

### 4.1 "The schedule feature is basically useless — it does nothing or nobody knows what it is"
Both, for different reasons.
- **It really did "nothing" at the moments that matter** (end of window never lifted — §2; start only via the leaky fallback if saved while active — B4). [V]
- **Nobody can tell what it is.** The form (`RulesScreen.tsx:827–862`) asks for name, days, start, end and then **hard-codes `sites: []`, `keywords: []`, `useGlobalLists: true`** (lines 849–851). So a schedule silently means "switch my whole focus list on during these hours". The data model supports per-schedule sites/keywords (`types.ts:37`, `plan.ts:242–243`) but there is **no UI to set them**. The card says only "Block your rules on the days and hours you choose." [R]
- **No status anywhere.** `ui/lib/scheduleStatus.ts` exports `activeScheduleAt` but **nothing imports it** (grep) — the UI never says "active now" or "next starts Monday 9:00". [R]
- **No edit** — each row has only a switch and Delete (lines 903–941). Changing a time means delete + recreate. [R]
- **Layout:** the switch's accessible label is rendered as visible text ("Enable Study hours"), starving the title column: names truncate ("Night …"), days wrap onto 4–7 lines, times are raw 24 h. [V screenshot `fx-panel-rules-schedule-seed.png`]
- **Misleading helper:** End field says "24:00 means midnight", but `<input type="time">` cannot produce `24:00`. [I]
- **Empty state** is two plain lines and a button; no example, no explanation, large dead space. [V `…schedule-EMPTY.png`]

### 4.2 "The profile page is more like stats"
Confirmed. The **You** tab = Today stats, week chart, last-session debrief, full Tasks manager, Reflection, Achievements chips, Habits, "Open full dashboard". No identity, no goal statement, no "what am I protecting", no commitment summary. [V `fx-panel-you-seed.png`, R `YouScreen.tsx:69–176`]
Also: task titles truncate to ~7 characters ("Write t…") because four buttons share the row; dates show as raw `2026-11-03`; the week chart is a fixed 196 px SVG with 9 px labels in a ~350 px card. [V]
Data risk: panel "this week" reads `dayStats` (`YouScreen.tsx:45–53`), dashboard "this week" reads `sessionHistory`. In my seeded run they disagreed (8 h 40 m vs 4 h 28 m) — **I seeded them independently, so this proves two sources of truth, not a real-world bug** [I].

### 4.3 "Talk clearly to the user about what's going on, and let them change it until our certain mode works"
My reading (please correct me): *the user can edit rules freely until a lock level (Strict / Commit) is active; the UI must say plainly what is on, what is locked, why, and until when.* Today:
- No "what is happening now" surface. The header shows a small **unlabeled dot** (grey when idle). [V]
- Lock reasons exist but are scattered: disabled buttons explain via `title` tooltips (hover only); one visible sentence on the Rules tab ("Locked until 12:42 AM by your strict session. Additions that strengthen protection remain available."). [V probe3]
- The Focus tab's lock selector has one helper line for None/Commit (`FocusScreen.tsx:53–57`) and nothing that compares the three modes side by side. [R]
- Background replies use a raw timestamp: `LOCKED: "Locked until 1793666558837 by your strict session."` (`gating.ts`). The UI path formats it properly, so users rarely see it. [V]
- Empty first run says "Nothing is blocked yet — add sites in Rules." with no button, and **Start focus is enabled with an empty list**. [V `panel-tab-focus-400-tall-dark.png`]

## 5. Area-by-area

**Visual design.** Tokens are tidy (`styles.css:3–109`, dark/light/system) but the look is the generic kit: near-black `#0b0d0c` + single mint `#34d399`, same 14 px card radius everywhere, ALL-CAPS 11 px labels (SESSIONS / COMPLETED / CLEAN…), centred hero number. [V] **Logo vs UI:** the icon is a blue→violet ring on dark; the UI accent is mint — two unrelated palettes. [V] **Icon files have opaque white corners** (RGBA 255,255,255,255 at the corners of the 48/128 px PNGs; ~251 at 16 px), so the logo shows white notches on every dark surface (panel header, block page, onboarding). [V pixel read + screenshots; fixed assets in `assets/icons/`, before/after in `evidence/shots/icons-before-after-on-dark.png`] **Fonts:** body is `system-ui` (`styles.css:125`), a component rule asks for `Inter` (`:572`), and no font file ships (`dist/assets` has none) → looks different per machine. [V]

**UI arrangement.** Focus tab: clear hierarchy (timer → durations → lock → Start). Rules/You: stacks of identical cards; at 400 px the row pattern breaks (schedule, tasks, site chips — "Always" + "Schedule: Study hours" chips overlap on the tiktok.com row). [V] Dashboard (after repair): single centred column; the same stats repeat (completion rate twice, total focus time repeats the hero); hero says **"This week focus time"** but its progress bar is **"79% of today's 120 min goal"** — two scopes in one block; **Focus score 58** is unexplained; **"Protection gaps"** is jargon; six achievements all say "Locked" with no progress; the bar chart is ~130 px wide with unreadable day-of-month labels. [V `fx-dash-seed-overview-dark.png`]

**Sidebar / full-screen.** Toolbar click opens the side panel (`panel.html`); full page is `dashboard.html` (options, `open_in_tab`). Good split. The full page is the one that was dead (B1) and, repaired, does not use the width (single column) and has no status header. [V]

**Interaction.** Good: Delete has a confirm dialog; locked controls are disabled with a reason; toasts exist; guarded writes return typed errors. Weak: `Toggle` and `Segmented` use invalid ARIA (§6); shortcuts: `toggle-focus` = Alt+Shift+F assigned, **`block-current-site` (Alt+Shift+B) was UNASSIGNED** in Chromium/Linux, `_execute_action` unassigned [V probe2/smoke]; I suspect Alt+Shift+B collides with a reserved browser accelerator on Windows/Linux [I — check on your Windows Chrome]. No keyboard shortcut or menu explains the lock modes.

**UX.** Onboarding exists (4 steps, `OnboardingPage.tsx`) but **nothing opens it**: install opens no tab (`tabsOpenAfterInstall: ["about:blank"]`), and the only link to it is the dashboard's "Run setup" (`DashboardPage.tsx:114`) — which was dead. [V/R] Block page: reason + countdown + "Close tab / Open new tab" are good; the line **"Stay focused. You've got this."** is the same for every reason, and **"1 pages blocked today"** is a pluralisation bug. [V text capture, probe2/3/6]

**Accessibility (axe-core, real pages).** Panel: `aria-allowed-attr` critical ×3, `aria-required-parent` critical ×3, `aria-progressbar-name` serious, `label-content-name-mismatch` serious, `aria-allowed-role`, `landmark-one-main`, `page-has-heading-one`, `region`. Dashboard overview: `aria-allowed-attr` critical ×3, `aria-progressbar-name` ×2, `heading-order`, `label-content-name-mismatch`. **Dashboard Settings: `aria-allowed-attr` critical ×25.** [V probe1/5] Causes: `Toggle` sets `role="switch"` **and** `aria-pressed` (`primitives.tsx:226–228`); `Segmented` puts `aria-selected` on plain buttons (`:268`); tab bar has `role="tab"` buttons without a `tablist` (`PanelPage.tsx:101–109`); `<main role="tabpanel">` (`:78–83`); `Progress` has no accessible name; `h3` before any `h2`. CSS depends on those attributes (`styles.css:659, 894–895, 932–933, 1188`) so they must change together. [R]

**Responsiveness.** `scrollWidth > clientWidth` was false on every page I measured (panel 320/400, dashboard 640/1280, block 380/1000, onboarding 380/1000). [V] Squeeze, not overflow, is the problem (above). Browser zoom: not tested; font scale 90–120 % exists in settings (`theme.tsx`). [U]

**Themes.** Light and dark both rendered and look consistent; theme + font scale persist in `settings` and apply via `data-theme` (`theme.tsx`); default "system" follows `prefers-color-scheme`. [V/R] Only defect: icon corners (above).

**Performance.** While a timer runs the panel made **7 DOM mutations in 5 s** (just the clock, and one progress bar) — excellent. [V probe2] Fresh storage is 1.7 KB. [V] Bundles: `background.js` 202 KB (unminified), shared UI chunk 228 KB, panel 39 KB, dashboard 55 KB. [V] Unmeasured: service-worker cost of `explainBlock` reading full state on every navigation event (`blockNavigation.ts`). [U]

**Verification culture.** The repo has real tests and a disciplined `fixes/` process, but the bugs above all sit in places the process doesn't touch: untyped UI, mocked alarms, no built-page test, swallowed errors. Fix the *net*, not just the holes (plan Phase 0).

## 6. What it lacks (beyond the above)

Ordered by value to a user:
1. A **status line** that says what is blocking now, why, what can be changed, and until when (plan T3.1–T3.2).
2. **First-run flow**: open onboarding on install; empty states with the next action as a button (T3.5).
3. **"Why" on the block page** — the user's own sentence instead of a stock cheer (T4.1, T4.3).
4. **Schedule timetable** — a 7-day strip showing when gates are closed (T2.2); the single most useful answer to "what does this do?".
5. **Pause / snooze** with cooldown (not present anywhere — grep). Product decision because it conflicts with Strict/Commit: default off (D4).
6. **Per-schedule site lists** (the model supports them, the UI doesn't).
7. **A visible health/diagnostics line** in the panel: `state.health` (last heartbeat, rule count, skipped domains, last error) exists and is shown only in dashboard Settings (`DashboardSettings.tsx:633–656`). [R]
8. DNR robustness: one bad domain fails the single consolidated rule (id 1) and the fallback can't isolate it; non-ASCII domains are skipped instead of converted to punycode. [R] (backlog)
9. Brand/identity surface: About line with version, "by TBTechs", privacy sentence (T5.8).
10. Store screenshots (`store-assets/`) show the old UI — refresh after Phase 5.

## 7. What is good (keep it)

Pure, testable core (`computeBlockPlan`, `explainBlock`, `assessUrl`); a real lock model that held up in testing (weaken attempts refused under Strict, controls disabled with a reason [V probe3]); DNR blocking at the network layer works once reconciled (0 requests reached the site [V]); block page shows reason + live countdown; clean token system; both themes; no horizontal overflow; very low UI re-render cost; Data tab with backup/restore; honest privacy copy; a documented process (`design.md`, `fixes/`).

## 8. Correction to my first message
I said the DNR fallback in `installRules` looked O(N²). **That was wrong.** Rules are consolidated (one redirect rule holds all blocked domains; ≤ ~202 rules total), so the loop is bounded. The real weakness is isolation (one bad domain fails the consolidated rule) and punycode (§6.8). [R]

## 9. Not verified (do not treat as findings)
Notifications actually shown · weekly-report content · content-script filters (YouTube/Google/Reddit/X/Instagram/TikTok/LinkedIn) · daily-limit/allowance accumulation (`attention.ts`) · browser-zoom layouts · Windows shortcut conflicts · panel at 320 px visually (screenshot exists, not reviewed) · whether alarms survive a browser restart · real-world `dayStats` vs `sessionHistory` agreement · my own `npm ci` needed registry rewrites because `package-lock.json` `resolved` URLs point at a Replit-internal host (fails outside Replit — check your CI) [V].
