# FocusGate Extension — Implementation Plan

> **Audience:** the implementing agent. **Author:** planner agent. **Date:** 2026-10-17 (revised).
> **Scope:** the `FocusGate` browser extension (Manifest V3, React 19 + Vite 6 + Tailwind 4).
> **Reference apps:** FocusFlow Android (`focusflow.zip`, Kotlin) and FocusFlow PC (`focusflowpc.zip`, Kotlin/Compose Desktop).
> **Method:** I read every source file of the extension (`background.js`, `content.js`, all 2,044 lines of `App.tsx`, hooks, manifest, scripts) and the model / settings / enforcement / service layers of both apps. I did **not** run the extension in a browser (no browser or network in my sandbox), so every finding is tagged either **Confirmed in code** or **Verify** (deduced from the code, reproduce before you change it). All code citations (about 75 file and line references) were machine-checked against the uploaded sources.


**Contents** — §0 How to use · TL;DR · §1 Context · §2 Ground rules · §3 What an extension cannot enforce · §4 Findings (4.1 core bugs, 4.2 wrong behaviour, 4.3 half-built features, 4.4 UI, 4.5 hygiene, 4.6 repro steps, 4.7 claims audit, 4.8 feature-level review) · §5 Target architecture · §6 Work packages WP0–WP10 (WP1b = spikes) · §7 Port matrix · §8 QA (unit, manual, lifecycle, claims, edge cases) · §9 Milestones · §10 Open questions · Appendices: A algorithms, B content filters, C UI, D Block now, E lock levels and guard, F allowances, G keywords.

---

## Operating rules for the implementing agent (owner-added 2026-10-25; updated 2026-10-27)

These rules bind every implementing agent in addition to everything below. They are mirrored in `fixes/TRACKER.md` (§1–§2) and `fixes/AGENT_PROMPT.md` (the pre-prompt). `fixes/TRACKER.md` is the only progress record for this plan.

1. **Authorization and pause.** This plan is the implementation contract, not authorization by itself. Reading, inspecting, and maintaining these planning documents is allowed before implementation begins. Do not edit app code, tests, build files, settings, or other behavior until the owner explicitly authorizes implementation. If scope or authorization is unclear, stop and ask.
2. **Work alone.** Do not create, invoke, or delegate to sub-agents.
3. **Follow the plan and tracker.** Work in the order below, use the tracker as the progress record, and do not silently widen scope or change this plan's contract.
4. **Inspect before editing.** Before any authorized implementation, inspect the relevant current code, project instructions, and working tree. Confirm current APIs and behavior instead of assuming this plan's code snapshot is current. Preserve unrelated user changes and user data.
5. **Respect the no-touch list.** Unless the owner explicitly changes scope, do not hand-edit `dist/` (§2.11), blindly recreate files missing from the upload (§1.2 — check the GitHub repo first), or port the "Do not port" features (§6 WP7), including the Discord webhook and any telemetry. Do not overwrite the separate root `plan/` folder; the active documents are in `fixes/`.
6. **Destructive actions.** Treat task replacement and any other deletion of user data as destructive. Keep replacement disabled by default, preserve explicit confirmation and required safety guards, and do not perform destructive actions without the owner's authorization.
7. **Testing environment.** Run relevant checks on Replit using this project's existing workflows or scripts. For this browser extension, use the applicable npm scripts (`npm run typecheck`, `npm test`, `npm run build`); do not run Android tests or build APKs in this repository. If Android/APK verification is explicitly in scope, test only the production flavor, never build APKs on Replit, and use GitHub Actions for APK-building verification only when the owner explicitly asks. State plainly whenever a check was not run.
8. **GitHub.** Do not push to GitHub or start, poll, or monitor GitHub Actions unless the owner explicitly asks.
9. **Secrets.** Do not expose, copy into files, or print secrets or credentials.
10. **Test style.** Use behavior tests with fake clocks and event sources. Do not add tests that read Kotlin source files as text. Logic under test must not call the system wall clock directly.
11. **Tracker discipline.** Follow the tracker rules at the top of `fixes/TRACKER.md`: record dated phase starts, update after meaningful changes and each check, tick only complete-and-verified work, record evidence and failures, preserve history, and reconcile the tracker with reality before finishing.
12. **Phase checkpoints.** Work on one work package at a time. At each phase boundary, stop and report; do not begin the next phase until the current phase's completion conditions and required checks pass. Respect all dependency gates in §6 and §9.
13. **Preserve work outside the authorized batch.** Do not delete, revert, replace, or clean up files or work outside the currently owner-authorized work package/batch, including work from another agent or an earlier batch. A removal must be explicitly required by the active authorized scope and its plan gates; otherwise leave it untouched and ask the owner if it blocks progress.

---

## 0. How to use this plan

1. Read §1–§3 fully (context, rules, platform limits). They constrain every decision.
2. Work through the work packages (WP0 → WP10, §6) **in order**. Each WP has *Tasks*, *Files* and *Acceptance criteria (AC)*. A WP is done only when every AC passes.
3. Findings (§4) have IDs (`B01`, `H03`, `U05`…). WPs reference them. If a finding is tagged **Verify**, reproduce it first (repro steps are given), then fix it.
4. Commit once per WP (or per sub-task for WP2/WP3). Do not mix refactors and behaviour changes in one commit.
5. When a decision is unclear, use the default listed in §10 and note it in the commit message. Do not stop to ask unless a default is missing.

**Severity legend:** **S1** core feature broken, data loss, or lock bypass · **S2** wrong or misleading behaviour · **S3** polish / hygiene.

---

## TL;DR — what is actually wrong

The extension *looks* feature-rich but its foundations are not sound for Manifest V3:

1. **The focus timer only runs while the popup is open.** The countdown is a `setInterval` inside `TimerView` (`App.tsx` ≈L234-262). Close the popup and time stops, the session never ends, blocking stays on (or, during a break, stays *off*) forever, and a `commitment` session cannot be ended at all. (B01)
2. **The service worker keeps all state in module globals and hydrates them asynchronously** (`background.js` L3-52). After the worker is killed and re-woken, handlers can run against empty state: sites are not blocked, and writes of the stale empty arrays can wipe stored data (temptation log, allowance usage, cooldowns). (B02)
3. **Blocked sites redirect to the popup UI, not to a block screen**, because the DNR rules redirect to `/index.html` without the `?blocked=true` flag (L206-209, L236-238). (B03)
4. **Schedules are inconsistent and stale**: three different evaluators disagree, rules are never refreshed at schedule boundaries, and a schedule's site list is a *snapshot copy* taken when it was created. (B04, B15)
5. **Stats is empty** unless sessions were started with the keyboard shortcut — the UI never writes `sessionHistory`. (B05)
6. **The keyboard shortcut bypasses Strict/Commitment locks.** (B06)
7. **"Interval" allowances are mis-ported** (they block the second page load) and **time allowances count in unfocused windows**. (B08, B09)
8. Several features are stubs: task `scheduledTime` is never used, "fullscreen lock" cannot work in a popup, weekly digest never fires, whitelist examples in the UI do not match, etc. (§4.3)
9. **UI**: popup has no fixed size (jumps between tabs), one HTML file serves popup + block page + onboarding (flash of the wrong screen), `alert()` is used 10 times, tiny low-contrast text, hover-only controls, misplaced nav indicator. (§4.4)
10. **Most on-screen claims are false or only partly true** (20 ❌ and 20 ⚠️ of 40 audited, §4.7): "completely inaccessible", "instantly block", the whitelist example, the keyword placeholder, schedules "block all configured sites", "Cannot be stopped early", "Enforces fullscreen", "Time Remaining", "Close Tab", "Start Focusing", stats, and the manifest's "social media, video, news". Each claim is either made true by a WP or its copy is rewritten (policy in §4.7).
11. **Standalone Block, Strict, Commitment and Daily Allowances are design problems, not just bugs** (§4.8). Standalone is buried in Settings, silently freezes your whole rule set, takes a raw hours number, has no countdown, no extend, no add, and its "No limit" can never be ended. Strict/Commit are just names with no stated guarantees and only the popup enforces them. Daily allowances merge two different features (a cap and an exemption), never show usage, can't be edited and have a meaningless "Wait" mode. Redesign Standalone like Android's (Appendix D), define the lock levels with one guard matrix (Appendix E), and rebuild allowances as a real screen with three named modes, usage bars and an explicit "also allow during blocks" switch (Appendix F).

**Recommended order of delivery:** WP0 hygiene → WP1 foundation → **WP1b spikes** → WP2 session engine → WP3 blocking engine → WP4 content script → WP5 UI foundation → WP6 security/data → WP7 features → WP8 stats → WP9/10 QA + release. Milestone M1 = WP0-3 ("blocking and timer are correct"). Do not start feature ports (WP7) before M1 is green.

---

## 1. Context

### 1.1 What was reviewed

| Project | Stack | Role |
|---|---|---|
| **FocusGate** (this repo) | MV3 extension; React 19, Vite 6, Tailwind 4, `motion`, `lucide-react`; hand-written `public/background.js` (520 lines) and `public/content.js` (182 lines); all UI in `src/App.tsx` (2,044 lines) | The product being fixed |
| **FocusFlow Android** | Kotlin / Compose, Room, AccessibilityService blocker, VPN network blocker, alarms, analytics | Source of behaviours to port: tasks + reminders, allowance modes, pomodoro, extend, debrief, achievements, insights, quick block, overlay quotes |
| **FocusFlow PC** | Kotlin Compose Desktop, SQLite, process killer, hosts/firewall blockers | Source of behaviours to port: pomodoro cycles, presets, weekly report, focus insights, streak/daily goal, habits, daily notes, recurring tasks, keyword log, PIN policy, correct schedule algorithm |

The PC app's own keyword-blocker screen says it *cannot read browser URLs or page titles reliably* and that the Edge extension is the complement. The extension should therefore be the **best-in-class web layer** (URL, query, title, in-page filtering) and should not try to imitate OS-level enforcement.

### 1.2 Current extension repo map

```
public/manifest.json         MV3, perms: storage tabs webNavigation alarms declarativeNetRequest notifications, host <all_urls>,
                             content script <all_urls> at document_start, command Alt+Shift+F, popup = index.html
public/background.js         service worker, plain JS, globals + async hydrate, DNR + webNavigation + tabs.onUpdated + alarms
public/content.js            hides items by hard-coded selectors on 7 sites during a session
src/App.tsx                  TimerView, TasksView, BlockerView, SettingsView, StatsView, OnboardingView, PasswordModal, blocked page
src/hooks/useChromeStorage.ts  per-key React state mirrored to chrome.storage.local
scripts/*.cjs                zip packaging (chrome, edge, firefox), store bundle, GitHub sync (Replit)
dist/                        committed build output (identical copies of public/ scripts)
patch_req.cjs                leftover one-off script that rewrote App.tsx (already applied)
```

Files referenced by README/scripts but **not present** in the upload: `LICENSE`, `STORE_LISTING.md`, `STORE_PUBLISHING.md`, `AFTER_PUBLISHING.md`, `store-assets/`, `docs/`, `.github/workflows/build-extension.yml`. `npm run package:all` fails without them. Do not recreate blindly — check the GitHub repo first (WP0).

### 1.3 How it works today (so you know what you are replacing)

* `index.html` (the popup) is also the block page (`?blocked=true&url=`) and the onboarding page (`?onboarding=true`).
* Session state is split over `timer_isActive`, `timer_mode`, `timer_timeLeft`, `timer_totalTime`, `timer_lockLevel`, `timer_activeTaskId`. **The popup mutates `timer_timeLeft` once per second.**
* Blocking = DNR dynamic rules (redirect) + `webNavigation.onCommitted` + `onHistoryStateUpdated` + `tabs.onUpdated`, all calling the same logger.
* Allowances: `dailyAllowances[site] = number | {type:'time'|'interval', limit}` with counters in `dailyUsage` and `cooldownEnd`.
* Lock levels: `none`, `strict` (password or typed "I GIVE UP"), `commitment` (no stop button). Enforced **only in the popup UI**.

---

## 2. Ground rules (non-negotiable)

1. **MV3, no remote code, no network calls, no analytics/telemetry.** "Privacy-first" is the product promise. (The PC app has a Discord crash/feedback webhook — **do not port it**.)
2. **Single source of truth = `chrome.storage.local`**, with one writer per key (see §5.4). No `localStorage` for state. `chrome.storage.session` only for ephemeral caches.
3. **The service worker must be stateless.** Every event handler starts with `await ready` / `await getState()`; no logic may depend on module-level variables surviving. Register all listeners synchronously at top level.
4. **Time is a timestamp, never a counter.** Use `endsAt` / `startedAt` epoch-ms. No per-second storage writes.
5. **One enforcement pipeline.** Exactly one function (`reconcile()`) decides what is blocked and installs DNR rules. Navigation listeners are *fallbacks* (keywords, SPA route changes) and share the same pure decision functions.
6. **Pure logic lives in `src/shared/` and has unit tests** (schedule evaluation, allowance ledger, domain/exception matching, block plan, rule builder, migration, password hashing).
7. **No `alert()`, `confirm()`, `prompt()`.** Use inline toasts / modals.
8. **Never destroy user data.** Ship a storage migration (§5.2) with a fixture-based test. Old password hashes must keep working (transparent upgrade).
9. **Keep Chrome, Edge and Firefox builds working** (`scripts/package-*.cjs`). Use promise-style `chrome.*` APIs (supported in Chrome MV3 and Firefox MV3). Feature-detect anything not in Firefox (notification buttons, `action.openPopup`).
10. **Minimal permissions.** Add only `idle` (attention tracking) and, if needed, `scripting` and `contextMenus`; justify each in `STORE_LISTING.md`. Restrict the content script to the sites it actually supports.
11. **Do not hand-edit `dist/`.** It is build output (WP0 removes it from version control).
12. **TypeScript strict for all new code.** Enable `"strict": true` in `tsconfig.json`; fix existing errors rather than suppressing them.

---

## 3. What a browser extension cannot enforce — say so in the UI

The apps enforce at OS level (Accessibility service, process killing, firewall, hosts file). An extension cannot. Be honest, and detect what can be detected:

| Bypass | Can we stop it? | What to do |
|---|---|---|
| User disables / removes the extension | No | Document it. Record a **protection gap** (heartbeat, §WP2) so Stats shows it. Suggest the PC / Android app for stronger enforcement. |
| Private/Incognito window | Only if the user enabled "Allow in Incognito" | **Detect** (`chrome.extension.isAllowedIncognitoAccess()`); show a warning in Settings + onboarding with a deep link to the extension page. |
| Another browser / profile | No | Document. |
| Editing `chrome.storage.local` from the extension's DevTools | No | "Friction, not security" copy next to the password and lock levels. |
| Firefox MV3: host permissions not granted | Detectable | `permissions.contains({origins:['<all_urls>']})`; show a one-click "Grant access" prompt (user gesture required). |
| System clock changes | Partly | Heartbeat check: if `Date.now()` goes backwards by more than 60 s relative to `lastHeartbeat`, extend `endsAt` by the delta and flag the session. |

Existing UI already says "friction, not a true lock" for Strict. Keep that honesty and extend it to the password and standalone cards.

---

## 4. Findings

Line numbers refer to the uploaded files (`public/background.js`, `public/content.js`, `src/App.tsx`). "Confirmed" = read directly in code. "Verify" = deduced; reproduce first.

### 4.1 S1 — core behaviour broken, data loss, or lock bypass

| ID | Finding | Where | Status | Fix |
|---|---|---|---|---|
| **B01** | **Timer lives in the popup.** Countdown is a `setInterval` in `TimerView`; `timeLeft` is written to storage every second and the interval is torn down/recreated every tick (deps include `timeLeft`) so it also drifts. When the popup closes, time stops: the session never ends, blocking stays on, a `commitment` session can never be stopped, and a session left in *break* mode keeps blockers **off** indefinitely. No end-of-session notification exists. With two extension views open, time decrements twice per second. | `App.tsx` ≈L234-262, L264-284; `background.js` has no session-end alarm | Confirmed | WP2 |
| **B02** | **MV3 service-worker state race.** All state lives in module globals hydrated by an async `storage.get` callback. Handlers that run before the callback (cold start after the worker was killed) see empty lists → site not blocked. Handlers then write the stale in-memory arrays back (`temptationLog`, `dailyUsage`, `cooldownEnd`) and can wipe stored data. `setTimeout(updateDNRRules, 1000)` is not reliable in a worker. | `background.js` L3-52, L60, L269, L377, L427, L498-501 | Confirmed (race is intermittent) | WP1, WP3 |
| **B03** | **Blocked sites land on the popup UI, not a block screen.** DNR redirect targets `/index.html` with no `?blocked=true&url=`, so the user sees the normal app (Timer tab) inside a full tab. Only the `webNavigation` fallback passes the flag. No `web_accessible_resources` is declared, which Chrome/Firefox may require for a web-initiated navigation to an extension page. | `background.js` L206-209, L236-238; `manifest.json`; `App.tsx` L28-36 | Confirmed (WAR behaviour: Verify) | WP3, WP5 |
| **B04** | **Schedules are enforced three different ways.** (1) DNR path: no overnight support, end inclusive, and an active schedule blocks the *global* `blockedSites`, not the schedule's own list (L171-216). (2) `isUrlBlocked`: supports overnight, uses the schedule's list (L301-333), but overnight "days" only checks *today*. (3) Nothing refreshes DNR rules at a schedule start/end: the minute alarm returns early when no allowances exist (L431), so rules installed during a window **persist after it ends**, and rules for a window that just started are missing until some storage key changes. | `background.js` L171-216, L301-333, L431 | Confirmed | WP3 |
| **B05** | **Stats is empty for UI-started sessions.** The popup never writes `sessionHistory`; only the shortcut path does (`logSession`). `logSession` picks the *first* `active` entry (`find`) though the comment says "last", history is unbounded, and the "tamper" heuristic compares `timer_timeLeft`, which is stale whenever the popup is closed, so legitimately finished sessions are marked *abandoned*. | `App.tsx` L1601 (read only); `background.js` L72-124 | Confirmed | WP2, WP8 |
| **B06** | **Alt+Shift+F bypasses Strict/Commitment.** The command just flips `timer_isActive`; it ignores `lockLevel`, never sets `timeLeft`/`mode`, and logs a 25-minute session regardless of the UI's duration. | `background.js` L72-88 | Confirmed | WP2 |
| **B07** | **Opening the popup can end a task-linked session.** An effect calls `endSession()` when `activeTaskId` is set but the task is not found; each `useChromeStorage` instance hydrates separately, so a render with `activeTaskId` loaded but `tasks` still `[]` is possible. | `App.tsx` L224-232, `useChromeStorage.ts` | Verify (timing-dependent) | WP2 (background owns session), WP5 (ready gate) |

### 4.2 S2 — wrong or misleading behaviour

| ID | Finding | Where | Status | Fix |
|---|---|---|---|---|
| **B08** | **"Interval / Wait" allowance is mis-ported.** The extension sets `cooldownEnd = now + limit` on the first navigation and then treats `cooldownEnd > now` as *blocked*, so the **second page load (and any SPA route change) is blocked** after the first. Android's `interval` mode means "allowed X minutes every Y hours" (`AllowanceLedger.MODE_INTERVAL`, text in `DailyAllowanceModal`: "App is allowed for X min every Y hour(s)"). Android also has a `count` mode (N opens/day) that is missing here. | `background.js` L198-199, L344-346, L356-381, L385-391, L485-494 | Confirmed | WP3 |
| **B09** | **Time-allowance accuracy.** Counts `tab.active` in *any* window (minimised or unfocused), +1 per alarm tick, no idle detection, no audible-tab handling; day key uses `toLocaleDateString()` (locale dependent); day rollover only happens inside the alarm. | `background.js` L12, L423-427, L446-484 | Confirmed | WP3 |
| **B10** | **Whitelist ("Exceptions") does not match the way the UI documents it.** UI example `youtube.com/watch?v=123` can never match because the code does `urlStr.startsWith(wUrl)` on a full URL that starts with `https://www.`; DNR uses `\|${wUrl}*`. No boundary check, so `https://youtube.com` also matches `https://youtube.com.evil.example`. | `App.tsx` L1009, L1019; `background.js` L163, L275 | Confirmed | WP3 (Appendix A.4) |
| **B11** | **DNR `urlFilter: "\|\|site"` is built from raw entries.** Fails for entries with scheme/path; prefix-matches look-alikes (`example.com.au`, `example.community`); special chars (`*`, `^`, `\|`) are not escaped. Use `requestDomains`. | `background.js` L210-213, L239-242 | Confirmed | WP3 |
| **B12** | **Block attempts are logged 2–4× per navigation** (DNR audit, `onCommitted`, `onHistoryStateUpdated`, `tabs.onUpdated`) and the "audit all open tabs" loop runs inside *every* `updateDNRRules()` call — including the once-per-minute allowance path. The log is capped at 100 entries, so "blocks this week" is wrong. | `background.js` L54-62, L255-265, L359, L387, L477, L514-516 | Confirmed | WP3, WP8 |
| **B13** | **Alarm registration bugs.** `alarms.create` runs on every worker start; re-creating `weeklyDigest` (7-day period) resets its schedule each time the worker wakes, so it **never fires**. Digest text floors focus time to whole hours ("0 hours"). `standalone_expire` is only armed on a storage change, not at startup. | `background.js` L134-139, L394-395, L408-415 | Confirmed (alarm reset: Verify via `alarms.get`) | WP2, WP8 |
| **B14** | **Content script defects.** (a) `observer.observe(document.body, …)` throws at `document_start` when `body` is null *after* `observer` was assigned → the observer is never attached. (b) Hides via inline `display:none`; never restores when the session ends or a keyword is removed; hidden items are never re-evaluated. (c) Host checks use `includes` (`x.com` matches `netflix.com`; `google.com` matches `mail.google.com`). (d) Shorts shelf, Instagram Reels links and the TikTok feed are hidden unconditionally in sessions with no setting. (e) Injected into `<all_urls>` at `document_start` although only 7 sites are handled. | `content.js` L7-17, L58-158, L163-173; `manifest.json` | Confirmed | WP4 |
| **B15** | **Schedules snapshot the global lists.** `addSchedule` copies `sites` and `keywords` at creation; later edits are not reflected and cannot be edited per schedule. Card text says "Blocks all configured sites and filters" which is not what happens. No name, no edit. | `App.tsx` L890-906, L1183-1185 | Confirmed | WP3, WP5 |
| **B16** | **A `commitment` task can never be deleted** (trash icon disabled permanently), even when no session is running. Lock should only apply while *that task's session is active*. Leftover "Wait, …" scratch comment in `toggleTask`. | `App.tsx` L574-583, L773-776 | Confirmed | WP5, WP7 |
| **B17** | **"Close Tab" does nothing on most block pages**: `window.close()` is ignored for tabs not opened by script. | `App.tsx` L120-125 | Confirmed (browser rule) | WP5 |
| **B18** | **`updateDNRRules()` is not serialised.** Concurrent calls read `getDynamicRules()` then remove/add, producing duplicate-ID errors that fail the whole update. | `background.js` L247-253 | Confirmed (race) | WP3 |
| **B19** | **Keyword engine too narrow.** URL params limited to `q`, `search_query`, `p`; substring match only ("sex" ⊂ "essex"); only while a session/standalone is active; no whole-word option; no log of *what* matched (PC has `KeywordMatchLogger`). | `background.js` L284-299 | Confirmed | WP3, WP7 |
| **B20** | **Password handling.** Unsalted SHA-256; generator uses `Math.random`; copy/paste/cut blocked and input masked with a 20-char minimum on unlock; `friction={verifyAction === 'remove_password' …}` in `BlockerView` compares an object to a string (never true; TS2367). | `App.tsx` L1280-1290, L1408-1412, L1715, L1799-1803, L1878, L1915-1919, L1981, L1197, L2013-2034 | Confirmed | WP6 |
| **B21** | **Standalone block.** "No limit" has no stop path, no confirmation, can start with zero rules; start performs two separate storage writes; adding an exception while active silently does nothing (no feedback). | `App.tsx` L822-824, L1328-1345 | Confirmed | WP6 (Appendix D; design: §4.8) |
| **B22** | **Duration input fights the user.** Controlled by `Math.floor(timeLeft/60)` with `parseInt`; clearing the field jumps to 1, so typing "25" requires awkward editing. Same in task form. | `App.tsx` ≈L370-380, L496-503 | Confirmed | WP5 |

### 4.3 Half-baked features

| ID | What exists | What is missing | Reference | WP |
|---|---|---|---|---|
| **H01** | Task `scheduledTime` field and display | Never used: no reminder, no auto-start, no alarm | Android `ReminderPlanner` (pre-start 10/5/1 min, at-start, mid-session 15/30, almost-done) | WP7 |
| **H02** | "Strict: enforces fullscreen" | `requestFullscreen()` cannot work from a popup; re-request after Esc needs a user gesture. Remove; use delay + password/phrase friction and a lock screen | — | WP2 |
| **H03** | Stats tab | Today-only, last 10 sessions, planned (not actual) duration, no week/month, streak, goal, insights, per-site usage | PC `FocusInsightsService`, `WeeklyReportService`; Android trend/achievements | WP8 |
| **H04** | Hard-coded hiding on 7 sites | No toggles; no YouTube comments/home/recs controls; no restore | Android `blockYoutubeShortsEnabled`, `blockInstagramReelsEnabled` | WP4 |
| **H05** | Daily allowances (time, "Wait") | Modes `count` and `interval` per Android, custom values, usage/remaining display, edit | Android `DailyAllowanceModal`, `AllowanceLedger` | WP3, WP5 |
| **H06** | Schedules (time window + days) | Name, edit, own lists vs global lists, overnight hint, "end of day" | PC `BlockSchedule.isActiveAt` | WP3, WP5 |
| **H07** | Standalone block (hours or "no limit") | Scheduled start, exit path, confirmation | PC `StandaloneBlock(startMs)` | WP6 |
| **H08** | Weekly digest notification | Fires never (B13); not viewable in-app | PC `WeeklyReportService` | WP8 |
| **H09** | 3-step onboarding | Goal question, presets, protection check, explain trade-offs of password | PC `BlockPresets.goalSuggestions` | WP7 |
| **H10** | Whitelist tab | Correct matching, validation, feedback, clear naming ("Exceptions") | — | WP3, WP5 |
| **H11** | — | Backup / export / import | Android `BackupEnvelope`, PC `BackupService` | WP6 |
| **H12** | — | Protection health (incognito, host access, notifications, DNR rules, last heartbeat) | Android `EnforcementHealth`, `PermissionsScreen` | WP6 |
| **H13** | Fixed 5-min break | Configurable work/short/long break, cycles, auto-advance | PC `BreakEnforcer`, Android pomodoro settings | WP2 |
| **H14** | — | Notifications for session end, break end, task start; toolbar badge with minutes left | Android live task notification | WP2, WP7 |
| **H15** | — | "Block this site" from the current tab (button, shortcut, context menu) | Android `QuickBlockSheet` | WP7 |
| **H16** | Block page with attempts counter | Reason, remaining time, allowance info, custom message / quotes, working Close | PC `overlayMessage`, Android `overlayQuotes` | WP5, WP7 |
| **H17** | Title + duration + lock | Edit, description, priority, tags, recurrence, restart completed | PC `Task`, `RecurringTaskService`; Android `Task` | WP7 |

### 4.4 UI / UX

| ID | Finding | Where |
|---|---|---|
| **U01** | **No fixed popup size.** Root is `w-full min-h-screen sm:w-[400px] sm:h-[600px]`; popups are < 640 px wide so `sm:` never applies, and Chrome sizes the popup to its content: size changes per tab. In a full tab the same markup becomes a 400×600 card on a white body (`index.css` sets no body styles). | `App.tsx` L69, L143-148, L1733; `index.css` |
| **U02** | One HTML file serves popup, block page and onboarding. The role is chosen in a `useEffect` after first paint, so the Timer UI **flashes** before the block/onboarding screen. | `App.tsx` L28-36 |
| **U03** | `useChromeStorage` returns defaults first, loads async (flicker: empty lists, `25:00`, "Start Session"); function updaters close over stale state; each instance hydrates separately; `App` subscribes to `timer_timeLeft` so the whole tree re-renders every second. | `useChromeStorage.ts`; `App.tsx` L62 |
| **U04** | Text too small and low-contrast: many `text-[10px]`/`text-[11px]`; `text-neutral-600` on near-black is below 3:1. | throughout |
| **U05** | Nav indicator `absolute` inside a non-`relative` button; `z-10` on a non-positioned `<nav>`; `pb-safe` is not a Tailwind v4 utility. | `App.tsx` L169, L199-201 |
| **U06** | `alert()` used 10× (blocks the popup, ugly, can close it). | Settings, Tasks, onboarding, modals |
| **U07** | Information architecture: Settings mixes how-to, security, standalone and allowances; allowances belong with Rules; "whitelist" is a hidden sub-tab. | `SettingsView`, `BlockerView` |
| **U08** | Header is only logo + title: no state (idle / blocking until X) and no protection warning. | `App.tsx` L149-156 |
| **U09** | Lock-level `<select>` truncated to "Commit" (`max-w-[80px]`); delete buttons are `opacity-0 group-hover:opacity-100` (invisible to keyboard/touch). | L394-410, L992, L1040, L1574 |
| **U10** | Block page: Close button broken (B17), inflated counter (B12), promotional footer on a block screen, `sm:` card layout. | `App.tsx` L67-133 |
| **U11** | Dark only; no `prefers-color-scheme`, no theme setting. | — |
| **U12** | No loading / error / success states; disabled controls give no reason (standalone, exceptions). | throughout |
| **U13** | Accessibility: icon-only buttons without labels, no `:focus-visible`, modals without focus trap/Esc, colour-only status. | throughout |
| **U14** | Heavy motion (`AnimatePresence mode="wait"` page transitions + per-second re-render); no `prefers-reduced-motion`. | `App.tsx` L159-165 |

### 4.5 Repo / build hygiene

| ID | Finding |
|---|---|
| **R01** | `package.json` name is `react-example` v0.0.0 (manifest is 1.0.1). `express`, `dotenv`, `@types/express`, `tsx` are unused by an extension; `clean` script removes a non-existent `server.js`. |
| **R02** | `patch_req.cjs` is a leftover one-off (its patch is already applied in `App.tsx`). `dist/` is committed and duplicates `public/` scripts. No `.gitignore` in the upload. |
| **R03** | `npm run lint` (`tsc --noEmit`) most likely fails (L1197 comparison, `key?: string` prop hacks, `NodeJS.Timeout` in browser code); tsconfig is not strict. **Verify** by running it. |
| **R04** | `background.js` and `content.js` are untyped, untested, outside the build, and duplicate logic (`isStandaloneActive` ×3, domain-cleaning regex ×8). |
| **R05** | README/scripts reference files that are absent (§1.2). |
| **R06** | No domain validation anywhere (accepts spaces, `localhost`, mixed case in whitelist). |

### 4.6 Repro cheat-sheet (do this before fixing S1 items)

| ID | Steps | Expected today |
|---|---|---|
| B01 | Start a 1-minute session. Close the popup. Wait 2 min. Reopen. | Still ≈0:5x left; `timer_isActive` is `true`; sites still blocked. |
| B03 | Add `reddit.com`, start a session, open a reddit link from another site. | Lands on the FocusGate main UI (Timer tab) in the tab, not the "Blocked" screen. |
| B04 | Create a schedule that covers *now* (any days), reload the extension (rules rebuild), wait until the end time passes. | Site is still redirected until some storage key changes. |
| B05 | Start and finish a session from the popup; open Stats. | "No sessions recorded yet." |
| B06 | Start a `commitment` session; press Alt+Shift+F. | Session ends. |
| B07 | Start a task-linked session; repeatedly close/reopen the popup. | Intermittently the session ends on open. |
| B10 | Add exception `youtube.com/watch?v=abc` (as the placeholder suggests), block `youtube.com`, start a session, open that video. | Still blocked. |
| B13 | In the worker DevTools: `chrome.alarms.get('weeklyDigest')` before/after a worker restart. | `scheduledTime` moves forward on each restart. |
| B14 | Reload YouTube repeatedly during a session with DevTools open. | Occasional `Failed to execute 'observe' on 'MutationObserver'`; filtering never starts on that load. |

### 4.7 Claims vs. reality — per-screen audit

You reported that the screens' features **and the claims made about them** do not really work. This section audits every user-facing claim: in-app copy, the "How to Use" text, `manifest.json`, `metadata.json`, `README.md`. I grepped the exact strings and traced each one to the code that is supposed to make it true.

**Verdict:** ✅ true · ⚠️ partly true or misleading · ❌ false.
**Policy for every ⚠️/❌ row:** either make the claim true (preferred; the WP is given) **or** change the copy in the same commit. A claim may ship only when its row in §8.4 passes. Words like *completely*, *instantly*, *cannot*, *always* are banned in copy unless a test proves them.

#### 4.7.1 Extra S2 findings discovered during the audit

| ID | Finding | Where | Status | Fix |
|---|---|---|---|---|
| **B23** | **Content script ignores break state, schedules and allowances.** It reads only `blockedKeywords`, `timer_isActive`, `standaloneMode`, `standaloneUntil`; never `timer_mode`, `schedules` or `dailyAllowances` (grep: none). So filters keep hiding during a *break* (when blocking is deliberately off) and schedule keywords never hide anything. `isStandaloneActive` is re-implemented a third time. | `content.js` L7-17, L47-49 | Confirmed | WP4 |
| **B24** | **Password gating has holes.** `handleAction` treats only `remove_password` and `add_allowance` as restriction-lessening, so **removing a daily allowance never asks for the password** (for a site that is not on the block list the limit is its *only* restriction). Ending a `none`-lock session never asks (by design, but HowToUse says it does). The shortcut (B06) never asks. Android asks for the PIN to remove an allowance (`SettingsHowToUseScreen`: "removing an entry asks for the Defense PIN"). | `App.tsx` L1292-1310, L1242 | Confirmed | WP6 |
| **B25** | **Keyword field does not split lists.** Placeholder "funny shorts, #gaming" implies a list; `addKeyword` stores the whole string as one keyword, which then never matches. | `App.tsx` L876-881, L1067 | Confirmed | WP5 |
| **B26** | **DNR update is unguarded and inputs are unvalidated.** `updateDynamicRules` is atomic: one invalid rule rejects the *whole* call (e.g. a non-ASCII/IDN entry, since `urlFilter` must be ASCII, or stray characters). There is no `try/catch`, no UI surface for the failure, so blocking silently stops updating. Site entries are never validated (accepts spaces, commas, `localhost`). | `background.js` L247-253; `App.tsx` L840-846, L1352-1356, L1725-1727 | Confirmed (atomicity per Chrome docs; IDN behaviour: Verify) | WP3 |
| **B27** | **Allowance exemption is applied by one path and ignored by the other.** During a session the DNR builder *skips* a listed site that still has allowance (L189-201), but `isUrlBlocked` blocks it regardless (L289-294). Result: the page loads (DNR lets it through) and is then redirected by the fallback — a flash plus a logged "attempt". Android's rule is: allowance = a metered exemption (`AppBlockerAccessibilityService` header: "Apps listed here are allowed ONCE per calendar day during any blocking session"; later extended to `count` / `time_budget` / `interval`). | `background.js` L189-201 vs L289-294 | Confirmed | WP3 (Appendix A.3) |
| **B28** | **Block page shows stale time and wrong copy.** "Time Remaining" reads `timer_timeLeft`, which is frozen while the popup is closed and holds the leftover `25:00` after a session; it renders for schedule/allowance/keyword blocks that have no session at all. The headline "You are supposed to be focusing right now." is shown for every reason. | `App.tsx` L62, L94-105 | Confirmed (leftover value: Verify) | WP2, WP5 |
| **B29** | **Onboarding "Start Focusing" opens Settings** in the same tab (white page + 400 px card) instead of starting anything or closing. | `App.tsx` L136-139, L1852-1854 | Confirmed | WP5 |
| **B30** | **No domain aliases.** The placeholder suggests `twitter.com`, but X's pages are on `x.com`; same for `youtu.be`/`youtube.com`, `fb.com`/`facebook.com`, `redd.it`/`reddit.com`. Blocking one leaves the other open. | `App.tsx` L971, L1250 | Confirmed (no alias code; grep) | WP3, WP7 |

#### 4.7.2 Claim-by-claim matrix

| # | Screen | Claim (verbatim or close) | Reality | Verdict | Resolve |
|---|---|---|---|---|---|
| C01 | Store/manifest | "Block social media, video, news, and keywords…" (`manifest.json`, `metadata.json`) | No category, preset or default list exists anywhere (grepped). Every site is typed by hand. Keywords only act on search-URL params and a 7-site DOM filter. | ⚠️ | WP7 presets; reword until shipped |
| C02 | Store/README | "privacy-first" | No network calls in shipped source (grepped). But a content script runs on every page at `document_start`, host access is `<all_urls>`, and the privacy-policy page the README says must be published is not in the repo. | ⚠️ supportable | WP4 narrow `matches`; WP10 policy + permission justifications |
| C03 | README | "tracking local focus statistics" | UI-started sessions are never recorded (B05); block counts inflated (B12). | ❌ | WP2, WP8 |
| C04 | README | CI workflow, docs site, store bundle, listing text | Files are absent from the upload (§1.2). | ❌ unverifiable | WP0, WP10 |
| C05 | Popup shell | Fixed 400×600 app (`sm:w-[400px] sm:h-[600px]`) | `sm:` never applies in a popup (U01). | ❌ | WP5 |
| C06 | Focus | Ring/timer counting down | Counts only while the popup is open (B01). | ❌ | WP2 |
| C07 | Focus | Lock helper: "Strict: Enforces fullscreen (friction, not a true lock). Password to quit." (L391, L649) | Fullscreen is not possible from a popup (H02). Password only if one is set. The shortcut ends it with no password (B06). | ❌ | WP2 |
| C08 | Focus | "Commit: Cannot be stopped early." | Button is hidden, but Alt+Shift+F stops it (B06); and since time only advances with the popup open, it also cannot finish by itself (B01). | ⚠️ | WP2 |
| C09 | Focus | 5-minute break, "Skip Break" | Break only advances with the popup open; blockers are off but content filters stay on (B23). | ⚠️ | WP2, WP4 |
| C10 | Focus/Tasks | Task-linked session completes the task | Only with the popup open; opening the popup can end the session (B07). | ⚠️ | WP2 |
| C11 | Onboarding | "Use Alt+Shift+F to quickly start or stop a focus session from anywhere." (L1849) | Starts a session with no duration, no end and no feedback; stops locked sessions (B06). | ⚠️ | WP2 |
| C12 | Focus | Duration input 1–999 min | Clearing the field jumps to 1 (B22). | ⚠️ | WP5 |
| C13 | Tasks | "Time (opt)" (L633) | Saved and displayed, never acted on (H01). | ❌ | WP7 |
| C14 | Tasks | "No tasks for today. Plan your focus session." (L686) | Tasks have no date; the list is global and permanent. | ⚠️ | WP7 (dates, recurrence) |
| C15 | Tasks | Commitment task: "Cannot delete" | Permanently undeletable, even when idle (B16). | ❌ | WP5, WP7 |
| C16 | Rules › Websites | "Sites listed below will be completely inaccessible during an active Focus Session." (L961) | Main-frame navigations only (embeds are untouched). DNR sends the user to the app UI, not a block page (B03). Allowance exemption inconsistent (B27). Depends on the popup-driven timer (B01). | ⚠️ | WP3; reword to "pages" |
| C17 | Rules › Websites | Placeholder "e.g. twitter.com" (L971); HowToUse "15 mins for Twitter" (L1250) | X pages live on x.com; blocking `twitter.com` leaves `x.com` links open (B30). | ❌ | WP3 aliases |
| C18 | HowToUse #2 | "FocusGate will instantly block access" (L1238) | Blocking only runs during a session, standalone block or schedule — there is no always-on list. "Instantly" fails on B02/B03. | ⚠️ | WP3, WP7 (Always-blocked list) |
| C19 | Rules › Whitelist | "add 'youtube.com/watch?v=specific' to allow a video while blocking 'youtube.com'" (L1009) | That format never matches (B10). | ❌ | WP3 |
| C20 | Rules › Whitelist | Adding an exception during a standalone block | Silent no-op (B21). | ❌ | WP5, WP6 |
| C21 | Rules › Filters | "Keywords will be blocked in Google/YouTube searches…" (L1057) | Applies to any URL carrying `q`, `search_query` or `p`; substring match; only during session/standalone (B19). | ⚠️ | WP3 |
| C22 | Rules › Filters | Placeholder "e.g. funny shorts, #gaming" (L1067) | The whole string is saved as one keyword (B25). | ❌ | WP5 |
| C23 | Rules › Filters | "…YouTube recommendations containing them will be hidden during Focus Sessions." | Observer can fail to attach (B14a); selectors are hard-coded and unverified against current YouTube; also hides in breaks, ignores schedules (B23). | ⚠️ | WP4 |
| C24 | Rules › Schedules | "Automatically block your rules list during specific time windows." (L1103) | Three evaluators disagree; no refresh at window start/end (B04). | ❌ | WP3 |
| C25 | Rules › Schedules | "Blocks all configured sites and filters during this window." (L1184) | Uses a snapshot taken at creation (B15); content filters ignore schedules (B23). | ❌ | WP3, WP4, WP5 |
| C26 | Stats | "Today's Focus Time", "Completed", "Abandoned" | Zero for UI-started sessions (B05). | ❌ | WP2, WP8 |
| C27 | Stats | "Blocks" and "Today's Block Attempts" | Inflated 2–4× (B12). | ❌ | WP3 |
| C28 | Stats | "Session History" | Only shortcut-started sessions (B05). | ❌ | WP2, WP8 |
| C29 | Settings › Password | "Require a long password… to edit rules, exit strict focus early, or disable standalone blocking." (L1385) | Not asked when removing an allowance (B24) or via the shortcut (B06); "disable standalone" does not exist (B21). | ⚠️ | WP6 |
| C30 | HowToUse #3 | "you'll need this password to delete rules or cancel a focus session early" (L1242) | Sessions with lock `none` end without it. | ⚠️ | WP6 reword |
| C31 | Settings › Password | 20–28 chars, Generate | `Math.random`, unsalted SHA-256, paste blocked, masked (B20). | ⚠️ | WP6 |
| C32 | Settings › Standalone | "Lock your rules… up to 1000 hours, or choose no limit. You cannot remove or reduce restrictions while active." (L1466) | Remove buttons are hidden ✓, but actions silently no-op, an empty list "locks" nothing, and **No limit cannot be ended or even confirmed** (B21). Android's Standalone Block has no "no limit" and cannot be ended early — you can only add apps or extend it. | ⚠️ | WP6 (Appendix D) |
| C33 | Settings › Allowances | "Set daily time limits…" (L1532); HowToUse #5 "browse freely until the time runs out, after which it will be blocked for the rest of the day" | `Time` mode approximates this (B09). `Wait` is unexplained and blocks the second page load (B08). Only 15m/30m/1h/2h. No usage shown. Removal not gated (B24). | ⚠️ | WP3, WP5 (Appendix F) |
| C34 | Onboarding | "Start Focusing" (L1853) | Opens the Settings tab in the same tab (B29). | ❌ | WP5 |
| C35 | Onboarding | "Let's set up your first focus rule." | Works (adds a site) but offers no presets and no protection check. | ⚠️ | WP7 |
| C36 | Block page | "You are supposed to be focusing right now." (L94) | Shown for every reason (schedule, allowance, keyword). | ⚠️ | WP5 |
| C37 | Block page | "Time Remaining mm:ss" (L98-105) | Stale `timer_timeLeft` (B28). | ❌ | WP2, WP5 |
| C38 | Block page | "Attempt N today" (L116) | Inflated (B12). | ❌ | WP3 |
| C39 | Block page | "Close Tab" | No-op (B17). | ❌ | WP5 |
| C40 | Block page | Footer "Also check out FocusGate PC and FocusGate App" | Works (links) but is advertising on a block screen. | ⚠️ | WP5 (move to About) |

**Tally:** 20 ❌ · 20 ⚠️ · 0 ✅ across the 40 audited claims. (Things that do work as described: the nav labels, the add-site form, and the basic password check.)

### 4.8 Feature-level review — Rules, Strict, Commitment, Standalone, Daily Allowances

The findings above are mostly *bugs*. This section asks a different question: **are the features themselves designed sensibly?** I compared them with the Android versions (the Android Standalone Block alone is a ~2,100-line flow: `StandaloneBlockSetupScreen`, `StandaloneBlockModal`, `ActiveBlockGuardPolicy`, plus the PIN rules written out in `SettingsHowToUseScreen`; the allowance logic is `AllowanceLedger` and `DailyAllowanceModal`). **Verdict: several features are not merely buggy — their design is wrong.** Strict and Commitment do not exist on Android at all (they are inventions of the extension); their closest Android equivalents are the Focus-session PIN and the Standalone Block.

**What Android actually does (the model to copy)**

* **Separate concepts, each with its own screen:** a *Focus session* (stopping early needs the Focus Session PIN if one is set, otherwise a confirmation), a *Standalone Block* (timed, no task, **its own app list, an absolute expiry, cannot be ended early — you may only add apps or extend it**), and *Always-On* (permanent list; removal is blocked during a block, otherwise it asks for the Defense PIN).
* **One guiding rule:** *adding is free; weakening is locked or PIN-gated.* The in-app help states that adding apps or keywords deliberately needs no PIN and that protection targets removal and weakening.
* **Two secrets:** a Focus Session PIN and a Defense PIN.
* **Standalone has no "no limit".** Its save button stays disabled until the expiry is in the future; the default expiry is tomorrow; quick-extend chips are +30 m / +1 h / +2 h (+4 h inside the modal). The active card shows a live countdown and "N apps blocked until HH:MM", and says the block "cannot be stopped early".
* **Allowances** are a *metered exemption inside block periods*, count all usage during the day (not only during blocks), have three modes (opens per day, total minutes per day, minutes per window of Y hours), are read-only while a block runs, and removing one asks for the Defense password.

| ID | Feature | What is wrong with the design | Android approach | Fix |
|---|---|---|---|---|
| **F01** | Standalone | Buried in Settings between the password and the allowances. A timed "block now" is a primary action, not a setting. | Entry from the Focus tab (and Defense › Active Blocks) | Appendix D (lives on the Focus tab) |
| **F02** | Standalone | **No site selection and no preview.** It silently grabs the global *Sites* list; an empty list "locks" nothing; nothing says *what* will be blocked. | Choose apps at start (search, presets, "save current selection" as a preset); the block keeps its own saved list | Appendix D |
| **F03** | Standalone | Duration is a raw number of hours (0.01–1000): a 36-second block and a 41-day block are both possible. **"No limit" is forever, with no confirmation and no exit** — and it is the only way to get always-on blocking today, which is why it exists. | Absolute expiry date and time, default tomorrow, chips; **no unlimited option** | Appendix D + A2 (Always-blocked list replaces "No limit") |
| **F04** | Standalone | After "Start" the card shows only "Active Until: <date>" (or "No limit"): no countdown, no list of what is blocked, no way to extend, no way to add a site. | Status card with live countdown, "N apps blocked until HH:MM", quick-extend chips, "Manage Active Block" (add or extend only) | Appendix D |
| **F05** | Standalone | One click on Start commits. The end time is never confirmed. | Highlights ("cannot end early once active"), explicit expiry, a save step | Appendix D (confirmation dialog) |
| **F06** | Standalone | The "lock" is inconsistent: some buttons are hidden, some actions silently do nothing (B21), others are not covered at all (the shortcut, allowance removal B24, backup import). | One policy decides what a running block locks | Appendix E (guard matrix) |
| **F07** | Standalone | Interaction with allowances, schedules and the session list is undefined and implemented inconsistently (B27). | — | A.3 (single decision function) |
| **F08** | Strict / Commit | The levels are defined only by their names. Neither says what it protects, and the selector is a truncated `<select>` squeezed beside the duration field. | Two explicit states: PIN set → PIN to stop; not set → confirmation | Appendix E.2 and the start-time summary |
| **F09** | Strict | "Password if one is set, otherwise type `I GIVE UP`", plus a claim that it enforces fullscreen (impossible in a popup, H02). Enforced only in the popup: the shortcut ends it (B06). | The same two states, enforced by the enforcement layer | Appendix E (the background enforces; phrase + 15 s wait is the no-password path) |
| **F10** | Commit | "Commit" just hides the Stop button. With the popup-owned timer (B01) it can leave you in a session that never ends; on a task it makes the task undeletable forever (B16). The Android equivalent of "cannot stop" is the *Standalone Block* (time-boxed, add/extend only). | Commit becomes a well-defined level (cannot be ended early, ends by itself, add/extend only); long unstoppable blocks go to Block now | Appendix E.2 |
| **F11** | Strict / Commit | Nothing tells you at start what the lock will prevent. | Highlights shown before starting | Appendix E.5 |
| **F12** | Rules | No model of *when* a site blocks: the "Strict Site Blocker" list looks always-on but only acts during sessions, standalone blocks and schedules; no per-site status; no way to ask "is this blocked right now, and why?". | Always-On is separate from Focus/Standalone, each with a status line | Always-blocked list (A2), per-site "when" chips, **Check a URL** (A11) |
| **F13** | Rules | "Adding is free, weakening is locked" is applied to four actions only (B24); everything else is inconsistent. | The principle is applied across lists, schedules, allowances, keywords and protections | Appendix E |
| **F14** | Rules › Schedules | A schedule is a time window plus a *copy* of the lists (B15), with no edit. | Group schedules own their app set; new = free; editing, removing apps, shortening, disabling or deleting is guarded; an active standalone block prevents deletion | WP3 + Appendix E |
| **F15** | Password | One password for everything. | Focus Session PIN (stop a session, delete a task) and Defense PIN (weaken protections) | One password now; `guard()` keeps the two categories separable (§10 Q15) |
| **F16** | Allowances | **Two different features are merged without saying so.** Android's allowance is a metered *exemption inside block periods*; the extension's copy promises a *daily cap* ("blocked for the rest of the day"); the engine does both, and nothing tells the user which one they get. | Exemption only; usage counted all day | Appendix F (explicit per-entry switch) |
| **F17** | Allowances | The "form" is one cramped row: site box + a `Time / Wait` select + a `15m 30m 1h 2h` select. No custom value, no 5 or 10 minutes, no visits-per-day mode, no window length. **"Wait" means nothing to a user**, and what it does (B08) matches neither Android's `interval` ("X min every Y hours") nor its simple dialog's label ("Cooldown Interval Between Opens", which stores minutes per 1-hour window) — the extension most likely copied the *label*, not the model. | Three named modes with their own fields and a live summary sentence | Appendix F.4 |
| **F18** | Allowances | **Usage is never shown** — not in the list, the popup or the block page. A daily limit is invisible until it blocks. | The ledger exposes `remaining`; the screen explains that allowances count all usage today | Appendix F.4–F.5 |
| **F19** | Allowances | Lives at the very bottom of Settings, away from the sites it affects; the Rules tab says nothing about limits. | Configured next to the block it modifies | WP5 (Rules › Limits), A11 "Why?" |
| **F20** | Allowances | **No editing.** Changing 15 → 30 min means delete (password) then re-add (password); the trash icon only appears on hover. | Tap a row to expand and edit; values read-only while a block runs | Appendix F.4, E |
| **F21** | Allowances | Gating is inconsistent (B24): adding asks for the password, removing never does; lowering a limit (stricter) is gated like raising it. | Only weakening is gated; removal asks for the Defense password | Appendix E |
| **F22** | Allowances | The counting behind it is unreliable (B09): any window's active tab counts, no idle handling, per-minute granularity; "Wait" blocks the second page load (B08). | Ledger with checkpoints and estimates | A.2 (attention tracking) |
| **F23** | Allowances | The block page cannot say why it blocked ("Daily limit reached — resets at midnight") and shows no remaining time (C36, C37). | — | Appendix F.5 |
| **F24** | Focus tab | It is only a timer: no "what will be blocked" summary, no "up next", no today's progress or streak, no "Block now". Starting with an empty block list "works" and blocks nothing, without a word. | Home shows today's date, the task running now (or the next one) and today's list; the PC dashboard shows a goal ring and streak | A12 + WP5 (summary line; explain when nothing would be blocked) |
| **F25** | Tasks | A task is a title, a minute count and a Play button. There is no date, so the list is global and permanent; "Time (opt)" is stored and never used; nothing says now / next / overdue; nothing links a task to a blocking window. Android treats a task as a **time window** with a reminder chain, optional auto-focus at the start (`autoFocusEnabled`, off by default), "keep Focus active until the task ends" (`keepFocusActiveUntilTaskEnd`, on by default) and an end-of-task alarm. | Task = start–end window; Home centres on the running or next task | A12 + A6 |
| **F26** | Keywords | **One list silently drives two different behaviours** — *blocking* a navigation (search-URL params) and *hiding* feed items (content script) — and the user cannot choose. It only applies during sessions and standalone blocks; no scope controls; no match log; the placeholder implies a comma list (B25). | Blocks a word found in a URL, a search or on-screen text during an active block; existing words are locked while a block runs; removal and "Clear all" are gated. PC adds scope toggles and a match log | Appendix G (per-keyword Block / Hide / Both and During blocks / Always) |
| **F27** | Exceptions | A hidden sub-tab with URL-prefix semantics nobody can discover; the on-screen example does not work (B10); a refused add gives no feedback (B21). | — | Renamed, correct matching (A.4), explained by Check a URL (A11) |
| **F28** | Stats | A column of today's numbers: no goal, no trend, no streak, no per-site view — and (B05) no data. | PC: goal ring, streak, focus score, insights, weekly report. Android: trends and achievements | WP8 |
| **F29** | Onboarding | Asks for one site and a 20–28-character password before the user understands what blocking does, offers no presets, never checks protection (incognito, Firefox host access) and ends on the Settings tab (B29). | Guided onboarding plus a permissions / enforcement-health screen | Appendix C.5 flow |
| **F30** | Block page | A scolding screen: stale timer, advertising, a Close button that does nothing, no explanation and no way forward. | Overlay with a custom message, quotes and a dismissal policy | WP5 #9, Appendix C.4, A7 |

**Summary of the redesign** (details in Appendices D, E, F and G, and WP7-A12):

1. **Standalone becomes "Block now" on the Focus tab**: its own site list, an absolute expiry, a live countdown. It cannot be ended early, only extended or added to, and it always has an end. "No limit" disappears; permanent blocking is the **Always-blocked** list.
2. **Strict and Commit get precise definitions** that the *background* enforces (so the shortcut cannot bypass them), and the user sees what each prevents before starting.
3. **One `guard()` function** decides allow / confirm / password / locked for every weakening action; every refusal explains itself. Adding and extending are always free.
4. **Daily allowances become a real screen** (Rules › Limits): three clearly named modes, custom values, usage bars, in-place editing, an explicit "also allow during blocks" switch, and reasons on the block page.
5. **Check a URL** (Rules) lets anyone verify what is blocked and why, so no claim has to be taken on trust.
6. **Focus and Tasks become a plan for the day** (A12): a task is a time window; the Focus tab shows what is up next and what will be blocked; tasks open on *Today*.
7. **Keywords get explicit modes** (Appendix G): each word is Block, Hide or Both, and applies During blocks or Always, with a match log.
8. **Every screen now has a verdict** in this section (F01–F30) and a spec or WP that fixes it.

---

## 5. Target architecture

### 5.1 Build and layout

```
public/
  manifest.json                 icons/icon-{16,32,48,128}.png      icon.png (kept)
src/
  shared/                       pure TypeScript; only storage.ts touches chrome.*
    types.ts  defaults.ts  storage.ts  migrate.ts
    time.ts          localDateKey, parseHHMM, isScheduleActiveAt, nextScheduleBoundary
    domains.ts       normalizeDomain, matchesDomain, ALIASES, normalizeException, matchException
    keywords.ts      splitKeywords, matchKeyword, extractSearchText
    plan.ts          computeBlockPlan, explainBlock, isBlockingActive, isFilteringActive
    allowance.ts     applyAttention, isExhausted, nextResetAt
    dnr.ts           buildDnrRules(plan, ctx) -> Rule[]
    password.ts      PBKDF2 hash/verify, legacy sha256 verify + upgrade, generate()
    gating.ts        guard(action, state) -> allow / confirm / password / locked (Appendix E) — used by UI and background
    presets.ts       web block presets
    stats.ts         streak, insights, weekly report, focus score, achievements
  background/
    index.ts         v1 bridge through WP4; promote synchronous v2 listener registration at WP5
    reconcile.ts     serialised reconcile(), rule install, tab audit
    session.ts       session engine        attention.ts   allowance tracking
    alarms.ts        ensureAlarms()         notify.ts      notifications + badge
    messages.ts      runtime.onMessage      health.ts      protection checks
  content/
    index.ts         v1 bridge through WP4; staged v2 content entry promoted at WP5; sites.ts (filter table)
  ui/                (WP5 Vite root)  popup.html  blocked.html  onboarding.html  dashboard.html
    popup/ blocked/ onboarding/ dashboard/ components/ hooks/useStorage.ts styles/tokens.css
tests/                           vitest: shared/*.test.ts, fixtures/v1-storage.json
scripts/build-extension.mjs      Vite (pages) -> esbuild (background, content) -> done
```

**Pipeline** (`npm run build`), in two stages:

1. **WP1–WP4 staging:** Vite builds the current root `index.html` with the existing `vite.config.ts`, `public/`, and `base: './'`; esbuild bundles the current bridge entries to `dist/background.js` and `dist/content.js`. These active entries continue to import the v1 worker/content behavior. Keep this build usable while v2 modules are developed and tested separately.
2. **WP5 atomic cutover:** switch Vite to `root: 'src/ui'`, `publicDir: '../../public'`, `build.outDir: '../../dist'`, `emptyOutDir: true`, and `rollupOptions.input = { popup, blocked, onboarding, dashboard }` (HTML files directly under `src/ui/` so they land at `dist/popup.html` etc.). Promote the v2 background/content entries in the same cutover.
3. `esbuild` (already a devDependency) produces `dist/background.js` (`format:'esm'`, `bundle`, `target:'chrome110'`) and `dist/content.js` (`format:'iife'`, content scripts cannot be ES modules). Run **after** Vite so it is not wiped.
4. `scripts/package-*.cjs` stay as they are (they zip `dist/`). Check that the Firefox script keeps `type: "module"` (it spreads the other `background` keys) and strips Chrome-only manifest keys (see below).

**Manifest changes**

| Key | Change |
|---|---|
| `action.default_popup` | Keep `index.html` through WP4; switch to `popup.html` in the WP5 atomic cutover, after that page exists. |
| `background` | Keep the v1 bridge active through WP4; promote `{ "service_worker": "background.js", "type": "module" }` to the v2 entry in the WP5 cutover. |
| `web_accessible_resources` | Add `[{ "resources": ["blocked.html"], "matches": ["<all_urls>"] }]` in WP5, after `blocked.html` exists. It is needed for web-initiated redirects to an extension page (**Verify** in Chrome, Edge, Firefox). Keep the page tiny and free of sensitive actions. In the Chrome/Edge packaging step only, add `"use_dynamic_url": true` (Chrome-specific; strip for Firefox). |
| `options_ui` | Add `{ "page": "dashboard.html", "open_in_tab": true }` in WP5, after that page exists. |
| `permissions` | Keep `storage tabs webNavigation alarms declarativeNetRequest notifications`; add `idle` in WP1; add `scripting` / `contextMenus` only if WP7 needs them. |
| `content_scripts[0].matches` | Keep the current supported-host table in `src/content/sites.ts`; a unit test asserts manifest matches equal the table. Finalize the table with WP4; never use `<all_urls>`. |
| `commands` | Keep `toggle-focus` (Alt+Shift+F); add `block-current-site` (Alt+Shift+B) in WP7. |
| `minimum_chrome_version` | Keep `"110"`. |
| `version` | Bump to `1.1.0` at release (WP10). |

### 5.2 Storage schema v2 and migration

All durations are **milliseconds** and carry an `Ms` suffix (v1 mixed seconds and minutes). Date keys are local `YYYY-MM-DD`.

```ts
type LockLevel = 'none' | 'strict' | 'commitment';

interface SessionState {                  // written ONLY by background
  status: 'idle' | 'work' | 'shortBreak' | 'longBreak';
  sessionId: string;
  phaseStartedAt: number;                 // epoch ms
  phaseEndsAt: number;                    // epoch ms — the ONLY source of remaining time
  phasePlannedMs: number;
  plannedWorkMs: number;                  // as chosen at start
  extendedMs: number;
  cycle: number;                          // work phases completed in this run
  lockLevel: LockLevel;
  taskId: string | null;
  blockedAttempts: number;                // during this work phase
  lastHeartbeatAt: number;
  gaps: { from: number; to: number }[];
  clockSkewDetected?: boolean;            // set when recovery observes a backward clock jump
}

interface Schedule {
  id: string; name: string; enabled: boolean;
  days: number[];                         // 0 = Sunday … 6 = Saturday
  start: string;                          // "HH:MM"
  end: string;                            // "HH:MM" or "24:00"
  sites: string[]; keywords: string[];
  useGlobalLists: boolean;                // true = also block the global lists
}

type Allowance = (
  | { mode: 'time_budget'; limitMin: number }            // X min of attention per local day
  | { mode: 'count';       maxOpens: number }            // N visits per local day
  | { mode: 'interval';    allowMin: number; everyMin: number }  // X min per rolling window of Y min (Android: "X min every Y hours")
) & { duringBlocks: boolean };                           // true = ALSO exempt the site from focus/standalone/schedule blocks while budget remains (Android semantics); false = pure cap

interface UsageRecord { dateKey: string; usedMs: number; opens: number; windowStartMs: number; lastActiveAt: number }

interface StandaloneBlock {               // "Block now" — Appendix D (port of the Android Standalone Block)
  active: boolean;
  startsAt: number;                       // epoch ms (now for "Start now")
  until: number;                          // epoch ms, REQUIRED and > startsAt — there is NO "no limit"
  sites: string[];                        // the block's OWN list; grows, never shrinks while active
  startedAt: number; extendedMs: number; blockedAttempts: number;
  lastSites: string[];                    // saved selection that prefills the next block
}

interface Task {
  id: string; title: string; description?: string;
  durationMin: number; scheduledDate?: string; scheduledTime?: string;      // "YYYY-MM-DD", "HH:MM"
  priority: 'low' | 'medium' | 'high' | 'critical'; tags: string[];
  recurring: 'none' | 'daily' | 'weekdays' | 'weekly'; templateId?: string;
  lockLevel: LockLevel; completed: boolean; completedAt?: number; createdAt: number;
}

interface SessionRecord {
  id: string; startedAt: number; endedAt: number; plannedMs: number; elapsedMs: number;
  status: 'completed' | 'abandoned' | 'interrupted';
  lockLevel: LockLevel; taskId?: string; blockedAttempts: number; gaps: { from: number; to: number }[];
  clockSkewDetected?: boolean;
}

interface DayStats {
  dateKey: string; focusMs: number; sessionsCompleted: number; sessionsAbandoned: number;
  blocks: number; blocksByDomain: Record<string, number>; tasksCompleted: number;
  mood?: number; note?: string;            // WP7-B5 (daily reflection), optional
}
```

| Key | Type | Writer | Notes |
|---|---|---|---|
| `schemaVersion` | `2` | migrate | |
| `session` | `SessionState` | **background** | default idle |
| `standalone` | `StandaloneBlock` | background (via messages) | **one key** = atomic write; no remove/stop message exists |
| `blockedSites` | `string[]` | UI | normalised domains (name kept) |
| `alwaysBlockedSites` | `string[]` | UI | new: enforced 24/7 |
| `keywords` | `KeywordRule[]` | UI | was `blockedKeywords: string[]`; Appendix G |
| `exceptions` | `string[]` | UI | was `whitelistedUrls`; normalised |
| `schedules` | `Schedule[]` | UI | |
| `allowances` | `Record<domain, Allowance>` | UI | was `dailyAllowances` |
| `usage` | `Record<domain, UsageRecord>` | **background** | replaces `dailyUsage`, `usageDate`, `cooldownEnd` |
| `tasks` | `Task[]` | UI (+ background for completion/recurrence) | |
| `sessionHistory` | `SessionRecord[]` | **background** | cap 500, drop oldest |
| `dayStats` | `Record<dateKey, DayStats>` | **background** | keep 400 days |
| `recentBlocks` | `{domain, reason, at}[]` | **background** | cap 200; replaces `temptationLog` |
| `settings` | `Settings` (below) | UI | |
| `password` | `{algo, iter, salt, hash}` or legacy | UI | |
| `health` | `Health` | **background** | heartbeat, last reconcile + error, rule count |
| `achievements`, `lastWeeklyReport`, `weeklyReports` | | **background** | `weeklyReports` keeps the last 8 summaries |
| `keywordMatches` | `{keyword, domain, where, at}[]` | **background** | ring of the last 50 (WP3/B3) |
| `backup_v1` | raw v1 values | migrate | rollback copy, deleted after 30 days |

```ts
interface Settings {
  theme: 'system' | 'dark' | 'light'; fontScale: number;             // 0.9–1.2
  dailyGoalMin: number;                                                // default 120 (PC)
  defaultDurationMin: number;                                          // 25
  breaks: { enabled: boolean; shortMin: number; longMin: number; cyclesBeforeLong: number; autoStartNext: boolean }; // 5 / 15 / 4 / false
  notifications: { sessionEnd: boolean; breakEnd: boolean; taskReminders: boolean; weeklyReport: boolean; achievements: boolean };
  reminders: { preStartMin: number[]; atStart: boolean; midSessionMin: number[]; almostDone: boolean; atEnd: boolean }; // [10,5,1] / true / [15,30] / true / true (Android)
  blockPage: { message: string; quotes: string[]; showQuotes: boolean; sound: boolean };
  contentFilters: Record<string, boolean>;                             // ids in Appendix B
  keywords: { scope: { searchQuery: boolean; url: boolean; title: boolean }; match: 'substring' | 'wholeWord' };
  allowOnly: { enabled: boolean; domains: string[] };                  // WP7 Tier B
  autoStartTasks: boolean;
}
```

**Migration v1 → v2** (`shared/migrate.ts`, a pure function `(v1Bag, now) → { set, remove }`):

* WP1 implements and tests the pure conversion and `ready()` with one shared promise. `ready()` migrates whenever `schemaVersion !== 2`, but the active v1 entrypoints must not call it before WP5.
* Activate migration only in the WP5 atomic cutover, after popup, worker, and content consumers have all switched to v2: register it in `runtime.onInstalled` and call `ready()` before any v2 state read. Do not ship or activate a partially converted consumer.
* First write `backup_v1` = JSON of every old key before writing v2 state or removing legacy keys (delete the backup after 30 days). This is the rollback path.

| v1 | v2 |
|---|---|
| `timer_isActive`, `timer_mode`, `timer_timeLeft`, `timer_totalTime`, `timer_lockLevel`, `timer_activeTaskId` | `session`: if active and `timeLeft > 0` → status `work`/`shortBreak`, `phaseEndsAt = now + timeLeft·1000`, `phasePlannedMs = totalTime·1000`, `phaseStartedAt = phaseEndsAt − phasePlannedMs`; else `idle`. Delete the six keys. |
| `standaloneMode`, `standaloneUntil` | finite `until > now` → `standalone = { active:true, startsAt:now, until, sites: normalised blockedSites, … }`. **"No limit" (`until === 0`) → `alwaysBlockedSites = blockedSites`** (permanent, removal is password-gated) with the standalone left inactive, plus a one-time notice: "Your 'No limit' block is now an Always-blocked list. Standalone blocks always have an end." (§10 Q14) |
| `blockedSites` | normalise each; drop invalid; dedupe |
| `blockedKeywords` | `keywords`: each string → `{ text, mode:'both', when:'blocks' }` (identical behaviour to v1) |
| `whitelistedUrls` | `exceptions` via `normalizeException` |
| `schedules[]` (`startTime`, `endTime`, `isActive`, `sites`, `keywords`) | `{ name: "Schedule N", enabled: isActive, start, end, sites: old.sites ?? [], keywords: old.keywords ?? [], useGlobalLists: false }` |
| `dailyAllowances` | number *n* → `{time_budget, limitMin:n, duringBlocks:true}`; `{type:'time', limit}` → `{time_budget, limitMin:limit, duringBlocks:true}`; `{type:'interval', limit}` → `{interval, allowMin:5, everyMin:limit, duringBlocks:true}` (v1 exempted listed sites during sessions, so `duringBlocks:true` preserves behaviour; the old "interval" semantics were a bug, B08) |
| `dailyUsage`, `usageDate`, `cooldownEnd` | dropped (ledger restarts) |
| `temptationLog` | `recentBlocks`; aggregate the last 30 days into `dayStats.blocks` (best effort) |
| `sessionHistory` (`duration`, `elapsed` in **seconds**) | convert to ms; `status:'active'` → `abandoned`; `endedAt = startTime + elapsed·1000` |
| `tasks` | add defaults (`priority:'medium'`, `tags:[]`, `recurring:'none'`); `durationMin = durationMinutes`; `lockLevel` from legacy `isLocked` |
| `app_password_hash` (hex SHA-256) | `password = { algo:'sha256-legacy', hash }`; upgraded to PBKDF2 on the first successful verify |

Test with `tests/fixtures/v1-storage.json` → expected v2 snapshot (include a half-finished session, an overnight schedule, a number-style allowance, a legacy password).

### 5.3 Message protocol (UI → background)

`chrome.runtime.sendMessage` with typed payloads. Every handler returns `{ ok: true, … }` or `{ ok: false, code, message }`. The **background** enforces lock rules and verifies passwords itself, so neither the popup nor the shortcut can skip them.

| Message | Payload | Rules |
|---|---|---|
| `session/start` | `{ durationMin, lockLevel, taskId? }` | rejects if running; 1–999 min; `strict` needs a password set |
| `session/stop` | `{ password?, phrase? }` | `commitment` → `LOCKED`; `strict` → valid password, or phrase `I GIVE UP` when no password is set (the UI adds a 15 s wait on the phrase path); `none` → ok (the UI shows a confirm dialog). Defined by `guard()` — Appendix E |
| `session/extend` | `{ minutes }` | any lock level; work phase only |
| `session/skipBreak` | — | any lock level |
| `standalone/start` | `{ sites, until, startsAt? }` | ≥ 1 valid site (≤ 500); `until` ≥ now + 5 min and ≤ now + 30 days; rejected while one is active; the UI shows the confirmation (Appendix D) |
| `standalone/extend` | `{ minutes }` or `{ until }` | may only **increase** `until` (cap: 30 days from now) |
| `standalone/addSites` | `{ sites }` | appends to the block's own list. **There is no remove message and no stop message** — a standalone block cannot be ended early |
| `rules/blockCurrentSite` | `{ tabId?, list: 'session' or 'always' }` | normalises, adds, reconciles |
| `tasks/changed` | — | re-plans reminders |
| `backup/import` | `{ json }` | validated; **merge-only** into a working state, free restore into an empty one (WP6 #7); allowed during a lock because it can only strengthen |
| `data/reset` | `{ password?, confirm }` | guard class X; refused during a lock; leaves the state empty |
| `health/get` | — | live checks (incognito, host access, notifications) + stored `health` |
| `reconcile` | `{ reason }` | debug / force |

Background watches `storage.onChanged` for `blockedSites, alwaysBlockedSites, keywords, exceptions, schedules, allowances, standalone, session, settings` and calls `reconcile('storage')` (50 ms debounce).

### 5.4 Invariants (each one must be covered by a test or an AC)

1. **Single writer** for `session`, `usage`, `sessionHistory`, `dayStats`, `recentBlocks`, `health`, `achievements`, `lastWeeklyReport` = background. The UI never writes them.
2. The UI never decides "is blocking active"; it calls `isBlockingActive(state, now)` from `shared/plan.ts` (same function the worker and content script use).
3. Remaining time = `max(0, phaseEndsAt − now)` computed at render. **No timer state is stored or written per second.** Expected storage writes during a running session: ≤ 1 per minute (heartbeat).
4. DNR rule IDs are fixed: `1` main redirect, `2` allow-only redirect, `100+i` exception allows. Always one `updateDynamicRules({removeRuleIds, addRules})` call.
5. At most one `reconcile()` runs at a time; calls during a run coalesce into one follow-up.
6. Every alarm is created via `ensureAlarms()` (`alarms.get(name)` first). Nothing calls `alarms.create` at module top level.
7. At the WP5 cutover, every active v2 worker entry point awaits `ready()` before reading state. Before that cutover, the v1 bridge remains active and no v2 entrypoint may call `ready()` or mutate extension state.
8. Date keys = `localDateKey(date)` (`YYYY-MM-DD`, local time). Never `toLocaleDateString()`.
9. Stored domains are always normalised (lower-case punycode, no scheme, `www.`, path or port).
10. Block attempts are logged only through `recordBlock()` with a 3 s dedupe window per `(tabId, domain)`.
11. **Atomic transitions.** Every state transition writes all the keys it touches in **one** `chrome.storage.local.set` (a phase end writes `session`, `sessionHistory`, `dayStats` and `tasks` together), so a killed worker can never leave a half-applied change.
12. **Idempotent advance.** `advancePhase` is a compare-and-swap on `session.sessionId` + `phaseEndsAt`. The alarm, the `tick`, recovery and message handlers may all call it; only the first caller wins, the others are no-ops.
13. **Untrusted fragment.** `blocked.html` is web-accessible, so any website can send a visitor there with any `#…`. Treat `location.hash` as hostile: render it with `textContent` (host and path only), never as `href` or `innerHTML`, and offer "Open site" only for `http:`/`https:` URLs that `explainBlock` no longer blocks.
14. **Time zones.** Schedules and day keys use the *current* local zone at evaluation time. Nothing caches a local-midnight timestamp across a zone change; recompute on every tick.

---

## 6. Work packages

Effort numbers are rough working days for one agent. **Do not start WP7 until M1 (WP0–WP3) passes its AC.**

### WP0 — Repo hygiene and tooling · 0.5 d · fixes R01–R03, R05

**Tasks**
1. `package.json`: `name: "focusgate"`, `version: "1.1.0-dev"`; remove `express`, `@types/express`, `dotenv`, `tsx`; `clean` → `rm -rf dist build`; add scripts `typecheck` (`tsc --noEmit`), `test` (`vitest run`), `build` (`node scripts/build-extension.mjs`, written in WP1).
2. Delete `patch_req.cjs`. Add `.gitignore` (`node_modules`, `dist`, `build`, `*.log`) and untrack `dist/` (`git rm -r --cached dist`). The CI workflow builds it.
3. Check the GitHub repo for the files missing from the upload (§1.2). If they exist, leave them. If not: add `LICENSE` (MIT, as the README states), a skeleton `STORE_LISTING.md` and `docs/privacy-policy.html`. **Do not write marketing copy that §4.7 shows to be false.**
4. Run `npm run typecheck`, record the baseline error list in the PR description (expect the L1197 comparison and prop-type hacks).
5. Add `vitest` and an empty `tests/` folder with one smoke test; add `CHANGELOG.md`.

**AC:** `npm ci && npm run typecheck && npm test` run (typecheck may still list legacy errors until WP5 deletes `App.tsx`); `dist/` is untracked; `patch_req.cjs` is gone; `package.json` has no server dependencies.

---

### WP1 — Foundation: shared core, build pipeline, storage layer, migration · 2 d · fixes B02 (part), R04, R06

**Tasks**
1. Create `src/shared/*` as listed in §5.1 with **unit tests for every pure module** (see §8.1 for the case list). `tsconfig`: `"strict": true` (apply to new code; legacy files may be excluded until WP5).
2. Convert `public/background.js` and `public/content.js` to `src/background/*` and `src/content/*` bridge shells. Implement `scripts/build-extension.mjs`; update safe base manifest fields, permissions, and the supported-host table. Keep the current popup and v1 behavior active until the WP5 cutover; do not point the manifest at pages that do not exist yet.
3. `shared/storage.ts`: typed `getState()` (one `storage.local.get` of all known keys, with defaults), `patch(partial)`, `update(key, fn)` (get → fn → set), `onStateChanged(cb)`.
4. Implement and test `shared/migrate.ts` + `ready()` as in §5.2. Keep migration activation out of runtime entrypoints until the WP5 atomic cutover.
5. Keep the old `public/background.js` and `public/content.js` active through WP4. Remove them only in WP5 after every v1 storage consumer has been replaced.

**AC:** `npm run build` produces the staged `dist/` with the current UI and v1 bridge behavior; `npm test` is green; the migration test passes on the v1 fixture; `ready()` is idempotent across 10 concurrent calls. Chrome/Edge/Firefox install and upgrade validation runs in WP9 after the WP5 cutover.

---

### WP1b — De-risking spikes · 1 d · required before affected runtime acceptance/cutover, not code-only WP2/WP3 work

The owner deferred these browser tests because a controllable Chrome/Edge/Firefox environment is unavailable. WP2/WP3 module and unit-test work may proceed using the documented conservative fallbacks; this does **not** verify or authorize affected runtime behavior. Complete the relevant spikes before WP5 cutover and before M1 is marked green. Use a throw-away branch (a bare-bones extension, no real UI), record browser versions and observed page output in `docs/spikes.md`, and update this plan if a result changes an assumption.

| Spike | What to prove | Pass when | If it fails |
|---|---|---|---|
| **S1 — Redirect that keeps the original URL** | One DNR dynamic rule: `requestDomains: ['example.com']`, `regexFilter: '^(https?://.+)$'`, `regexSubstitution: runtime.getURL('blocked.html') + '#\\1'`, `resourceTypes: ['main_frame']`; `blocked.html` prints `location.hash`. Test a typed URL, a link click from another site, `window.open`, a redirect chain, a URL containing `&`, `?` and `#`, each **with and without** `web_accessible_resources`. | It lands on `blocked.html` with the full original URL in every case, in Chrome, Edge and Firefox | **Plan B:** redirect to `extensionPath: '/blocked.html'` and have the worker store the pending URL per tab in `storage.session` from `webNavigation.onBeforeNavigate` (it fires before the redirect); the page reads `chrome.tabs.getCurrent()` and `storage.session['blocked:' + tabId]`. **Plan C** (only if A and B fail): DNR `block` plus the fallback listeners (`tabs.update`), accepting a short flash |
| **S2 — Attention sampling** | Log `windows.getLastFocused`, the active tab, `idle.queryState(60)` and `tab.audible` every 5 s while you switch windows, minimise, lock the screen, play video in a background tab and use a second monitor | It never credits an unfocused or minimised window and does credit an audible video tab; OS differences (macOS full-screen spaces, Linux focus quirks) are written down | Count only "focused and active" and make "count background audio" a setting that is off by default |
| **S3 — Alarms and worker lifecycle** | `alarms.getAll()` before and after stopping the worker and after a browser restart; confirm that re-creating an alarm with the same name resets it (B13); confirm the minimum period | `ensureAlarms()` is idempotent and an alarm fires with the popup closed after the worker was stopped | Re-arm every alarm in `onStartup`, `onInstalled` and at the top of every handler |
| **S4 — Firefox MV3** | `background.scripts` with `type: "module"`; DNR with `regexSubstitution` to a `moz-extension://` URL; host-permission opt-in (`permissions.contains` and a `request` on a user gesture); `idle`; `notifications` (no buttons); `storage.session` | Each works, or has a documented limitation that Protection status will show | Ship Firefox as best effort (§10 Q10) and gate the unsupported features behind feature detection |

**AC:** `docs/spikes.md` exists with a pass/fail line per spike, the redirect design chosen (A, B or C), and any plan assumption that changed.

---

### WP2 — Session engine owned by the background · 3 d · fixes B01, B05, B06, B07, B13 (standalone alarm), H02, H13, H14

**Pre-cutover staging rule:** implement and test v2 modules without replacing the active v1 background or popup, calling `ready()` from runtime entrypoints, or enabling v2 message handlers. Stage the timer view outside the current popup. Until WP1b.S2/S3 are verified, count attention only for a focused window and active tab, leave background-audio credit off, and re-arm alarms idempotently on install, startup, and at handler entry. Run browser acceptance criteria after the WP5 cutover.

**Implementation decisions (owner-authorized 2026-10-28):**

* Keep the v1 popup and worker active; v2 session services, message handlers, alarm handlers, and timer UI remain staged and are not registered or mounted before the WP5 cutover. Inject storage, clock, alarm, notification, badge, and reconciliation dependencies so unit tests can exercise behavior without activating v2 consumers or calling `ready()`.
* Resolve the Strict-mode wording conflict in favor of Appendix E.2 and WP2.AC5: with a password, stopping requires background verification; without one, stopping requires the exact `I GIVE UP` phrase and a 15-second wait enforced by the background.
* Preserve a backward-clock recovery signal in the optional `clockSkewDetected` field on the session and its resulting record. A backward jump beyond 60 seconds extends the phase end by the measured delta; the flag is reset at the next phase.
* Keep core state transitions authoritative even if notification or badge APIs fail. Serialize session operations, re-read before each transition, and write the session/history/stats/task changes for a phase end in one storage update; alarm/reconcile work is retried through startup/handler recovery.

**Behaviour**

* `session/start` builds `SessionState`, writes it, creates alarm `session_phase_end` at `phaseEndsAt`, sets the badge, calls `reconcile()`. History is written **when a work phase ends**, never at start (so there are no orphan "active" records).
* **Phase end** (`advancePhase`): a completed work phase → (if `settings.breaks.enabled`) short or long break, else idle; an interrupted recovered work phase is recorded and ends idle without starting a break or next work phase. Break → (`autoStartNext` ? next work phase : idle). A long break comes every `cyclesBeforeLong` completed work phases. Default `breaks = { enabled:true, shortMin:5, longMin:15, cyclesBeforeLong:4, autoStartNext:false }` reproduces today's "work → 5-min break → done". `autoStartNext:true` is the PC "Pomodoro" mode.
* Blocking is active **only** in the `work` phase (plus standalone/schedules/always-blocked, which are independent of the session).
* `session/stop`: finalise the work phase as `abandoned` (`elapsedMs = now − phaseStartedAt`), clear alarms, set idle. In a break → idle with no record. Lock rules per §5.3 and Appendix E, enforced by the background. A Normal-session confirmation is collected by the UI; it is not a substitute for background enforcement of Strict or Commitment.
* `session/extend` (+10/15/20/30/45/60 min, Android `ExtendModal`): `phaseEndsAt += ms; plannedMs += ms; extendedMs += ms`, reschedule the alarm.
* **Recovery** `recoverSession(now)` runs from `runtime.onStartup`, `onInstalled` and the first line of every alarm handler: while `now ≥ phaseEndsAt` call `advancePhase('recovered')` (max 10 iterations). If `now − lastHeartbeatAt > 3 min` during a running phase, push a gap; if gaps cover more than 50 % of the phase → record `interrupted` (not counted as focus time) and return to idle without starting a break, else record `completed` and follow the normal phase transition. If `now < lastHeartbeatAt − 60 s` (clock moved back) → `phaseEndsAt += lastHeartbeatAt − now` and flag the record.
* **Heartbeat/tick**: one 1-minute alarm `tick` updates the badge, writes `session.lastHeartbeatAt` and `health.lastHeartbeatAt`, runs allowance attention accounting and recovery.
* **Badge**: `action.setBadgeText` = minutes left (ceil; `<1` in the last minute); green for work, blue for break; when only a standalone block is active show `ON`; empty when idle. `action.setTitle` = "FocusGate — 24 min left".
* **Notifications** (respect `settings.notifications`): session end ("25 min done — nice work"), break end, extension of locks. Use `iconUrl: 'icon.png'` (exists). Buttons only where supported (feature-detect; Firefox ignores them).
* **Shortcut `toggle-focus`**: idle → start `settings.defaultDurationMin`, lock `none`, with a "Focus started — 25 min" notification; running + lock `none` → stop; running + locked → notification "This session is locked", do nothing.
* **Task link**: on a completed work phase mark the linked task completed (`update('tasks', …)`). If the task is deleted/completed elsewhere, the session **keeps running** (this removes the B07 effect entirely).
* **Remove fullscreen logic** (H02) from the UI. Locked sessions show the existing "timer-only" screen.
* **Standalone expiry**: `standalone_end` alarm armed by `ensureAlarms()` on every start-up and storage change; plus the check is always time-based so a missed alarm cannot leave it active.

**Tasks**
1. `shared/plan.ts` `isBlockingActive` + session helpers; `background/session.ts`; `background/alarms.ts` (`ensureAlarms`); `background/notify.ts` (badge + notifications); `background/messages.ts` handlers for the `session/*` messages.
2. Prepare the v2 timer view (`TimerView`) in the staged UI: read `session`, render `max(0, endsAt − now)` with a 1 s `setInterval` that **only sets local React state**, and send messages for start/stop/extend. Promote it into the active popup and remove v1 timer writes only in the WP5 cutover.
3. Write `sessionHistory` and `dayStats` at phase end (`SessionRecord`, `DayStats`); cap history at 500.
4. Replace the keyboard command handler.

**AC**

Run these browser/runtime acceptance criteria after the WP5 atomic cutover; before then, WP2 verifies the engine and staged UI with unit tests and v2 fixtures while the v1 runtime remains active.
1. Start a 2-min session, **close the popup**, wait: at 2:00 a notification appears, the badge changes to break, sites unblock during the break, and after the break the state is idle. `sessionHistory` has one `completed` record with `elapsedMs ≈ 120 000`.
2. Stop the service worker from `chrome://extensions` mid-session → remaining time is still correct on next wake and the session ends on time.
3. Close the browser mid-session, reopen after the end → the session is finalised (completed/interrupted per the gap rule); nothing is stuck; the badge is clear.
4. `commitment`: no stop button; `session/stop` returns `LOCKED`; the shortcut shows "locked" and does nothing; the session ends by itself.
5. `strict`: wrong password rejected **by the background**; the shortcut cannot stop it; with no password set, the phrase `I GIVE UP` is required.
6. Extend +15 works in all lock levels and moves the ring, badge and alarm.
7. Open/close the popup 20× mid-session (with and without a linked task): the session never changes (B07).
8. Two popups/tabs open at once: no double-decrement. Storage writes during a session ≤ 1/min (measure with the worker console).
9. `autoStartNext` with 2 cycles alternates work/break correctly and takes a long break at the Nth cycle.
10. Stats › Session History shows UI-started sessions (B05); C06–C11 in §8.4 pass.

---

### WP3 — Blocking engine · 4 d · fixes B02–B04, B08–B12, B15, B18, B19, B23 (engine part), B26, B27, B30; H05, H06, H10

**Pre-cutover staging rule:** build and test the v2 planning/reconcile/listener modules without registering them in the active v1 worker or installing v2 DNR rules. Do not call `ready()` from these modules before WP5. S1's redirect design remains provisional: pure planning and rule-building work may proceed, but do not activate navigation enforcement or claim redirect behavior until S1 is verified. Run browser/runtime acceptance criteria after the WP5 atomic cutover.

**Owner-authorized verification scope (2026-10-28):** Complete WP3 implementation and deterministic module/unit verification while deferring real-browser verification. Browser/runtime behavior is not established by unit tests, and no v2 enforcement may be activated before S1 and the WP5 atomic cutover. Keep browser-dependent acceptance criteria open. UI work that depends on the WP5 Rules/block-page screens or WP7 Check-a-URL/alias controls remains incomplete until those screens are implemented; do not treat staged engine modules as proof that those UI integrations exist. The owner confirmed on 2026-10-28 to preserve WP5/WP7 sequencing rather than pull those UI/cutover pieces into WP3.

**Behaviour**

1. **One pure decision function** `computeBlockPlan(state, now)` → `{ blocked: Map<domain, Reason>, allowOnly?, keywords[], exceptions[], nextBoundaryAt }`, plus `explainBlock(url, state, now)` used by the fallback listeners and the block page. See Appendix A.3 for the precedence rules and the allowance decision.
2. **One installer** `reconcile(reason)` in `background/reconcile.ts`: serialised, `try/catch`, writes `health.lastReconcileAt/Error/ruleCount`, installs rules from `buildDnrRules` (Appendix A.6) in **one** `updateDynamicRules` call, arms a single `boundary` alarm at `nextBoundaryAt`, audits open tabs **only for domains that just became blocked** (compare with the previous plan hash in `storage.session`); in addition the 1-minute `tick` re-checks open tabs while any blocking is active, as a safety net for events the browser did not fire (for example back/forward-cache restores) — deduplicated by `recordBlock`.
3. **DNR design**: a single redirect rule with `requestDomains: [...]`, `regexFilter: '^(https?://.+)$'` and `regexSubstitution: <blockedBase>#\\1`, where `<blockedBase>` = `chrome.runtime.getURL('blocked.html')`; `resourceTypes: ['main_frame']`. Exceptions = `allow` rules (priority 2). The original URL travels in the **fragment**, so `&`, `?` and `#` inside it need no escaping. The block page reads `location.hash.slice(1)`.
4. **Inputs are normalised and validated at entry** (`normalizeDomain` via `new URL('http://' + input).hostname` → punycode, lower-case; reject spaces, commas, empty strings and anything that does not parse as a hostname; strip scheme/`www.`/path/port). The UI shows an inline error. The engine additionally skips any invalid stored entry, installs the rest, and records the problem in `health` (B26).
5. **Aliases** (B30): `ALIASES = { 'x.com': ['twitter.com','t.co'], 'youtube.com': ['youtu.be','youtube-nocookie.com'], 'facebook.com': ['fb.com','fb.watch','messenger.com'], 'reddit.com': ['redd.it'], … }` — adding one blocks the whole group; the UI shows the group as chips.
6. **Schedules** (B04, B15): new shape (§5.2) with name, own `sites`/`keywords` and `useGlobalLists`. `isScheduleActiveAt` = Appendix A.1 (overnight, `24:00`, end exclusive, previous-day rule). `nextBoundaryAt` = nearest schedule start/end within 8 days, standalone start/end, allowance window expiry, next local midnight.
7. **Allowances** (B08, B09, B27, H05): three modes from Android (`time_budget`, `count`, `interval`) with a real ledger (Appendix A.2) fed by **attention tracking** (focused window, active tab, user not idle, or tab audible). Every entry is a **cap** (blocked once the budget is used up) and, when its **`duringBlocks`** switch is on (default, Android semantics), also a **metered exemption** (allowed during session/schedule/standalone blocks while budget remains). `alwaysBlockedSites` always win. Full feature spec: **Appendix F** (decision in §10, Q3).
8. **Exceptions** (B10): Appendix A.4 (normalise → boundary-checked prefix match; DNR allow rule from the same normalised entry). Exceptions override session, schedule, standalone, allowance and keyword blocks.
9. **Keywords** (B19; rule model in **Appendix G**): `settings.keywords.scope` (`searchQuery`, `url`, `title`) and `match` (`substring` | `wholeWord`). Search params: a host table in `keywords.ts` (yahoo `p`, yandex `text`, baidu `wd`, youtube `search_query`, amazon `k`, …) plus the generic `q` and `query` everywhere. **Do not read `p` generically** — many sites use it for page numbers or post IDs. Page-title matching needs the content script (WP4). Keep a `keywordMatches` ring (last 50: keyword, domain, where, time) for the UI (PC `KeywordMatchLogger`).
10. **Fallback listeners** (`webNavigation.onCommitted`, `onHistoryStateUpdated`) with `{ url: [{ schemes: ['http','https'] }] }`: call `explainBlock`; if blocked → `recordBlock` + `tabs.update(tabId, { url: blockedBase + '#' + url })`. **Delete** the `tabs.onUpdated` fallback and the audit-inside-every-update loop.
11. **`recordBlock`** (B12): 3 s dedupe per `(tabId, domain)`, appends to `recentBlocks` (cap 200), increments `dayStats[today].blocks` and `blocksByDomain`, and `session.blockedAttempts` while a work phase runs.
12. Alarms: `tick` (1 min), `boundary`, `session_phase_end`, `weekly_report`, `midnight` — all through `ensureAlarms()`.

**AC**
1. Block `example.com`, start a session: typed URL, link click, new tab, and an SPA route change all end on `blocked.html` with the original URL and the reason "Focus session — 12:30 left". **No flash of the target page.** Works again after stopping the service worker.
2. `notexample.com`, `example.com.au`, `example.community` are **not** blocked; `www.example.com` and `a.b.example.com` are.
3. Exception `youtube.com/watch?v=abc` allows `https://www.youtube.com/watch?v=abc&t=5` but not `…?v=abcd` or `youtube.com/`; `youtube.com.evil.test` is unaffected by it.
4. Schedule 09:00–17:00 Mon–Fri: at 08:59 free, at 09:00 blocked **with no user action**, at 17:00 free again with no user action. Overnight 22:00–06:00 ticked for Monday blocks Tue 02:00 but not Tue 22:00 (unless Tuesday is ticked). `24:00` end works. A schedule with its own list blocks only that list; with `useGlobalLists` it also blocks the global list; editing the global list changes the latter immediately.
5. Allowances: `time_budget 2 min` → after ≈2 min of **focused, active** viewing the site is blocked until local midnight; a background tab, an unfocused window or idle time does **not** count. `count 2` → the third visit is blocked. `interval 1 min / 5 min` → blocked after 1 min used, free again 5 min after the window started. Remaining budget is visible in the UI. A site with `duringBlocks` on and budget remaining never flashes (B27); with it off it stays blocked during blocks.
6. Keywords: `q`, `query`, `search_query`, `text`, `wd` are matched; comma-separated input becomes several keywords (B25); whole-word mode lets "essex" through for keyword "sex"; YouTube in-page search is blocked.
7. Inject a garbage/IDN entry directly into storage: the rest of the rules still install; Protection status shows the error (B26).
8. Add 10 sites in quick succession: one consistent rule set, no "duplicate rule ID" error in the worker console (B18).
9. One block = one `recentBlocks` entry and one `dayStats` increment, however many paths fired (B12).
10. After a schedule or standalone block ends, `chrome.declarativeNetRequest.getDynamicRules()` no longer contains its domains **without any storage change** (B04). Rules survive a browser restart.

---

### WP4 — Content script · 1.5 d · fixes B14, B23; H04

**Pre-cutover staging rule:** implement the v2 content script as a staged entry; keep the current manifest and v1 content script active until WP5. Do not replace `dist/content.js` or delete the old public scripts during WP4. Run browser acceptance criteria after the WP5 atomic cutover.

**Owner-authorized WP4 staging scope (2026-10-28):** Begin staged WP4 implementation while WP3 remains in progress; this does not close WP3's deferred UI, cutover, or browser gates. Keep the active manifest and v1 content entry unchanged; build v2 separately as `content-v2.js`. Site selectors remain unverified until live browser inspection, so no verification dates or runtime acceptance claims are made.

**Tasks**
1. `src/content/sites.ts`: data table of supported sites and filters (Appendix B). Implement the v2 content entry as a staged module; it loads `session`, `standalone`, `schedules`, `settings.contentFilters`, and `keywords` from storage; computes `isFilteringActive(state, now, host)` with the **same** function as the worker; subscribes to `storage.onChanged`; sets a `setTimeout` for the next schedule boundary and re-evaluates on `visibilitychange`. Keep `src/content/index.ts` on the v1 bridge until WP5 promotes the staged entry.
2. **CSS-first**: inject one `<style id="focusgate-filters">` containing the CSS for every enabled filter (instant, reversible, no observer needed). **Keyword hiding** adds `data-fg-hidden="1"` to matching containers, with `[data-fg-hidden]{display:none!important}` in the style block; restoring = removing the attribute.
3. `MutationObserver` on `document.documentElement` (never `document.body`), 200 ms debounce, attached only when filtering is active **and** keywords exist; disconnect otherwise; no early assignment before a successful `observe`.
4. Host matching = exact host or `.suffix` (never `includes`).
5. Keep `manifest.content_scripts[0].matches` aligned with the table; unit test keeps them equal. Activate the v2 content entry and final host set only in WP5.
6. YouTube SPA: re-run on the `yt-navigate-finish` event.
7. Replace the hard-coded Shorts/Reels/TikTok hiding with the toggles from `settings.contentFilters` (UI in WP7-A8). **Defaults for existing users: ON for the three that were previously unconditional** so behaviour does not silently change.
8. Keep the old `public/content.js` and `public/background.js` active until WP5. Delete them only in the atomic cutover task below.

**AC:** after WP5 cutover, each toggle works and is reversible without a reload; no console errors on a cold `document_start` load (repeat 20×); filters are off during breaks and outside blocking contexts, on during schedules; removing a keyword un-hides items; no content script is injected on unsupported sites; a processing pass costs < 5 ms per mutation batch on a YouTube home feed (Performance panel). C23 passes (§8.4).

---

### WP5 — UI foundation and screen fixes · 4–5 d · fixes B16, B17, B22, B25, B28, B29, U01–U14, H09/H10/H16 (UI part); most ❌ UI rows in §4.7

**Owner-authorized gate deferral (2026-10-28):** The owner authorized beginning WP5 UI implementation while WP1b browser spikes and WP4 live-selector/runtime acceptance remain incomplete. This permits staged UI code and deterministic checks only; it does not establish browser behavior or authorize v2 activation. Keep the active v1 manifest, popup, background, and content entrypoints unchanged, do not call `ready()` from a runtime entrypoint, and do not remove legacy consumers. WP1b remains required before M1 is green and before the WP5 atomic cutover; WP2–WP4 browser/runtime acceptance must still be run on the cutover build. Keep those gates open until observed evidence is recorded.

**Tasks**

1. **Split the pages and fix the size (U01, U02).** `popup.html` (fixed **380 × 580** via CSS on `html, body` — `width:380px; height:580px; margin:0; overflow:hidden`; root = flex column: header 48 px / `main` `flex:1; min-height:0; overflow-y:auto` / nav 56 px), `blocked.html` (full viewport, responsive), `onboarding.html` (full tab, centred column max 480 px), `dashboard.html` (full tab: Stats, Reports, advanced Rules, Settings, Backup). Delete the `?blocked` / `?onboarding` role flags and the `sm:w-[400px]` classes. The block page and onboarding must render their final screen on first paint.
2. **`useStorage` hook + `<StorageGate>` (U03, B07).** One module-level store per page with `useSyncExternalStore`; `useStorage(key)` returns `{ value, ready, set }`; `set` accepts a value or an updater that receives the **latest** value; subscribes to `chrome.storage.onChanged`; falls back to `localStorage` only when `chrome.storage` is undefined (Vite dev). `<StorageGate keys={[…]}>` renders a skeleton until every key is `ready`, so there is **no default-value flicker** and no effect can run on half-hydrated state. Nothing re-renders every second except the timer text itself.
3. **Design tokens + components (Appendix C):** `Button`, `IconButton` (always visible, `aria-label` required), `Card`, `Toggle` (switch role), `Field` (label, helper, error), `Modal` (focus trap, Esc, restores focus), `Toast`, `ConfirmDialog`, `Tabs`/`Segmented`, `Chip`, `EmptyState`, `ProgressRing`, `PasswordField`. Theme via CSS variables: `system` / `dark` / `light` (U11); `prefers-reduced-motion` respected (U14). Minimum text 12 px, contrast ≥ 4.5 : 1 (U04). Remove `pb-safe`, fix the nav indicator by making each nav button `relative` (U05).
4. **Replace every `alert()`** with `Toast` or `ConfirmDialog` (U06). Disabled actions must show *why* (a tooltip or helper line), e.g. "Locked by your standalone block until 17:00" (U12).
5. **Information architecture (U07, U08).**
   * Header: logo, title, **status chip** ("Idle", "Focus 24:10", "Blocking until 17:00", "Break 3:00") and a **protection dot** when `health` reports a problem (WP6).
   * Popup tabs: **Focus**, **Tasks**, **Rules**, **Stats**, **Settings**. The Focus tab has a mode switch **Focus timer | Block now** (Appendix D); the standalone block is **not** a Settings card any more.
   * **Rules** segments: *Sites* · *Exceptions* (renamed from Whitelist) · *Keywords* · *Schedules* · *Limits* (daily allowances move here from Settings).
   * **Settings** sections: *Security*, *Timer & breaks*, *Notifications*, *Block page*, *Content filters*, *Protection*, *Data*, *About* (How-to, links, the "Also check out…" promo).
6. **Focus view.** Duration = preset chips (15 / 25 / 45 / 60 / 90) + a text field that keeps a **string** state and commits on blur/Enter (B22); lock level = 3-way segmented control with a one-line description below (U09) **and the "what this prevents" summary line from Appendix E.5**; big ring + `max(0, endsAt − now)`; buttons Start / Extend / Stop / Skip break per lock rules; when no sites are blocked show an inline hint "Add sites in Rules first".
7. **Tasks view.** Fix B16 (lock only while that task's session is running); allow restarting a completed task; show task date/time; remove the scratch comment in `toggleTask`. (Richer fields arrive in WP7-A6.)
8. **Rules view.** Each site row shows *when* it blocks as chips (Focus · Always · Schedule name) with a live "blocked now" dot, and a **Check a URL** field sits at the top (WP7-A11). Domain inputs validate inline (B26) and accept pasted URLs; **keyword input splits on commas/newlines**, trims, lower-cases, dedupes (B25), and offers the **Block / Hide / Both** mode and the **Always** switch (Appendix G); delete buttons are always visible (U09); schedules get **name, edit, own lists / "also block global lists"** and an "End of day (24:00)" option; the Limits segment (daily allowances) is the **Appendix F** screen: usage bars, three modes, presets *and* custom values, the `duringBlocks` switch and in-place editing.
9. **Block page (`blocked.html`).** Reads the original URL from `location.hash`; computes the reason with `explainBlock` and shows it ("Focus session — 12:30 left", "Schedule 'Work hours' until 17:00", "Daily limit reached — resets at midnight", "Always blocked", "Keyword 'xyz' in your search"); countdown from `session.phaseEndsAt` (session) or `standalone.until` (standalone block) **only** for those two reasons (fixes B28); today's block count from `dayStats` (fixes C38); a quote/message (WP7-A7); buttons **Close tab** (`chrome.tabs.getCurrent` → `chrome.tabs.remove`, fixes B17) and **Open new tab**; no promotional footer. The URL in the fragment is **untrusted** (invariant 13): render it as text only. If the block ends while the page is open (session end, schedule end, allowance reset), replace the reason with "Block ended" and offer **Open {host}** — only for `http:`/`https:` URLs that `explainBlock` now returns `null` for. Verify the page renders without the popup bundle (small, fast).
10. **Onboarding (B29).** Steps: Welcome + goal → pick presets/sites → password (optional, with honest trade-off copy) → **Protection check** (incognito, Firefox host access, notifications) → Done. The final button is **"Open FocusGate"** and closes the tab / opens the popup guidance; it never lands on Settings.
11. **Copy pass.** Replace the claims in §4.7 using the table below, then re-read every string for banned words (*completely, instantly, cannot, always, guaranteed*).
12. **A11y pass (U13):** labels on all controls, `:focus-visible` ring, focus trap in modals, no colour-only status, tab order = visual order, keyboard-only walkthrough of every screen.
13. Delete `src/App.tsx` and `src/hooks/useChromeStorage.ts` when every view has moved. `npm run typecheck` must be clean with `strict`. Then perform the atomic v1 → v2 cutover: only after the v2 UI, worker, and content modules are ready, switch the active popup/pages and background/content build entries, update manifest routes and permissions, remove the old v1 consumers, register `runtime.onInstalled` migration, and require `ready()` before every v2 state read. `backup_v1` must be written before any legacy key is removed. Run the migration fixture and all WP2–WP4 browser/runtime acceptance criteria against the cutover build before calling WP5 complete.

**Replacement copy (use these, or equally honest wording)**

| Where | New copy |
|---|---|
| Rules › Sites | "Pages on these sites are blocked while a focus session, schedule or standalone block is running. Embedded content on other sites is not affected." |
| Rules › Exceptions | "Allow one page even when its site is blocked. Example: `youtube.com/watch?v=abc123` (`https://` and `www.` are optional)." |
| Rules › Keywords | "Blocks searches and page addresses that contain these words. Separate several with commas." |
| Rules › Schedules | "Block these sites on the days and hours you choose. Each schedule can have its own list." |
| Limits | "Free browsing up to the limit, then blocked until the limit resets." (+ a mode description under the selector) |
| Lock: Strict | "Ending early needs your password (or a typed confirmation). This slows you down; it cannot stop you from disabling the extension." |
| Lock: Commit | "No stop button — the session ends when the timer does. You can still disable the extension (see Protection)." |
| Settings › Password | "Required to remove blocked sites, keywords, schedules or limits, to end a Strict session early, and to change or remove this password. A standalone block can't be ended early at all." |
| Block now (standalone) | "Block the sites you choose until a time you pick. Once it starts you can add sites or extend it, but you can't end it early." Confirmation: "Block {n} sites until {date time} ({duration})? You won't be able to end this early." |
| Tasks empty state | "No tasks yet. Add one to plan your next focus session." |
| manifest/store description | Until WP7-A3 ships: "Block distracting websites and keywords with a focus timer, schedules and daily limits. Your data stays in your browser." After A3: add "Quick presets for social media, video and news." |

**AC**

1. The popup is exactly 380 × 580 on every tab, with no size jump when switching; the block page and onboarding show their final UI on first paint (record a screen capture at 4× CPU throttle).
2. `grep -R "alert(" src` returns nothing. No `window.close()` for tab closing.
3. Light and dark themes both pass a contrast check; every control is reachable and operable with the keyboard only; modals trap and restore focus; Lighthouse accessibility ≥ 95 on each built page.
4. Typing "25" in the duration field works naturally; typing `funny shorts, #gaming` creates two keywords; pasting `https://www.Reddit.com/r/all` into Sites stores `reddit.com`.
5. All ❌/⚠️ UI rows assigned to WP5 in §4.7 now pass in §8.4 (C05, C12, C14, C15, C22, C34, C36–C40 …); the atomic cutover activates every v2 consumer together, the v1 fixture migrates with `backup_v1` written before legacy-key removal, and the WP2–WP4 runtime acceptance criteria pass on the cutover build.

---

### WP6 — Security, standalone, protection status, backup · 2–3 d · fixes B20, B21, B24; H07, H11, H12

**Tasks**

1. **`shared/password.ts`:** PBKDF2-SHA256, 600 000 iterations, 16-byte random salt (Web Crypto), stored as `{algo:'pbkdf2-sha256', iter, salt, hash}`; `verifyPassword` also accepts the legacy `sha256-legacy` record and **upgrades it on the first successful verify**. Generator: `crypto.getRandomValues`, alphabet `ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789` (no look-alikes), length 20–28 — this is the PC `PinPolicy`.
2. **Policy:** custom password **8–64 characters** (PC `PinPolicy.MIN_LENGTH = 8`), with a strength hint and "Generate (recommended)". *(See §10 Q5 — the old UI forced 20–28.)*
3. **`PasswordField`:** show/hide toggle, **visible by default** (these are long strings typed by hand; hidden typing hides typos). Setup field: copy and paste allowed. Unlock field: **paste blocked** (typing friction is the feature) and autofill allowed; do not disable the button until 20 characters — disable until ≥ 8 and let verification decide.
4. **One guard function** `guard(action, state)` in `shared/gating.ts`, returning `allow` / `confirm` / `password` / `locked` exactly as specified in **Appendix E**. The UI uses it to disable controls and explain why; `messages.ts` uses it to enforce. Table-driven test over every action × state (closes B24, F06, F13). Strengthening actions are never gated.
5. **Standalone Block v2 (B21, H07, F01–F07):** implement **Appendix D** in full — it replaces the Settings card. Delete the old Settings › Standalone card, `standaloneUnlimited`, `startStandalone` and every "No limit" path. `standalone` is one storage key (atomic write). Nothing in the UI, the shortcut or the message API can end a running standalone block early.
6. **Protection status card** (Settings › Protection, mirrored by the header dot): incognito access (`chrome.extension.isAllowedIncognitoAccess()`), host-permission granted (`permissions.contains`; offer `permissions.request` on a user gesture — mainly Firefox), notifications allowed, last heartbeat age, last reconcile time + error, DNR rule count, **protection gaps in the last 7 days** (from session gaps). Include an "Open extension settings" link (`chrome://extensions/?id=<id>`, `edge://extensions/?id=<id>`; Firefox `about:addons`; feature-detect). Copy states the limits from §3.
7. **Backup / Restore — restoring can never weaken.** *Export* writes JSON `{ app:'focusgate', schemaVersion:2, exportedAt, data:{ sites, alwaysBlockedSites, keywords, schedules, allowances, exceptions, tasks, settings, stats } }` — **never** the password record or runtime keys (`session`, `usage`, `health`, `standalone`). *Import* validates structure and types, rejects an unknown or future `schemaVersion`, caps the size at 2 MB and previews counts. What it does depends on the current state:
   * **Working state** (valid `schemaVersion`, readable, and it has any rules, password or history) → **merge only**: union of sites, always-sites, keywords (a rule only ever gets *stricter*: Block + Hide → Both, During blocks → Always), new schedules (existing ones untouched), tasks by id, and allowances (the **stricter** value per site: lower limit, `duringBlocks` AND-ed). **Never imported into a working state:** exceptions, looser allowances, protective settings (content filters off, keyword scope), the password, stats and history. The result screen lists what was added and what was skipped, with the reason. A merge only strengthens, so it is allowed **even during a lock** and needs no password.
   * **Empty or unusable state** (fresh install, wiped storage, failed migration) → **restore freely**, including exceptions and stats, because nothing was being enforced; the password is still never imported.
   * To *replace* a working state the user first uses **Reset all data** (password if set + typed confirmation; refused during a lock), which makes the state empty. There is no "Replace" button.
8. **Theme setting** (dark / light / system) and font scale (0.9–1.2) in Settings.

**AC:** a wrong password is rejected by the **background** (not just the UI); removing an allowance/exception/site now asks for the password when one is set (C29–C31); legacy hashes still unlock and are silently upgraded (test with a fixture); a standalone block cannot be ended early by any UI, shortcut or message, can be extended and added to (also with the popup closed), and every refused weakening action explains itself (Appendix D.7, E.7); export → reset → import restores everything on an empty state; importing into a working state only adds (the merge report lists what was skipped and why) and works during a lock; reset is refused during a lock; Protection card shows a red state when incognito access is off and when host permission is missing (test in Firefox).

---

### WP7 — Feature ports from the Android and PC apps · 5–8 d

Priorities: **Tier A** = ship in this release. **Tier B** = after Tier A is green. **Tier C** = backlog, only on request. Each item lists its source so you can read the original behaviour if you have the repos; the spec here is self-contained.

#### Tier A

| ID | Feature | Spec | Source |
|---|---|---|---|
| **A1** | **Quick block** ("Block this site") | Popup header button + command `block-current-site` (Alt+Shift+B) (+ optional context menu). Adds the tab's normalised domain (and its alias group) to *Sites* or *Always* (choice remembered). If blocking is active the current tab goes to the block page. Disabled with a reason on non-http(s) tabs. Toast "Added x.com (and twitter.com)". | Android `QuickBlockSheet` |
| **A2** | **Always-blocked list** | Second list enforced 24/7 (not only in sessions). Rules › Sites has two segments: *During focus* and *Always*. Removal is password-gated. Copy: "Blocked all the time, not only during sessions." Engine: precedence in A.3. | Android Always-On (`alwaysBlockPackages`) |
| **A3** | **Presets + onboarding goal** | Preset picker (checkbox list of domains → "Add selected"): *Social media*, *Video & streaming*, *News*, *Shopping*, *Gaming*, *Messaging*, *Deep focus* (= union). **Custom presets** (name, emoji, domains; CRUD). Onboarding asks "What distracts you most?" and pre-selects: social → Social + Messaging; gaming → Gaming + Video; web → News + Video; deep → Deep focus. **Never apply silently.** Starting lists (refine as needed): social `facebook.com instagram.com x.com tiktok.com snapchat.com reddit.com pinterest.com tumblr.com threads.net` · video `youtube.com netflix.com twitch.tv primevideo.com hulu.com disneyplus.com vimeo.com dailymotion.com` · news `cnn.com bbc.com nytimes.com foxnews.com theguardian.com washingtonpost.com news.ycombinator.com` · shopping `amazon.com ebay.com aliexpress.com etsy.com walmart.com` · gaming `store.steampowered.com steamcommunity.com epicgames.com roblox.com twitch.tv` · messaging `discord.com web.whatsapp.com web.telegram.org messenger.com`. Regional domains (e.g. other Amazon TLDs) are separate entries; offer "add regional variants" later. | PC `BlockPresets`, `CustomBlockPreset`, `goalSuggestions` |
| **A4** | **Break / Pomodoro settings UI** | Fields: short break, long break, cycles before long, auto-start next, defaults 5 / 15 / 4 / off (PC) and default session length. Engine from WP2. | PC `BreakEnforcer`; Android pomodoro settings |
| **A5** | **Extend session** | "+10 / +15 / +20 / +30 / +45 / +60 min" chips on the running view; allowed in every lock level; shown as "Extended by 15 min" in history. | Android `ExtendModal` |
| **A6** | **Tasks upgrade + reminders** | Fields: title, description, date, time, duration, priority (low/medium/high/critical), tags, recurrence (none/daily/weekdays/weekly), lock level; edit in place; completed tasks can be restarted. **Recurrence:** idempotent `generateRecurringForToday()` keyed by `templateId + date`, run at start-up and by a `midnight` alarm (PC `RecurringTaskService`). **Reminders** (Android `ReminderPlanner`): pre-start 10/5/1 min, at-start, mid-session check-ins at 15 and 30 min **only if ≥ 10 min remain**, "almost done"; armed as `chrome.alarms` for the next ≤ 50 reminders; `reconcileTaskAlarms()` runs on start-up, on `tasks/changed` and at midnight (Android `TaskAlarmReconciler`). Notification action **Start now** (where buttons are supported); clicking opens `dashboard.html#focus`. Optional `autoStartTasks` (default off). This makes the old "Time (opt)" field real (C13). | PC `Task`, `RecurringTaskService`; Android `Task`, `ReminderPlanner` |
| **A7** | **Block-page message and quotes** | Settings › Block page: custom message (default "Stay focused. You've got this."), list of quotes (rotate daily), toggle quotes, optional short aversive tone played **on the block page only** (WebAudio, off by default). | PC `overlayMessage`; Android `overlayQuotes`, aversion sound |
| **A8** | **Content-filter toggles** | Settings › Content filters: one switch per filter in Appendix B (YouTube Shorts, home feed, recommendations, comments; Instagram Reels/Explore; X trends; TikTok feed; LinkedIn feed; keyword hiding on/off). | Android `blockYoutubeShortsEnabled`, `blockInstagramReelsEnabled` |
| **A9** | **Notification settings** | Switches: session end, break end, task reminders, weekly report, achievements; reminder offsets editable. Request the notifications permission lazily if the browser requires it. | Android notification prefs |
| **A10** | **Alias chips** | When adding `x.com`, show "Also blocks twitter.com, t.co" and let the user remove aliases individually. | — |
| **A11** | **Check a URL** | Top of Rules: paste any URL → **Blocked / Allowed**, the reason from `explainBlock` (which list, schedule, limit, keyword or exception) and when it next changes ("until 17:30"). A "Why?" link on every blocked-site row opens the same answer. Same function as the engine and the block page, so what it says is what happens — it lets you verify any claim yourself. | new |
| **A12** | **Up next / Today (tasks as time windows)** | A task is a **time window**: date + start time + duration. **Focus tab:** a top card shows the task running now, else the next one today (title, window, **Start**); with none: "Nothing scheduled — add a task". **Tasks tab** opens on *Today*, grouped Overdue · Now · Up next · Later · No time, with day navigation. **Start from a task:** length = the remaining window if it is running, otherwise its duration. Optional `autoStartTasks` (default off, Android `autoFocusEnabled`). End-of-task notification (`reminders.atEnd`, default on, Android `taskEndAlarmRings`). A line under the timer says what will be blocked ("6 sites · 3 keywords · 1 schedule"); with nothing to block, Start explains why and links to Rules. | Android `HomeScreen` (running / next), `autoFocusEnabled`, `keepFocusActiveUntilTaskEnd`, `taskEndAlarmRings`; PC Dashboard |

#### Tier B

| ID | Feature | Spec | Source |
|---|---|---|---|
| **B1** | **Session debrief** | After a work phase: card in the popup + notification text. "Clean session — no blocked attempts" or "N blocked attempts"; add "finished X min early" / "ran Y min over" when extended or stopped early. | Android `SessionDebriefModal` |
| **B2** | **Achievements (subset)** | `IRON_SESSION` (session with 0 blocked attempts) · `QUIET_WIN` (≥ 60 min clean focus in a day) · `RESISTANCE_10` (10 clean sessions) · `THREE_WEEKS` (21-day streak) · `PRESENCE_7` (focused on all 7 days of a week) · `BACK_AGAIN` (return after > 5 days). Evaluated by the background after each session and at day rollover; stored in `achievements`; shown in Stats; optional notification. | Android `AchievementEngine` |
| **B3** | **Keyword match log** | Rules › Keywords shows the last 50 matches: keyword, domain, where it matched (query / URL / title), time; "Clear". | PC `KeywordMatchLogger` |
| **B4** | **Allow-only mode ("Focus allowlist")** | The web version of the Focus Launcher. During a work phase, block **everything except** the allowlist. Three-way per task, **never coerced**: `null` = follow the global setting; `[]` = allow-only disabled for this task; non-empty = only these domains. Needs ≥ 1 allowed domain to enable (prevents total lock-out). Extension pages and non-http(s) URLs are never affected. Engine: A.6 allow-only rule using `excludedRequestDomains`. | Android `focusAllowedPackages`; PC Focus Launcher |
| **B5** | **Daily reflection** | Mood 1–5 + short note per day (stored in `dayStats[date]`); optional end-of-day notification (off by default). | PC `DailyNote`; Android day rating |
| **B6** | **Habits** | Habit list (name + emoji), daily check-in, per-habit streak, dashboard card. | PC `Habit`, `HabitEntry` |
| **B7** | **Allowance heads-up** | Notification when 5 min (or 10 %) of a time budget remain and when it is used up; optional toolbar badge with the remaining minutes while the active tab is an allowance site (a running session's badge wins). Spec: Appendix F.5. | new |

#### Tier C (backlog; implement only if the owner asks)

i18n using the PC's 8 languages (en, es, pt-BR, zh, ja, ko, de, fr) via `_locales` · greyscale mode on selected sites (Android greyout) · page-text keyword scanning (needs optional host permission) · temporary override with friction (Android `BlockedAppDismissalPolicy`) · separate "session PIN" and "settings PIN" (Android/PC have two) · PIN rotation reminders · path-level rules (`youtube.com/shorts`) · CSV export · native-messaging bridge to the PC app.

#### Do **not** port (not meaningful or not allowed in a browser)

VPN/network blocking, hosts file, firewall rules, registry lockdown, process killing, AccessibilityService overlays, launcher/home-screen/widgets, uninstall protection / "nuclear mode" (cannot be enforced from an extension — see §3), admin elevation/MSIX handling, and the **Discord crash/feedback webhook and any telemetry** (violates the privacy promise).

**AC (Tier A):** each item works end-to-end in Chrome and Edge, and in Firefox where the API exists (notification buttons are the known exception); reminders fire at the right minute after a browser restart; a task scheduled for 14:00 shows pre-start reminders at 13:50 / 13:55 / 13:59 and an at-start notification; recurring tasks generate exactly one instance per day; presets never apply without confirmation; C01 and C13/C14 pass in §8.4.

---

### WP8 — Stats, insights, reports · 2–3 d · fixes H03, H08; C26–C28

**Tasks**

1. **Dashboard › Stats:** range switch (Today / Week / Month); KPI cards (focus time from **actual** `elapsedMs`, sessions completed, completion rate, blocks, clean sessions); a bar chart of focus minutes per day as **inline SVG** (no chart library); **daily-goal ring** (`settings.dailyGoalMin`, default 120) and **focus score** `min(100, goalPct·60 + taskPct·30 + (streak > 0 ? 10 : 0))` (PC Dashboard); **streak** = consecutive local days with ≥ 1 completed session, plus best streak; **insights** (PC `FocusInsightsService`): most productive hour, best weekday, average session, completion rate, total hours, this-week sessions/minutes, best session; top blocked domains; today's allowance usage per site; protection gaps; achievements.
2. **Popup › Stats (mini):** today's focus, streak, goal ring, last 5 sessions.
3. **Weekly report** (fixes B13, H08): `weekly_report` alarm created once by `ensureAlarms()` for the next local Monday 09:00 (configurable). Compute the last 7 days from `dayStats` (PC `WeeklyReportService` fields: total minutes, sessions completed, tasks completed, blocked attempts, average daily minutes, current streak, top blocked sites). Notification text uses **hours and minutes** ("6 h 25 min"), never floored hours. Save the summary in `lastWeeklyReport` and keep the last 8 in `weeklyReports`; show them in Dashboard › Reports.
4. **Data hygiene:** cap `sessionHistory` 500, `dayStats` 400 days, `recentBlocks` 200; prune in the `midnight` alarm.

**AC:** Stats show UI-started sessions immediately; numbers match a hand calculation for a seeded fixture (write a fixture generator and test the aggregates); the weekly alarm survives ≥ 20 worker restarts (`alarms.get('weekly_report').scheduledTime` unchanged); streak and score match the formulas; no chart dependency was added.

---

### WP9 — QA hardening · 2 d

1. Run the full manual matrix (§8.2) on Chrome, Edge and Firefox (temporary add-on).
2. MV3 lifecycle tests (§8.3): stop/restart the worker, restart the browser, suspend/resume the laptop, change the system clock.
3. Performance: worker CPU idle ≈ 0; content script < 5 ms/batch; popup opens < 150 ms; storage size < 1 MB after 90 days of seeded data.
4. Fix everything found; no new features.

**AC:** §8.2 and §8.3 pass; §8.4 (claims regression) is fully green.

---

### WP10 — Release · 1 d

1. Bump the version to `1.1.0` in manifest and `package.json`; update `CHANGELOG.md` (include the migration note and the behaviour changes: Always-blocked list, allowance semantics, exceptions matching, keyword splitting, no more fullscreen lock).
2. Make `STORE_LISTING.md` truthful (claims policy, §4.7). Include a **permission justification** table (storage, tabs, webNavigation, alarms, declarativeNetRequest, notifications, idle, host access) and explain why host access is needed (redirecting user-chosen sites). Publish `docs/privacy-policy.html` (states: no network calls, data stays local, nothing is sold or shared).
3. Re-capture store screenshots (popup, onboarding, block page) from the new UI.
4. Run `npm run package:all`; load each of the three packages and run the smoke test (start a session, hit a blocked site, see the block page, end the session).
5. **Upgrade test with a real v1 profile:** install the old build, create sites/schedules/allowances/tasks/password/history, upgrade in place, verify migration (§5.2) and that nothing is lost.

**AC:** the three ZIPs install; the upgrade test passes; every row of §4.7 is ✅ or its copy has been changed; no `alert(`, no `<all_urls>` content script, no network calls (grep the bundles for `fetch(`, `XMLHttpRequest`, `WebSocket`).

---

## 7. Feature port matrix — every notable feature of the two apps and what to do with it

**Decision codes:** **Port** (in WP7 or another WP) · **Adapt** (different mechanism on the web) · **Skip** (not meaningful or not allowed in a browser). WP/Tier IDs refer to §6.

### 7.1 Android app (`focusflow.zip`)

| Android feature | Decision | Extension equivalent |
|---|---|---|
| Tasks, quick add, edit, detail, timeline | **Port** | A6 (timeline view is Tier C) |
| Task reminder chain (pre-start, at-start, mid-session, almost-done) | **Port** | A6 |
| Live task status notification / widget | **Adapt** | Toolbar badge + title (WP2) |
| Focus session, active block screen | **Port** | WP2 + block page (WP5) |
| Extend session | **Port** | A5 |
| Session debrief | **Port** | B1 |
| Achievements | **Port (subset)** | B2 |
| Insights / findings / behavioural hypotheses / clarifying questions | **Skip** | Heavy analytics; conflicts with the privacy-first promise |
| Stats, trend chart, reports, report notes | **Port** | WP8 (notes → B5) |
| Day rating | **Port** | B5 |
| Blocked words | **Port** | Keywords (WP3) + log (B3) |
| Daily allowance (`count`, `time_budget`, `interval`) | **Port (fix)** | WP3 + Appendix F — the extension's current version is a mis-port (B08) and a muddled design (F16–F23) |
| Standalone block (own list, absolute expiry, extend / add only, **cannot be ended early**, no "no limit") | **Port** | Appendix D (WP6) |
| Always-On blocking | **Port** | A2 |
| Greyout schedule | **Adapt** | Greyscale mode (Tier C) |
| Block overlay + quotes, overlay appearance | **Adapt** | Block page + A7 |
| Aversive actions (dim, vibrate, sound) | **Adapt** | Optional tone on the block page (A7); dimmer → greyscale (Tier C); vibrate: skip |
| Launcher, allowed apps, presets, dock | **Adapt** | Allow-only mode (B4) |
| VPN / network blocker, VPN block list | **Skip** | Not available to extensions |
| Quick block sheet | **Port** | A1 |
| PIN (defense PIN, focus PIN, rotation, reuse tracker) | **Adapt** | Password (WP6); separate session PIN and rotation are Tier C |
| Backup / restore | **Port** | WP6 |
| Dark mode, text size | **Port** | WP5/WP6 (theme + font scale) |
| Permissions screen, enforcement health | **Adapt** | Protection status (WP6) |
| Diagnostics, report-an-issue, troubleshoot | **Adapt** | "Copy diagnostics" (no network) — Tier C |
| Onboarding | **Port** | WP5 + A3 |
| Morning digest, week-ahead, bedtime nudge, temptation-spike alerts | **Skip for now** | Possible Tier C notifications |
| Boot / package-install receivers, wake locks, foreground service | **Skip** | Not applicable (alarms + worker recovery replace them) |

### 7.2 PC app (`focusflowpc.zip`)

| PC feature | Decision | Extension equivalent |
|---|---|---|
| Dashboard: greeting, daily-goal ring, streak, focus score, quick add | **Port** | WP8 (+ A1 quick add) |
| Tasks: recurring, priority, tags | **Port** | A6 |
| Focus screen: pomodoro, long break, cycles | **Port** | WP2 + A4 (**pause skipped**: pausing defeats the block; use Extend) |
| Focus Launcher | **Adapt** | Allow-only mode (B4) |
| App blocker by process, presets | **Adapt** | Web presets (A3) |
| Keyword blocker + match log | **Port** | WP3 + B3 (no window closing: only the offending tab is redirected) |
| Network shield / VPN | **Skip** | — |
| Block Defense (standalone with scheduled start) | **Port** | Appendix D (scheduled start is Tier B) |
| Nuclear mode (kills escape tools, firewall) | **Skip** | Cannot be enforced from an extension (§3) |
| Reports, weekly report, focus insights | **Port** | WP8 |
| Daily notes + mood | **Port** | B5 |
| Habits | **Port** | B6 |
| Profile (name, daily goal) | **Port** | Daily goal in Settings; greeting by name is Tier C |
| Sound aversion / chimes | **Adapt** | A7 (block-page tone only) |
| Overlay message | **Port** | A7 |
| Theme, language (8 languages) | **Port / Tier C** | Theme in WP5; i18n Tier C |
| PIN policy (8–28; generated 20–28 from an ambiguity-free alphabet via `SecureRandom`) | **Port** | WP6 |
| Allowance engine, block schedules (`isActiveAt` with overnight and 24:00) | **Port** | WP3 (Appendix A.1 mirrors it) |
| Backup, auto-backup | **Port (manual)** | WP6 export/import |
| Windows setup, elevation, startup, MSIX, uninstall wizard, registry lockdown | **Skip** | Not applicable |
| Discord webhook, crash reporter, telemetry consent | **Skip** | Violates privacy promise — **do not port** |
| How-to, changelog, contact screens | **Adapt** | Settings › About |

---

## 8. Test and QA plan

### 8.1 Unit tests (Vitest) — required before the matching WP is "done"

| Module | Cases |
|---|---|
| `time.ts` | normal window; overnight (`22:00–06:00`); `24:00` end; start = end (empty); end exclusive; previous-day rule (Mon 22:00–06:00 active Tue 02:00 only if Mon ticked); `nextScheduleBoundary` across week end; local-date key around midnight; DST changeover days (use fixed dates) |
| `domains.ts` | valid/invalid inputs (spaces, commas, `localhost`, ports, uppercase, IDN → punycode, pasted full URLs, `www.`); alias groups; `matchesDomain` for subdomains and look-alikes (`example.com.au`, `notexample.com`); exceptions (Appendix A.4 table incl. `&` / `?` / `#` boundaries and look-alike hosts) |
| `keywords.ts` | comma/newline split; hashtags; whole-word vs substring ("essex"/"sex"); param extraction per host; `p` ignored on non-Yahoo hosts |
| `plan.ts` | precedence and reasons; break phase ⇒ session blocks off; standalone future start; schedule boundaries; allowance exemption vs cap; always-blocked beats allowance; exceptions override everything; global allow-only disabled / empty / non-empty cases (task-scoped overrides are tested in WP7 B4) |
| `allowance.ts` | three modes; midnight rollover; interval window expiry; attention delta cap (90 s); visit-gap logic for `count` |
| `dnr.ts` | one redirect rule + stable IDs; ASCII guard; `regexSubstitution` string; exception regex escaping; allow-only rule; rule count limits |
| `migrate.ts` | v1 fixture → v2 snapshot (§5.2): stuck session, overnight schedule, numeric allowance, legacy password, seconds → ms history |
| `password.ts` | PBKDF2 round trip; legacy verify + upgrade; generator length/alphabet/entropy source |
| `gating.ts` | `guard()` over **every** action × state in the Appendix E matrix (idle, normal/strict/commit session, standalone active; password set/unset) |
| `stats.ts` | streak (gaps, best streak), focus score, insights, weekly report totals, hour/minute formatting |

### 8.2 Manual matrix (Chrome, Edge, Firefox temporary add-on)

Run each row on all three browsers; note failures per browser.

| Area | Scenario | Expected |
|---|---|---|
| Install | Fresh install | Onboarding opens in a tab; protection check lists incognito/host/notification status |
| Install | Upgrade from v1 with data | WP5 cutover migrates everything (§5.2); backup is present before legacy keys are removed; no popup errors |
| Session | Start/stop/extend with popup closed | See WP2 AC |
| Session | Shortcut Alt+Shift+F idle / running / locked | Starts / stops / shows "locked" |
| Blocking | Typed URL, link click, new tab, back/forward, SPA route, redirect chain | Always ends on the block page, original URL preserved |
| Blocking | Subdomain, look-alike, alias (`twitter.com` ↔ `x.com`) | Correct matches |
| Blocking | Exceptions | Per WP3 AC 3 |
| Schedules | Start/end boundaries with no interaction; overnight; edit while active | Per WP3 AC 4 |
| Allowances | Time budget, count, interval; unfocused/minimised/idle; `duringBlocks` on/off; in-place edit | Per WP3 AC 5 and Appendix F.7 |
| Keywords | Search on 5 engines + YouTube in-page search; whole-word | Per WP3 AC 6 |
| Content filters | Each toggle on/off live; break phase; schedule window | Per WP4 AC |
| Standalone (Block now) | Start with confirmation; extend; add site; confirm there is no stop anywhere; every locked action explains itself | Per Appendix D.7 |
| Password | Set/verify/remove; legacy upgrade; generator; gated actions | Per WP6 AC |
| Backup | Export → reset → import; merge into a working state; merge during a lock | Restores on an empty state; a merge only adds and reports what it skipped; reset is refused during a lock |
| UI | Every tab at 380×580; light/dark; keyboard-only; 200 % zoom; reduced motion | No overflow, no flash, all controls reachable |
| Incognito | Extension not allowed in incognito | Warning shown; blocking absent there (documented) |
| Firefox | Host permission not granted | Banner + working "Grant access" flow |

### 8.3 MV3 lifecycle tests

1. `chrome://extensions` → service worker → **Stop**, then navigate to a blocked site: blocked on the first try.
2. Stop the worker mid-session; reopen the popup after the end time: state is finalised.
3. Quit the browser mid-session; reopen later: no stuck session; gap recorded.
4. Suspend/resume the laptop across a session end and across a schedule boundary.
5. Move the system clock backwards by 10 min mid-session: `phaseEndsAt` extends by the delta; record flagged.
6. 20 worker restarts: `weekly_report`, `boundary`, `tick` alarms keep their `scheduledTime`.
7. 10 000 events burst (many tabs navigating): no duplicate-ID errors; `recentBlocks` stays ≤ 200.

### 8.4 Claims regression — every claim in §4.7 needs a passing check

A row passes only if the **final on-screen copy** is true. If you changed the copy instead of the behaviour, test the new copy.

| # | Pass when |
|---|---|
| C01 | Presets exist and the store/manifest description matches what the UI offers |
| C02 | Bundles contain no `fetch(`/`XMLHttpRequest`/`WebSocket`; content script injects only on supported hosts; privacy policy file exists and matches |
| C03 | Starting and finishing a session from the popup adds a history entry and updates today's focus time |
| C04 | Every file the README/scripts mention exists or the text is removed |
| C05 | Popup is 380 × 580 on every tab |
| C06 | Close the popup mid-session; the session still ends on time |
| C07 | Strict copy matches behaviour: no fullscreen claim; wrong password rejected; shortcut cannot stop it |
| C08 | Commit: no UI/shortcut/message can stop it; it ends by itself |
| C09 | Break advances without the popup; content filters are off during the break |
| C10 | Task-linked session completes the task with the popup closed; popup open/close never ends it |
| C11 | Shortcut starts a session with the default duration and a notification; refuses to stop a locked one |
| C12 | Typing a duration works naturally |
| C13 | A task with a time triggers reminders and an at-start notification |
| C14 | Tasks empty-state copy is accurate; dated/recurring tasks behave as described |
| C15 | A commitment task can be deleted when its session is not running |
| C16 | Block copy matches behaviour (main pages blocked; no flash; block page shown) |
| C17 | `x.com` and `twitter.com` are blocked together; the placeholder is current |
| C18 | Always-blocked list works with no session; HowTo wording matches |
| C19 | Exception `youtube.com/watch?v=abc` allows exactly that video |
| C20 | During a standalone block, adding an exception explains why it is refused |
| C21 | Keyword behaviour matches the on-screen description (params, whole-word option) |
| C22 | `funny shorts, #gaming` creates two keywords |
| C23 | Hiding works on the supported sites, reverses without reload, is off in breaks, on in schedules |
| C24 | Schedules start and end with no user action |
| C25 | A schedule blocks exactly the lists it says it blocks |
| C26 | Stats show today's focus time, completed and abandoned counts correctly |
| C27 | One blocked navigation = one counted block |
| C28 | Session history lists UI-started sessions |
| C29 | Password copy lists exactly the gated actions, and each one prompts |
| C30 | HowTo password text matches (lock `none` sessions are described as unprotected) |
| C31 | Generated passwords come from `crypto.getRandomValues`; legacy hash upgrades |
| C32 | Standalone copy matches: own list, absolute expiry, extend/add only, **no early stop**, no "no limit" |
| C33 | Allowance copy matches the three modes; usage visible; removal prompts for the password |
| C34 | Onboarding's last button does what it says |
| C35 | Onboarding offers presets and a protection check |
| C36 | Block-page headline matches the real reason |
| C37 | Countdown shown only for a session or standalone block and equals `endsAt − now` / `until − now` |
| C38 | "Blocks today" equals the real count |
| C39 | Close tab closes the tab |
| C40 | Promo link is in About, not on the block page |

### 8.5 Edge-case catalogue — concrete cases the implementation must handle

Each case comes from a real code path in the extension or from how the browser behaves; none is hypothetical padding. "Covered by" says where the expected behaviour is specified or tested; every row needs a test or a manual check in §8.2.

| # | Case | Expected behaviour | Covered by |
|---|---|---|---|
| EC01 | A work phase crosses local midnight | Focus time and the completed-session count are attributed to the local date of `phaseStartedAt` (documented); the streak uses that date; per-day allowances reset at midnight regardless | WP2, WP8 |
| EC02 | The laptop sleeps through `phaseEndsAt` | On wake the late alarm or `recoverSession` finalises the phase; the gap rule decides completed or interrupted; the end notification is skipped if it is more than 30 min late, but history is still written | WP2 AC 3 |
| EC03 | Browser closed mid-session, reopened before the end | The session resumes with the correct remaining time; a gap longer than 3 min is recorded | WP2 AC 3 |
| EC04 | System clock set forward during a session | The session ends at the next tick (a jump cannot be told from sleep); the gap is recorded; no focus time is credited if gaps cover more than half the phase | §8.3 test 5 |
| EC05 | System clock set backward | `phaseEndsAt` is extended by the difference and the record is flagged | WP2, §8.3 test 5 |
| EC06 | Daylight-saving change inside a schedule window or a session | Durations are absolute milliseconds; schedules use local wall-clock getters; a window that starts in the skipped spring-forward hour starts when the wall clock reaches it | `time.ts` tests with fixed dates |
| EC07 | The time zone changes (travel) | Date keys and schedules use the current local zone at evaluation time; per-day allowances reset when the local date changes; running sessions are unaffected | invariant 14 |
| EC08 | A session starts while a standalone block is active | Allowed; both apply; the block page names the standalone block first | A.3 |
| EC09 | Start pressed with nothing to block | It starts, with the inline warning "Nothing is blocked — add sites in Rules"; not an error | WP5 #6 |
| EC10 | The linked task is deleted or completed during its session | The session continues and the link is dropped silently | WP2 |
| EC11 | Extending beyond 24 h in total | Refused: "Maximum 24 h per session" | WP2 |
| EC12 | The next phase should auto-start while the browser is closed | Nothing starts; on the next launch `recoverSession` leaves the state idle; there are no catch-up sessions | WP2 |
| EC13 | Notifications are denied | Badge, block page and history still work; Protection status shows "Notifications off" | WP6 |
| EC14 | Two popups or dashboards are open when a lock starts | Both update from storage events and disable locked controls; stale writes still pass through `guard()` | E.7 |
| EC15 | A blocked site is already open in a background tab when blocking starts | It is replaced once by the block page on the transition (unsaved form data in that tab is lost); the start confirmation says how many open tabs will be replaced | WP3 AC 1, D.3, E.5 |
| EC16 | Back or forward restores a cached blocked page without a network request | Caught by `onCommitted` / `onHistoryStateUpdated`; if the browser fires nothing, the 1-minute `tick` safety audit redirects it | WP3 #2 |
| EC17 | A blocked site inside an iframe or as a subresource | Not blocked (main frame only); the Sites copy says so | C16 |
| EC18 | A redirect chain such as `t.co` to `x.com` | Each hop is evaluated; aliases cover both | WP3 #5 |
| EC19 | A URL with user-info or a port, such as `https://u@site.com:8443/` | Matched by host; exceptions normalise port and user-info away | `domains.ts` tests |
| EC20 | A Unicode domain typed or pasted | Converted to punycode by the URL parser and shown decoded in the UI | `domains.ts` tests |
| EC21 | `localhost` or an IP literal is added | Accepted with an exact host match; never affects other hosts | `domains.ts` tests |
| EC22 | 500 sites, 200 exceptions and 50 keywords | One redirect rule with many `requestDomains` plus 200 allow rules; installs within limits; `health.ruleCount` shows it | `dnr.ts` tests |
| EC23 | One stored entry is invalid or non-ASCII | It is skipped and reported in Protection status; the other rules install | WP3 AC 7 |
| EC24 | An exception longer than 200 characters | Rejected at input with a message | A.4 |
| EC25 | The user removes one alias chip but keeps its twin | The exclusion is stored per entry and survives edits | A10 |
| EC26 | `chrome://`, `about:`, `view-source:` and extension pages | Never redirected | D.4 #10 |
| EC27 | A link to a file download on a blocked domain | Treated as a navigation: the block page replaces the download | documented in About |
| EC28 | `blocked.html#…` opened by hand or by a website (the page is web-accessible) | Shows the real verdict for that URL; the fragment is rendered as text only; "Open site" appears only for http(s) URLs that are not blocked now | invariant 13 |
| EC29 | The block ends while the block page is open | The page switches to "Block ended" and offers "Open {host}" | WP5 #9 |
| EC30 | The same domain is blocked by two contexts (session and schedule) | One reason is shown by precedence (A.3), with the longest-lasting end time | A.3 |
| EC31 | An allowance site is open in two windows | Only the active tab of the focused window counts | A.2, S2 |
| EC32 | Video plays in a background tab while another window is focused | It counts (audible); a setting to turn this off is off by default | S2 |
| EC33 | The budget runs out while the user is on the page | The tab is redirected at the next flush (an event, or the tick at most 60 s later) | F.7 |
| EC34 | Local midnight passes while the block page is open | Per-day budgets reset and the page offers "Open {host}" | WP5 #9 |
| EC35 | The browser restarts in the middle of a visit | `lastTickAt` is gone (delta 0, no phantom time); a restart within 2 min still counts as the same visit | A.2 |
| EC36 | `x.com` and `twitter.com` both have usage | One shared budget keyed by the alias group | A.2, WP3 #5 |
| EC37 | An allowance is edited | The same mode keeps its usage; a mode change resets that entry's usage; lowering below current usage exhausts it at once | F.4 |
| EC38 | A *Minutes per window* allowance and midnight passes | The window ignores midnight | A.2 |
| EC39 | The extension updates (v1 to v2) with a v1 session running | Migrated with the remaining time; a finite v1 standalone block is migrated; v1 "No limit" becomes the Always-blocked list | §5.2, D.5 |
| EC40 | The extension updates during a v2 lock | State is kept; `onInstalled` runs `ensureAlarms()`, `recoverSession()` and `reconcile()` | WP2, WP3 |
| EC41 | The user disables then re-enables the extension during a lock | The first event rebuilds the rules from state; a heartbeat gap is recorded and shown as a protection gap | §3, WP6 |
| EC42 | Storage is wiped (Clear data, reinstall) during a lock | Nothing can be recovered; the state is fresh and unlocked. This is stated honestly in Protection status; it is why the apps enforce harder | §3 |
| EC43 | A weakening edit made through DevTools during a lock | Accepted, unless the Tier B watchdog is built, which reverts it | E.8 |
| EC44 | The password is forgotten | There is no recovery by design. Settings › Security says so, and the generator shows the password once with an acknowledgement; uninstalling clears everything | WP6 |
| EC45 | The Strict phrase dialog is closed and reopened | The 15 s wait restarts | E.2 |
| EC46 | A backup is imported into a working state | Merge only; skipped items are listed; allowed during a lock because it can only strengthen | WP6 #7 |
| EC47 | A backup is imported into an empty state | Restores everything except the password | WP6 #7 |
| EC48 | A corrupt, oversized or future-version backup file | Rejected with a message; state untouched | WP6 #7 |
| EC49 | Two dashboards edit the same list | Last write wins; `update(key, fn)` re-reads right before writing to keep the window tiny | WP1 #3 |
| EC50 | The worker is killed in the middle of a phase transition | One atomic `set` plus a compare-and-swap on `phaseEndsAt` mean the next wake sees the old phase or the new one, never a mix | invariants 11, 12 |
| EC51 | A keyword appears only in the URL fragment | Ignored; fragments are never matched | `keywords.ts` tests |
| EC52 | A keyword is percent-encoded or uses `+` in the query | Decoded before matching | `keywords.ts` tests |
| EC53 | A non-Latin keyword in whole-word mode | Unicode-aware word boundaries | A.7 |
| EC54 | A hide word matches a container that also holds other content | The smallest container named in the filter table is hidden; selectors are data, reviewed per site | Appendix B |

---

## 9. Milestones and definition of done

| Milestone | Contains | Exit criteria |
|---|---|---|
| **M1 — Correct core** | WP0–WP3 including the WP1b spikes (+ WP4 deletes the old scripts) | WP1–WP3 AC green; old `public/background.js` removed; §8.3 lifecycle tests 1–4 pass |
| **M2 — Trustworthy UI** | WP4–WP6 | WP4–WP6 AC green; §4.7 rows owned by those WPs pass in §8.4 |
| **M3 — Features** | WP7 (Tier A), WP8 | Tier A and WP8 AC green |
| **M4 — Release** | WP9, WP10 | §8.2–§8.4 fully green; upgrade test passes |

**Global definition of done:** `npm run typecheck`, `npm test` and `npm run build` are clean; no `alert(`; no `localStorage` outside the dev fallback; no module-level *authoritative* state in `src/background` (ephemeral caches such as the 3 s dedupe map are fine because losing them is harmless); no per-second storage writes; every new string passes the banned-word check; manifest permissions match the justification table; CHANGELOG updated.

---

## 10. Open questions for the owner (defaults the plan already uses)

Proceed with the default unless the owner answers otherwise; record the choice in the commit message.

| # | Question | Default |
|---|---|---|
| Q1 | Add an **Always-blocked** list (blocked outside sessions)? | **Yes** (A2). Today the only always-on option is an irreversible "No limit" standalone block. |
| Q2 | Allow a **temporary override** on the block page (with friction)? | **No** (Tier C). |
| Q3 | **Allowance semantics** — exemption, cap, or both? | **Both, explicit per entry:** every entry is a cap (blocked once used up); the **"Also allow during blocks"** switch (default ON = Android semantics, and what the v1 DNR code did) additionally exempts the site from session/schedule/standalone blocks while budget remains. *Always-blocked* always wins. Spec: Appendix F. |
| Q4 | Allow **pausing** a session (PC has it)? | **No** — pausing defeats blocking; use Extend. |
| Q5 | **Password policy** | Port the PC policy: custom 8–64 chars, generated 20–28 from an ambiguity-free alphabet. (The old UI forced 20–28.) |
| Q6 | **Standalone expiry rules** | Android parity: always has an end (min 5 min, max 30 days; a tick-box "I understand I can't end this early" above 24 h); cannot be ended early; **no "No limit"**. Permanent blocking = the Always-blocked list (Q1). |
| Q7 | **Content-filter defaults for existing users** | ON for Shorts, Reels and TikTok feed (previous unconditional behaviour); new filters OFF. |
| Q8 | **Pomodoro** default | Off: work → 5-min break → done; `autoStartNext` turns on Pomodoro cycles. |
| Q9 | **Streak** definition | ≥ 1 completed session on a local day. |
| Q10 | **Firefox** | Keep supporting (host-permission prompt + notification-button gaps documented). |
| Q11 | Page-**title** keyword matching on all sites | Off (needs a broad content script / optional host permission) — Tier C. |
| Q12 | Move the "Also check out FocusGate PC / App" promo | To Settings › About. |
| Q13 | Regional preset variants (other TLDs) | Later; presets ship with the global domains only. |
| Q14 | What happens to a v1 **"No limit"** standalone block on upgrade? | Its sites move to the Always-blocked list (permanent, removal password-gated) and the user sees a one-time notice. |
| Q15 | **One password or two** (Android has a Focus Session PIN and a Defense PIN)? | One now; `guard()` is written so splitting later is a config change. |
| Q16 | Keep **three** session lock levels, or collapse to Normal / Password and use Block now for "can't stop"? | Keep three, with the precise definitions in Appendix E.2. Commit sessions are capped at 4 h (longer unstoppable blocks use Block now with its explicit confirmation). |

---

## Appendix A — Algorithms (implement these exactly, then test them)

### A.1 Schedule evaluation (`shared/time.ts`) — port of PC `BlockSchedule.isActiveAt`, fixes B04

```ts
export const parseHHMM = (v: string): number => {            // "24:00" -> 1440
  const [h, m] = v.split(':').map(Number);
  return h * 60 + m;
};

export function isScheduleActiveAt(s: Schedule, now: Date): boolean {
  if (!s.enabled) return false;
  const start = parseHHMM(s.start);
  const end = parseHHMM(s.end);                              // may be 1440
  if (start === end) return false;
  const cur = now.getHours() * 60 + now.getMinutes();
  const today = now.getDay();                                // 0 = Sunday
  const yesterday = (today + 6) % 7;
  if (end > start) {                                         // same-day window, end EXCLUSIVE
    return s.days.includes(today) && cur >= start && cur < end;
  }
  // overnight (start > end): the evening part belongs to today, the morning part to yesterday
  return (s.days.includes(today) && cur >= start) ||
         (s.days.includes(yesterday) && cur < end);
}

export function nextScheduleBoundary(schedules: Schedule[], now: Date): number | null {
  let best: number | null = null;
  for (const s of schedules) {
    if (!s.enabled) continue;
    for (let d = 0; d <= 8; d++) {
      for (const t of [parseHHMM(s.start), parseHHMM(s.end)]) {
        const at = new Date(now); at.setHours(0, 0, 0, 0);
        at.setDate(at.getDate() + d); at.setMinutes(t);       // 1440 rolls to next-day 00:00
        const ms = at.getTime();
        if (ms > now.getTime() && (best === null || ms < best)) best = ms;
      }
    }
  }
  return best;                                               // alarm at best + 1000 ms
}
```

The `<input type="time">` cannot express `24:00`; add an "End of day" checkbox that stores `"24:00"`.

### A.2 Allowance ledger (`shared/allowance.ts`) — Android modes `count`, `time_budget`, `interval`

Constants (defaults, tune later): `VISIT_GAP_MS = 2 min` (a gap longer than this ends a visit), `VISIT_MAX_MS = 30 min` (a single continuous visit counts as ended after this), `MAX_DELTA_MS = 90 s` (cap per sample so a sleeping laptop cannot book hours).

```ts
const fresh = (today: string): UsageRecord =>
  ({ dateKey: today, usedMs: 0, opens: 0, windowStartMs: 0, lastActiveAt: 0 });

export function normalizeRecord(rec: UsageRecord | undefined, a: Allowance, now: number): UsageRecord {
  const today = localDateKey(new Date(now));
  if (!rec) return fresh(today);
  if (a.mode === 'interval') {                               // windows ignore midnight
    const over = rec.windowStartMs && now >= rec.windowStartMs + a.everyMin * 60_000;
    return over ? fresh(today) : rec;
  }
  return rec.dateKey === today ? rec : fresh(today);         // budget / count reset at local midnight
}

export const visitInProgress = (rec: UsageRecord | undefined, now: number) =>
  !!rec && rec.lastActiveAt > 0 && now - rec.lastActiveAt <= VISIT_GAP_MS;

export function isExhausted(rec: UsageRecord | undefined, a: Allowance, now: number): boolean {
  const r = normalizeRecord(rec, a, now);
  switch (a.mode) {
    case 'time_budget': return r.usedMs >= a.limitMin * 60_000;
    case 'count':       return r.opens >= a.maxOpens && !visitInProgress(r, now); // the last allowed visit may finish
    case 'interval':    return r.windowStartMs > 0 && r.usedMs >= a.allowMin * 60_000;
  }
}

export function applyAttention(rec: UsageRecord | undefined, a: Allowance, now: number, deltaMs: number): UsageRecord {
  const r = { ...normalizeRecord(rec, a, now) };
  const newVisit = !visitInProgress(r, now);
  if (a.mode === 'interval' && !r.windowStartMs) r.windowStartMs = now;   // first attention starts the window
  r.usedMs += Math.min(deltaMs, MAX_DELTA_MS);
  if (newVisit) r.opens += 1;
  r.lastActiveAt = now;
  return r;
}

export const nextResetAt = (r: UsageRecord, a: Allowance, now: number) =>
  a.mode === 'interval' ? r.windowStartMs + a.everyMin * 60_000 : startOfNextLocalDay(now);
```

**Attention tracking** (`background/attention.ts`, needs the `idle` permission): store `{ lastTickAt, lastDomain, lastAttentive }` in `chrome.storage.session`. On the 1-minute `tick` **and** on `tabs.onActivated`, `windows.onFocusChanged`, `webNavigation.onCommitted` (main frame) and `idle.onStateChanged`:

1. **Flush the interval since `lastTickAt`** to `lastDomain` if `lastAttentive` (that is what makes attribution accurate to the second, not to the minute).
2. Re-sample: `w = windows.getLastFocused({populate:true})`; attentive = `w.focused && idleState === 'active'` **or** the active tab is `audible`; domain = the allowance key matching the active tab's URL (alias-aware).
3. Save the new `{ lastTickAt: now, lastDomain, lastAttentive }`; write `usage` once if anything changed; if an `isExhausted` result flipped, call `reconcile('allowance')`.

After a browser restart `storage.session` is empty, so the first delta is 0 (no phantom time).

### A.3 Block plan and precedence (`shared/plan.ts`) — fixes B27, B04, B15

```ts
export type Reason =
  | { kind: 'always' }
  | { kind: 'standalone'; until: number }
  | { kind: 'session'; until: number }
  | { kind: 'schedule'; name: string; until: number }
  | { kind: 'allowance'; mode: Allowance['mode']; resetsAt: number }
  | { kind: 'allowOnly' }
  | { kind: 'keyword'; keyword: string; where: 'query' | 'url' | 'title' };

export interface BlockPlan {
  blocked: Map<string, Reason>;                              // domain -> reason (first match wins)
  allowOnly: string[] | null;                                // allowed domains; null = feature off
  keywords: string[];                                        // active BLOCK words (navigation)
  hideWords: string[];                                       // active HIDE words (content script)
  exceptions: string[];                                      // normalised entries
  nextBoundaryAt: number | null;
}
```

Steps in `computeBlockPlan(state, nowMs)`:

1. `alwaysBlockedSites` → reason `always`. **Never exempted** by an allowance.
2. Context lists, first match wins, in this order: **standalone** (active and `startsAt ≤ now < until`) → `standalone.sites` (its **own** list, Appendix D); **session** (`status === 'work'`) → `blockedSites`; every **active schedule** → `schedule.sites` (+ `blockedSites` when `useGlobalLists`).
3. **Allowance interaction for a domain from step 2:** if it has an allowance with `duringBlocks` and `!isExhausted` → *exempt* (not blocked); if it has an allowance and `isExhausted` → blocked with reason `allowance` (the cap applies whatever `duringBlocks` says); otherwise (no allowance, or `duringBlocks` off) blocked with the context reason.
4. **Exhausted allowances anywhere:** any allowance domain not yet in the map and `isExhausted` → reason `allowance` (the "daily cap" works outside sessions too).
5. `keywords` / `hideWords` = the global **keyword rules** (Appendix G) whose `mode` includes block / hide and whose `when` is `always`, or `blocks` while a standalone block or a session work phase is active; plus the keywords of each active schedule (and the global ones if `useGlobalLists`), which count as `both`.
6. Base `allowOnly` = the global `settings.allowOnly` list when enabled and non-empty, only while `status === 'work'`; otherwise `null`. Task-scoped `null` / `[]` / list overrides are added and tested in WP7 B4, not in the WP1/WP3 base engine.
7. `nextBoundaryAt` = min of `nextScheduleBoundary`, `standalone.startsAt` / `until` (future ones), `session.phaseEndsAt`, each exhausted/used allowance's `nextResetAt`, and the next local midnight.

**Exceptions** are applied when matching a URL (A.4) and **override everything**. Creating an exception is a restriction-lessening action, so it is password-gated and refused during standalone/commitment (that is what C20 expects).

`explainBlock(url, state, now)`: (1) non-http(s) → `null`; (2) `matchException` → `null`; (3) longest-suffix domain match in `plan.blocked` → its reason; (4) `plan.allowOnly` set and host not allowed → `allowOnly`; (5) keyword scan (A.7 params + `settings.keywords.scope`) → `keyword`; else `null`. The fallback listeners, the tab audit and `blocked.html` all call this one function.

### A.4 Exceptions (`shared/domains.ts`) — fixes B10

```ts
export function normalizeException(input: string): string | null {
  const raw = input.trim();
  let u: URL;
  try { u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : 'https://' + raw); } catch { return null; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  const host = u.hostname.replace(/^www\./, '');             // lower-case punycode already
  return host + u.pathname.replace(/\/$/, '') + u.search;    // no fragment, no trailing slash
}

export function matchException(url: string, entries: string[]): boolean {
  const u = new URL(url);
  const key = u.hostname.replace(/^www\./, '') + u.pathname.replace(/\/$/, '') + u.search;
  return entries.some(e => key === e || (key.startsWith(e) && '/?&#'.includes(key[e.length])));
}
```

| Entry | URL | Match? |
|---|---|---|
| `youtube.com/watch?v=abc` | `https://www.youtube.com/watch?v=abc&t=5s` | yes (next char `&`) |
| `youtube.com/watch?v=abc` | `https://youtube.com/watch?v=abcd` | **no** |
| `youtube.com` | `https://m.youtube.com/` | no (subdomain not covered; document it) |
| `youtube.com` | `https://youtube.com.evil.test/` | **no** (next char `.`) |
| `example.com/docs` | `https://example.com/docs/page` | yes (next char `/`) |

DNR allow rule from the same entry: `regexFilter: '^https?://(www\\.)?' + escapeRegex(entry) + '([/?&#]|$)'`, priority 2. Cap each entry at 200 characters (regex size limit).

### A.5 Session state machine (`background/session.ts`)

```
idle ──start──► work ──phaseEnd──► shortBreak/longBreak ──phaseEnd──► autoStartNext ? work : idle
                 │                      │            (breaks disabled: work ──phaseEnd──► idle)
                 └── stop (lock rules) ─┴──► idle      extend: work only, phaseEndsAt += ms
recover(now): while now ≥ phaseEndsAt → advancePhase('recovered')   (max 10 iterations)
```

| Transition | Side effects (all in the background) |
|---|---|
| start | write `session`; alarm `session_phase_end`; badge; `reconcile`; clear `blockedAttempts` |
| work → break / idle (normal end) | `SessionRecord{completed}`; `dayStats` (focusMs, sessionsCompleted); complete the linked task; notification; achievements + debrief inputs; badge; alarm; `reconcile` |
| break → work (auto) | new `sessionId`, same planned length/lock; alarm; `reconcile` |
| break → idle | clear session; notification "Break over"; `reconcile` |
| stop (during work) | `SessionRecord{abandoned}`; `dayStats` (sessionsAbandoned, actual focusMs); idle; clear alarm; `reconcile` |
| recover | as above, with gap/skew rules from WP2; `interrupted` records do not add focus time |

Long break rule: after the work phase whose `cycle % cyclesBeforeLong === 0` use `longMin`, otherwise `shortMin`.

### A.6 DNR rules (`shared/dnr.ts`)

```ts
export function buildDnrRules(plan: BlockPlan, blockedBase: string) {
  const rules: chrome.declarativeNetRequest.Rule[] = [];
  const skipped: { entry: string; reason: string }[] = [];
  const ok = (d: string) => /^[\x00-\x7f]+$/.test(d) || (skipped.push({ entry: d, reason: 'non-ascii' }), false);
  const target = blockedBase + '#\\1';                       // original URL travels in the fragment

  const domains = [...plan.blocked.keys()].filter(ok);
  if (domains.length) rules.push({
    id: 1, priority: 1,
    action: { type: 'redirect', redirect: { regexSubstitution: target } },
    condition: { requestDomains: domains, regexFilter: '^(https?://.+)$', resourceTypes: ['main_frame'] },
  });

  const allowed = (plan.allowOnly ?? []).filter(ok);
  if (allowed.length) rules.push({                           // NEVER emit with an empty list (total lock-out)
    id: 2, priority: 1,
    action: { type: 'redirect', redirect: { regexSubstitution: target } },
    condition: { excludedRequestDomains: allowed, regexFilter: '^(https?://.+)$', resourceTypes: ['main_frame'] },
  });

  plan.exceptions.slice(0, 200).forEach((e, i) => rules.push({
    id: 100 + i, priority: 2, action: { type: 'allow' },
    condition: { regexFilter: '^https?://(www\\.)?' + escapeRegex(e) + '([/?&#]|$)', resourceTypes: ['main_frame'] },
  }));
  return { rules, skipped };
}
```

Install in `reconcile`:

```ts
const existing = await chrome.declarativeNetRequest.getDynamicRules();
await chrome.declarativeNetRequest.updateDynamicRules({
  removeRuleIds: existing.map(r => r.id), addRules: rules,    // ONE atomic call
});
```

If it rejects: **bisect** — install rule 1 alone, then each exception rule separately, keep what succeeds, and write the rejected entries to `health.skipped` and the message to `health.lastReconcileError` (shown in Protection status). The redirect target is an extension URL, so `blocked.html` must be in `web_accessible_resources` (§5.1) — **verify on all three browsers**.

### A.7 Keyword extraction (`shared/keywords.ts`)

```ts
const HOST_PARAMS: Record<string, string[]> = {
  'yahoo.com': ['p'], 'search.yahoo.com': ['p'], 'yandex.com': ['text'], 'yandex.ru': ['text'],
  'baidu.com': ['wd'], 'youtube.com': ['search_query'], 'amazon.com': ['k'],
};
const GENERIC = ['q', 'query'];                              // never 'p' generically
export function extractSearchText(u: URL): string[] {
  const host = u.hostname.replace(/^www\./, '');
  const params = [...GENERIC, ...(HOST_PARAMS[host] ?? [])];
  return params.map(p => u.searchParams.get(p)).filter((v): v is string => !!v);
}
export const splitKeywords = (s: string) =>
  [...new Set(s.split(/[,\n]/).map(x => x.trim().toLowerCase()).filter(Boolean))];
export function matchKeyword(text: string, kws: string[], mode: 'substring' | 'wholeWord'): string | null {
  const t = text.toLowerCase();
  for (const k of kws) {
    if (mode === 'substring' ? t.includes(k)
      : new RegExp(`(^|[^\\p{L}\\p{N}_])${escapeRegex(k)}($|[^\\p{L}\\p{N}_])`, 'u').test(t)) return k;
  }
  return null;
}
```

---

## Appendix B — Content filters (`src/content/sites.ts`)

**Rules for this table:** it is *data*. Carry the selectors from the old `content.js` over verbatim first, then add the new ones. Mark each entry with `verified: 'YYYY-MM-DD'`. Sites change their DOM often, so ship a developer-only helper `window.__fgFilterHealth()` (enabled only in dev builds) that logs which selectors matched **zero** elements on the current page. Matching = exact host or `.suffix` (never `includes`).

| Filter id | Site (`matches`) | Behaviour | Starting point (verify live) | Default for existing users |
|---|---|---|---|---|
| `ytShorts` | `*://*.youtube.com/*` | Hide Shorts shelves and nav entries; optional DNR path rule `^https?://(www\.\|m\.)?youtube\.com/shorts/` → redirect to the home page (robust against DOM changes) | old selectors + `ytd-reel-shelf-renderer`, `ytd-rich-shelf-renderer[is-shorts]`, nav entries titled "Shorts" | **ON** (was unconditional) |
| `ytHomeFeed` | same | Hide the home grid | `ytd-browse[page-subtype="home"] ytd-rich-grid-renderer` | OFF |
| `ytRecommendations` | same | Hide the watch-page sidebar | `#related`, `ytd-watch-next-secondary-results-renderer` | OFF |
| `ytComments` | same | Hide comments | `ytd-comments#comments` | OFF |
| `igReels` | `*://*.instagram.com/*` | Hide Reels links/tab | `a[href*="/reels/"]` containers | **ON** (was unconditional) |
| `igExplore` | same | Hide Explore | `a[href="/explore/"]` containers | OFF |
| `xTrends` | `*://x.com/*`, `*://*.x.com/*`, `*://*.twitter.com/*` | Hide trends and suggestions | `[data-testid="trend"]`, "Who to follow" panel | OFF |
| `tiktokFeed` | `*://*.tiktok.com/*` | Hide the recommended feed | old selectors (`recommend-list-item-container`, explore items) | **ON** (was unconditional) |
| `linkedinFeed` | `*://*.linkedin.com/*` | Hide feed posts (keyword mode) | old selectors | follows keyword hiding |
| `keywordHide` | YouTube, Reddit, X, Instagram, TikTok, LinkedIn, Google results | Hide items whose title/text contains an active **hide word** (Appendix G; reversible via `data-fg-hidden`) | old selectors for each site | follows keywords |

Google result hiding is supported on `www.google.com/search*` only (other country domains are not enumerated; say so in About). Add new filters only with a row here.

---

## Appendix C — UI specification

### C.1 Tokens (define as CSS variables; Tailwind v4 `@theme` maps to them)

| Token | Dark | Light |
|---|---|---|
| `--bg` | `#0a0a0a` | `#ffffff` |
| `--surface` / `--surface-2` | `#141414` / `#1c1c1c` | `#f6f6f6` / `#eeeeee` |
| `--border` | `#2a2a2a` | `#d9d9d9` |
| `--text` | `#fafafa` | `#111111` |
| `--text-muted` | `#a3a3a3` | `#525252` |
| `--text-subtle` | `#8a8a8a` | `#6b6b6b` |
| `--accent` / `--accent-contrast` | `#10b981` / `#052e1f` | `#047857` / `#ffffff` |
| `--danger` / `--warning` / `--info` | `#f87171` / `#fbbf24` / `#60a5fa` | `#b91c1c` / `#b45309` / `#1d4ed8` |

Verify every text/background pair with a contrast checker (target ≥ 4.5 : 1; the old `text-neutral-600` on near-black is ≈ 2.7 : 1 and must go). Type scale: **12** (minimum, captions) / 13 / 14 (body) / 16 (titles) / 20 / 32 / 56 (timer); weights 400 / 500 / 600; system UI font stack. Spacing 4 / 8 / 12 / 16 / 24; radius 8 / 12 / 16. Controls 36 px tall; icon buttons ≥ 32 × 32 with an `aria-label`. Motion 150–200 ms ease-out, disabled under `prefers-reduced-motion`.

### C.2 Popup shell (380 × 580)

```
┌────────────────────────────────────┐
│ ◉ FocusGate     [ Focus 24:10 ]  ●  │  header 48 px — logo, status chip, protection dot
├────────────────────────────────────┤
│                                    │
│   main  (flex:1; min-height:0;     │  scrolls inside; never resizes the popup
│          overflow-y:auto)          │
│                                    │
├────────────────────────────────────┤
│  Focus  Tasks  Rules  Stats  ⚙     │  nav 56 px — active = filled pill (button is `relative`)
└────────────────────────────────────┘
```

### C.3 Focus view

Ring 220 px with remaining time (large) and phase label; below it duration chips `15 25 45 60 90` + custom field; lock-level segmented control **None · Strict · Commit** with a one-line description under it; full-width primary **Start**. While running: **Extend**, **Stop** (per lock rules, with the reason shown when disabled), **Skip break** during breaks; a hint "Add sites in Rules first" when nothing is blocked. In a locked session show only the ring, the status and Extend.

### C.4 Block page (`blocked.html`)

```
            [shield icon]
   Focus session — 12:30 left            ← headline = real reason (explainBlock)
   reddit.com is blocked right now.      ← host from location.hash
        ┌──────────────────────┐
        │   12:30  remaining   │          ← only for session / standalone reasons
        └──────────────────────┘
   Blocked today: 7    Streak: 4 days
   “Stay focused. You've got this.”      ← custom message / daily quote
   [ Close tab ]   [ Open new tab ]
```

No promotional footer. Renders its final state on first paint; works without the popup bundle.

### C.5 Onboarding (full tab)

1. Welcome + "What distracts you most?" · 2. Presets / add sites · 3. Password (optional; honest trade-offs; Generate) · 4. **Protection check** (incognito, Firefox host access, notifications — each with a fix button) · 5. Done → **Open FocusGate**.

### C.6 Copy rules

Say what is enforced and what is not. Banned unless a test proves them: *completely, instantly, cannot, always, guaranteed, unbreakable*. Use "pages" (not "sites") when only top-level navigations are affected. Every disabled control explains why.

---

## Appendix D — Standalone Block v2 ("Block now"), modeled on the Android Standalone Block

**Reference (if you have the repo):** Android `ui/defense/StandaloneBlockSetupScreen.kt`, `ui/defense/StandaloneBlockModal.kt`, `data/repository/ActiveBlockGuardPolicy.kt`, the active-block card in `ui/focus/FocusScreen.kt`, and the FAQ entries in `ui/settings/SettingsHowToUseScreen.kt`. This appendix is self-contained. (Android's own help text is slightly inconsistent about stopping a block — the screen says it "cannot be stopped early" and the code offers no clear action while locked. **Follow the code: no early stop.**)

### D.1 Concept

A **timed block of a chosen set of sites** with its **own list** and an **absolute end time**. No task, no timer UI. Once started it **cannot be ended early** — you can only **add sites** and **extend** it — and it **always ends by itself** (there is no "no limit"). It runs alongside focus sessions, schedules and the Always-blocked list; the union of everything active applies (A.3).

| Mechanism | Purpose | Ends | Can be weakened? |
|---|---|---|---|
| Focus session | timer, optional task | by the timer; early per lock level (Appendix E) | per lock level |
| **Block now (standalone)** | "block these until X" | by itself at `until`; never early | no — locked |
| Always-blocked list | permanent protection | never | password-gated; locked during any lock |
| Schedule | recurring windows | by the window | guarded (Appendix E) |

### D.2 Where it lives

On the **Focus tab**, behind a mode switch **Focus timer / Block now**. Also reachable from the quick-block popover ("Block now for…") and from a Rules › Sites row action. **Not in Settings.** While active: header chip "Blocking until 17:30"; the toolbar badge shows `ON` when only a standalone block runs.

### D.3 Screens

**Setup (no block running)**

```
┌─ Block now ────────────────────────────┐
│ Block the sites you choose until a time you pick.
│  • Can't be ended early once it starts
│  • You can add sites or extend it
│  • Optional daily allowances (Limits)
│
│ SITES (6)                  [+ Add current site]
│ [reddit.com ×] [x.com ×] [youtube.com ×] …
│ [Use my focus list] [Social] [Video] [My presets ▾] [Save as preset]
│
│ BLOCK UNTIL
│ (30 min) (1 h) (●2 h) (4 h) (End of day) (Tomorrow)
│ [ Fri 16 Oct 2026, 17:30 ]      ← datetime-local, must be in the future
│ Ends in 2 h 0 m
│
│ [ Start block ]   ← disabled until ≥ 1 site and a valid time; the reason is shown
└────────────────────────────────────────┘
```

Confirmation dialog on Start: "Block **{n} sites** until **{date, time}** ({duration})? **You won't be able to end this early.** You can add sites or extend it. {k} open tab(s) on these sites will be replaced by the block page. (Disabling the extension would still stop it — see Protection.)" Buttons *Cancel* / *Start block*. If the block is longer than 24 h, the dialog also needs the tick-box "I understand I can't end this early."

**Active**

```
┌─ BLOCK ACTIVE ─────────────────────────┐
│            1 h 52 m                     │   live countdown
│   6 sites blocked until 17:30           │
│   ▓▓▓▓▓▓▓░░░░░                          │   progress
│   QUICK EXTEND   [+30m] [+1h] [+2h] [+4h]
│   Add a site: [____________] [Add]  [+ Add current site]
│   Blocked (locked):  reddit.com 🔒  x.com 🔒  youtube.com 🔒 …
│   The end time and existing sites are locked. You can add sites or extend the block.
│   Want a stronger block?  → Protection status
└────────────────────────────────────────┘
```

There is **no Stop, Clear or Remove control** anywhere. Expired → a one-line summary ("Block finished — 14 attempts blocked") and the setup screen returns with the last list prefilled.

### D.4 Behaviour (all enforced in the background)

1. **Own list.** `standalone.sites` is chosen at start (typed/pasted and normalised, alias-aware, "+ current site", "Use my focus list" copies `blockedSites`, presets from A3, custom presets, "Save as preset"). A domain already on the Always-blocked list is shown as such. Up to 500 sites.
2. **Expiry.** Chips: 30 min, 1 h, **2 h (default)**, 4 h, End of day, Tomorrow; or a custom `datetime-local`. Minimum 5 minutes ahead, maximum 30 days ahead. (Android defaults to "tomorrow"; a shorter default is safer for a first use.) The background re-validates; the UI is not trusted.
3. **While active:** the list is **append-only**; `until` can only **increase** (+30 m, +1 h, +2 h, +4 h or a later date; cap = 30 days from now). **Adding and extending never need a password** (strengthening is free). *Deviation from Android, which asks for the Focus-Session PIN when saving those changes in its modal; we follow Android's own principle instead.*
4. **Keywords** (global) also apply during a standalone block, as before.
5. **Allowances** (Appendix F): global allowances with `duringBlocks` on exempt a listed site while budget remains. While the block is active, existing allowances are **read-only** and cannot be removed; allowances for sites that are *not* currently blocked can be added (it only strengthens).
6. **Expiry handling:** the `boundary` alarm at `until` calls `endStandalone()`: `active=false`, `lastSites = sites`, `sites = []`, notification "Block finished — N attempts blocked", badge cleared, `reconcile()`. A missed alarm is harmless — everything is time-based (`now ≥ until`).
7. **Persistence:** survives browser restarts; if the browser stays closed past `until`, the block is simply inactive on next start.
8. **Scheduled start** (`startsAt` in the future) is **Tier B**. The model supports it; until `startsAt` the block is "Scheduled" and may be cancelled (nothing is locked yet).
9. **Block page:** reason "Standalone block — ends 17:30" with a live countdown (WP5 #9).
10. **Never-block rules** (port of Android `isNeverBlockPackage`): only http(s) pages are ever affected, and the extension's own pages are never redirected; the engine and `explainBlock` guarantee this.
11. **What a running block locks** is defined once, in Appendix E.

### D.5 Migration from v1

* Finite `standaloneUntil > now` → `standalone = { active:true, startsAt:now, until, sites: normalised blockedSites, … }`.
* **"No limit" (`standaloneUntil === 0`)** → its sites move to `alwaysBlockedSites` (permanent, removal password-gated); the standalone stays inactive; the user sees a one-time notice: "Your 'No limit' block is now an Always-blocked list. Standalone blocks always have an end." (§10 Q14)
* Delete `standaloneMode`, `standaloneUntil` and the Settings card.

### D.6 Copy

| Where | Text |
|---|---|
| Setup subtitle | "Block the sites you choose until a time you pick." |
| Highlights | "Can't be ended early once it starts" · "You can add sites or extend it" · "Optional daily allowances (Limits)" |
| Active note | "Standalone block is running. You can add sites or extend the time, but you can't end it early." |
| Locked-action toast | "Locked until 17:30 by your standalone block." |

### D.7 Acceptance criteria

1. Start a 5-minute block with 3 sites **with the popup closed**: the sites are blocked immediately; at expiry they unblock with no interaction, a notification appears and the state is inactive.
2. While active there is no Stop/Clear/Remove control; no message type exists to end it; the shortcut does nothing to it; a manually crafted `standalone/stop` returns `UNKNOWN_MESSAGE`.
3. Adding a site while active blocks it immediately and it cannot be removed; extending adds time, and a request that would *reduce* `until` is rejected.
4. While active, every weakening action in Appendix E is **refused with an explanation** (toast + disabled control), never silently ignored.
5. After expiry those actions work again (password if set).
6. "No limit" does not exist; the maximum is 30 days; more than 24 h needs the tick-box; Start is disabled with a visible reason when there are no sites or the time is not in the future.
7. A browser restart mid-block keeps it active; a restart after `until` leaves it inactive.
8. Migration cases from D.5 (finite and "No limit") pass with fixtures.
9. The block page shows the standalone reason and a live countdown; C32 passes (§8.4).

---

## Appendix E — Lock levels and the guard matrix

### E.1 Principle (from the Android design)

**Strengthening is free. Weakening is locked while a lock is running and password-gated otherwise. A refusal is never silent.** One function decides, and the UI, the background messages and the keyboard shortcut all call it.

### E.2 Session lock levels — precise definitions

| Level | Ending early | While it runs | Android equivalent |
|---|---|---|---|
| **Normal** (`none`) | Confirm dialog ("End focus? Blocking will stop.") | Nothing is locked | Focus session without a PIN: a confirmation |
| **Strict** | Session password if one is set; otherwise type `I GIVE UP` **and** wait 15 s | Weakening actions are **locked**; adding and extending are allowed | Focus session with a Focus Session PIN |
| **Commit** (`commitment`) | **Not possible.** It ends by itself; maximum 4 h | Weakening actions are **locked**; adding and extending are allowed; the linked task cannot be deleted | Standalone Block's "cannot stop early" |

Drop the fullscreen claim (H02). A Commit session longer than 4 h is refused with "Use Block now for longer blocks" (§10 Q16).

### E.3 Guard function (`shared/gating.ts`)

```ts
export type Guard =
  | { result: 'allow' }
  | { result: 'confirm' }                                   // UI confirm dialog, no password
  | { result: 'password' }                                  // only returned when a password is set
  | { result: 'phrase'; phrase: string; waitMs: number }    // Strict without a password
  | { result: 'locked'; reason: string; until?: number };   // refuse and explain

export function guard(action: Action, s: { session: SessionState; standalone: StandaloneBlock;
                                           hasPassword: boolean; now: number }): Guard
```

`lockSource(s)` = the first of: an active standalone block (`until`), a running Strict/Commit **work** phase (`phaseEndsAt`), else `null`. Action classes: **S** strengthen → always `allow` · **W** weaken → `locked` if `lockSource`, else `password` when a password is set, else `allow` · **E** end a session early → by level (E.2) · **P** change/remove the password → always needs the *current* password, `locked` under a lock · **X** wipe data → like W plus a typed confirmation · **T** delete the task linked to a running Strict/Commit session → `locked`.

### E.4 Matrix (the unit test is this table)

`pw*` = password if one is set, otherwise allow (with a confirm dialog). `phrase` = typed `I GIVE UP` + 15 s wait when no password is set.

| Action | Class | Idle | Normal | Strict | Commit | Standalone active |
|---|---|---|---|---|---|---|
| Add a site, always-site, keyword, schedule; turn a content filter on; extend a session; add sites to or extend a standalone block; add a cap-only limit; lower a limit | S | allow | allow | allow | allow | allow |
| Remove a site, always-site or keyword; clear all keywords; weaken a keyword rule (Block → Hide, Always → During blocks) | W | pw* | pw* | locked | locked | locked |
| Remove sites from, shorten, disable or delete a schedule | W | pw* | pw* | locked | locked | locked |
| Add an exception | W | pw* | pw* | locked | locked | locked |
| Remove an exception | S | allow | allow | allow | allow | allow |
| Remove an allowance; raise a limit; switch `duringBlocks` on; add an allowance with `duringBlocks` for a site that is currently blocked | W | pw* | pw* | locked | locked | locked |
| Turn a content filter off | W | pw* | pw* | locked | locked | locked |
| End a session early | E | — | confirm | pw* or phrase | locked | (follows the session's level) |
| Skip a break | S | — | allow | allow | allow | allow |
| Change or remove the password | P | current password | current password | locked | locked | locked |
| Import a backup (merge into a working state, or restore into an empty one) | S | allow | allow | allow | allow | allow |
| Reset all data | X | pw* + typed confirmation | pw* + typed confirmation | locked | locked | locked |
| Delete the task linked to the running session | T | — | allow | locked | locked | allow |
| Stop a standalone block | — | does not exist | does not exist | does not exist | does not exist | does not exist |
| Everything else (theme, notifications, presets, other tasks…) | S | allow | allow | allow | allow | allow |

*Open point (§10):* a Normal session deliberately locks nothing; Android also locks list removal during a plain Focus session. Default here = it does not, because a Normal session can be stopped with one confirmation anyway.

### E.5 Start-time summary (fixes F11)

Under the lock selector, before Start:

* **Normal:** "You can stop any time (with a confirmation)."
* **Strict:** "To stop early you'll need your password (or type I GIVE UP and wait 15 seconds). Until it ends you can't remove blocked sites, keywords, schedules, allowances or exceptions."
* **Commit:** "You won't be able to stop this session — it ends at 15:40. You can still add sites or extend it. Until then you can't remove blocked sites, keywords, schedules, allowances or exceptions."

If any open tabs are on blocked sites, add: "{k} open tab(s) on blocked sites will be replaced by the block page." The start button reads **Start locked session** for Strict and Commit.

### E.6 UI behaviour

`locked` → the control is disabled with a visible helper line ("Locked until 17:30 by your standalone block"); if it is triggered anyway (keyboard, stale UI) show a toast with the same text. `password` → the password modal. `confirm` → a confirm dialog. `phrase` → the typed-phrase dialog with the 15 s wait. **No silent no-ops anywhere.**

### E.7 Acceptance criteria

1. The matrix in E.4 is a table-driven unit test over every action × state, with password set and unset.
2. `session/stop` with Commit returns `LOCKED`; with Strict and a wrong password returns `BAD_PASSWORD`; the shortcut follows `guard()` and shows why it refused.
3. During Strict, Commit and a standalone block every W/X/P action in the UI is disabled **with an explanation**; after the lock ends they work again (password if set).
4. The start-time summary (E.5) appears for all three levels.
5. Removing an allowance now needs the password when one is set (closes B24); C07, C08, C29–C31 pass.

### E.8 Hardening (Tier B): lock watchdog

While a lock is active, keep a snapshot of the protected keys in `chrome.storage.session`. On `storage.onChanged`, if a change would be refused by `guard()` (for example a site was removed), **revert it** and show the toast. This catches any UI path or DevTools edit that bypasses the hook; it still cannot stop disabling the extension (§3).

---

## Appendix F — Limits (daily allowances) v2

**Reference:** Android `enforcement/AllowanceLedger.kt`, `AllowanceUsageAccumulator.kt`, `ui/settings/DailyAllowanceModal.kt`; extension `App.tsx` L1347-1357 and L1525-1582, `background.js` L189-245, L356-381, L422-508.

### F.1 What the feature is

A per-site **budget of attention**. Every entry has two effects, and the UI says so:

1. **Cap** — when the budget is used up, the site is blocked until it resets (local midnight for *minutes/visits per day*; the end of the window for *minutes per window*). Applies in every context.
2. **Exemption (`duringBlocks`)** — if the switch **"Also allow during focus sessions and blocks"** is on (default, Android semantics), a site that is on a session, schedule or standalone list is **allowed while budget remains**. If off, the site stays blocked during blocks and the limit only caps normal browsing. *Always-blocked sites are never exempted.*

Usage counts **all attention on the site all day**, whether or not a block is running (Android: "allowances count all usage today, not just during blocks").

### F.2 Data and migration

`Allowance` is defined in §5.2 (`mode`, its fields, and `duringBlocks`). `usage[domain]` holds `{ dateKey, usedMs, opens, windowStartMs, lastActiveAt }`. Migration from v1 is in §5.2 (numbers and `time` → `time_budget`; `interval` → `{ allowMin:5, everyMin:limit }`; all with `duringBlocks:true`, which is what v1's DNR code did).

### F.3 Semantics

| Mode | Budget | Counts | Resets | Exhausted when |
|---|---|---|---|---|
| `time_budget` | `limitMin` minutes per day | attentive time on the site | local midnight | `usedMs ≥ limit` |
| `count` | `maxOpens` visits per day | a visit starts after ≥ 2 min away and ends after 30 min of continuous use | local midnight | `opens ≥ max` and no visit in progress |
| `interval` | `allowMin` minutes per window of `everyMin` | attentive time, starting a window on first use | `windowStart + everyMin` (ignores midnight) | window still open and `usedMs ≥ allowMin` |

"Attentive" = the site is the active tab of the **focused** window, the user is not idle (60 s), or the tab is playing audio (A.2). Reset timing, visit rules and the attention sampler are in A.2; the exempt/cap decision is in A.3.

### F.4 Screen — Rules › Limits

```
Daily allowances
Free browsing up to a limit, then blocked until it resets.
Usage counts all day, not just during focus sessions.

┌ Add an allowance ─────────────────────────┐
│ Site  [ reddit.com          ] [+ current site]
│ ( Minutes per day ) ( Visits per day ) ( Minutes per window )
│ [ 5 ][ 10 ][ 15 ][●30 ][ 60 ][ 120 ] [ custom ___ min ]
│ ☑ Also allow during focus sessions and blocks (until used up)
│ → "reddit.com: 30 min per day. Allowed during blocks until used up,
│    then blocked until midnight."
│ [ Add allowance ]
└───────────────────────────────────────────┘

reddit.com            [ Available ]
  ▓▓▓▓▓▓░░░░░░  12 / 30 min today · 18 min left · resets 00:00        ✎  🗑
x.com                 [ Used up — resets 00:00 ]
  ▓▓▓▓▓▓▓▓▓▓▓▓  3 / 3 visits today                                    ✎  🗑
youtube.com           [ Window ends 14:20 ]
  ▓▓▓▓▓▓▓▓░░░░  4 / 5 min this window (5 min every 1 h)                ✎  🗑
```

* Mode **Minutes per window** shows two steppers: "[5] min every [1] hour(s)" with the summary "reddit.com is allowed for 5 min every 1 hour." (the Android wording).
* Amount chips per mode: minutes 5 / 10 / 15 / 30 / 60 / 120; visits 1 / 2 / 3 / 5 / 10; window minutes 5 / 10 / 15 / 30 and hours 1 / 2 / 3 / 4 / 6 / 12 / 24; every mode also takes a custom number (validated: 1–1440 min, 1–100 visits, window 1–168 h).
* **Edit in place** (✎): the same form pre-filled. Lowering a limit or turning `duringBlocks` off is free; raising it, turning `duringBlocks` on or removing it is a **weakening** action (Appendix E). During a lock the existing entries are read-only with a helper line; new entries for sites that are not currently blocked can still be added.
* Names are normalised and alias-aware (`x.com` covers `twitter.com`); entries are shown once per alias group.
* Usage bars and the status chip update live (storage `usage`), and immediately after tab/window changes.
* Empty state: "No allowances yet. Add one to give a site a daily budget."

### F.5 Where it shows up elsewhere

* **Block page:** reason "Daily limit reached — resets at 00:00" (or "Window ends 14:20"), with the remaining/next-reset time; no "focusing" headline (C36).
* **Rules › Sites:** a row with an allowance gets a chip "30 min/day" and the Check-a-URL "Why?" answer includes the remaining budget.
* **Tier B (WP7-B7):** a notification when 5 minutes (or 10 %) remain and when it is used up; optional toolbar badge with the remaining minutes while the active tab is an allowance site (a session's badge wins).

### F.6 Guard rules

As in Appendix E.4: removing an allowance, raising a limit, switching `duringBlocks` on, and adding an exempting allowance for a currently blocked site are **weakening**; everything else is free.

### F.7 Acceptance criteria

1. `reddit.com`, *2 min per day*: after about 2 minutes of **focused, active** viewing the site is blocked until local midnight with the reason "Daily limit reached — resets at 00:00". A background tab, an unfocused or minimised window and idle time do **not** count; a tab playing audio does.
2. The usage bar and chip reflect reality within a minute, and immediately when switching tabs.
3. *Visits per day = 2*: the third visit (after ≥ 2 min away) is blocked; the second visit may finish.
4. *1 min per window of 1 h*: blocked after 1 min of use until the window ends; free again afterwards; midnight does not reset it.
5. `duringBlocks` on: a site on the session list is reachable during a session until its budget is used; off: it stays blocked during the session. Neither case flashes the page (B27).
6. Editing 15 → 30 min works in place with a password prompt only because it is a raise and a password is set; lowering 30 → 15 needs none.
7. During a standalone block or a Strict/Commit session: removing or raising an allowance is refused with an explanation; adding one for an unblocked site works.
8. The block page shows the allowance reason and the reset time.
9. Midnight rollover resets *per-day* budgets even if the browser was asleep; the interval window ignores midnight.
10. v1 migration fixtures (numeric, `time`, `interval`) behave as described in §5.2. C33 passes.

---

## Appendix G — Keywords and content filters v2

**Reference:** Android `ui/defense/BlockedWordsModal.kt` (keywords act on a URL, a search or on-screen text *during an active block*; existing words are locked while a block runs, new ones can be added; removal and "Clear all" are gated); PC `KeywordBlockerScreen` + `KeywordMatchLogger` (scope toggles and a match log); extension `content.js` and `background.js` L284-299.

### G.1 Concept

Every keyword is a **rule** with two explicit choices (v1 had neither, and one list silently did both jobs):

* **Mode** — **Block**: a navigation whose address, search query or (on supported sites) page title contains the word is redirected to the block page. **Hide**: matching items on supported sites are hidden, reversibly. **Both**: v1's behaviour and the migration default.
* **When** — **During blocks** (default; only while a focus session, standalone block or schedule applies — Android's behaviour) or **Always**.

Phrases with spaces are allowed. Matching is case-insensitive; hashtags (`#gaming`) match as typed; the *Contains* / *Whole word* setting applies to every rule.

### G.2 Data

```ts
type KeywordRule = { text: string; mode: 'block' | 'hide' | 'both'; when: 'blocks' | 'always' };
// settings.keywords = { scope: { searchQuery: boolean; url: boolean; title: boolean }, match: 'substring' | 'wholeWord' }
```

`keywords: KeywordRule[]` replaces `blockedKeywords: string[]` (§5.2 migration). A schedule keeps its own `keywords: string[]`; they count as `both` while that schedule is active. `computeBlockPlan` produces `keywords` (block words) and `hideWords` (content script) from these rules (A.3 step 5).

### G.3 Screen — Rules › Keywords

```
Keywords
While a block is active, pages whose address, search or title contains these words
are blocked, and matching items on supported sites are hidden.

[ funny shorts, #gaming        ]  ( Block ) ( Hide ) (●Both )   [ ] Always   [ Add ]

[gaming  ⛔👁 ]  [funny shorts ⛔👁 ● always]  [spoilers 👁 ]      ← tap a chip to edit

Where to look:  [x] Search queries   [x] Web addresses   [ ] Page titles (supported sites only)
Match:          (●Contains)  ( Whole word )

Recent matches (last 50)                                               [Clear]
  gaming · youtube.com · search query · 14:02
  spoilers · reddit.com · hidden item · 13:48

[ Clear all keywords ]   ← confirm dialog; a weakening action (Appendix E)
```

### G.4 Guard

Adding is free. **Removing, "Clear all", switching Block → Hide, or switching Always → During blocks are weakening actions** (locked during a lock, password when set — Appendix E.4).

### G.5 Acceptance criteria

1. Typing `funny shorts, #gaming` creates two rules with mode *Both* and when *During blocks* (closes B25).
2. A **Block-only** word blocks a YouTube in-page search for it, and does **not** hide items on other sites.
3. A **Hide-only** word never blocks a navigation; matching items on supported sites are hidden and reappear when the rule is removed, without a reload.
4. **Always** rules act outside sessions; **During blocks** rules do not.
5. *Whole word*: the keyword "sex" lets "essex" through; *Contains* blocks it.
6. The match log lists word, site, where (query / address / title / hidden item) and time; *Clear* empties it.
7. During a lock, removing a keyword or "Clear all" is refused with an explanation; adding still works.
8. v1 words migrate as `{ mode:'both', when:'blocks' }` and behave exactly as before. C21–C23 pass (§8.4).
