# FocusGate overhaul: tracker

**The only progress record for [`plan.md`](plan.md).** Read [`AGENT_PROMPT.md`](AGENT_PROMPT.md) first. The plan is not authorization to edit code.

## Overall status

- **Status:** Phases 1 and 2 code and tests written (stopped for the owner); not yet verified with the real npm gates
- **Progress:** 7/39 tasks verified
- **Current phase:** Phase 0 done; Phases 1 and 2 written, waiting for owner-run checks; Phase 3 not started
- **Last updated:** 2026-11-06

## Rules

- Status values: `NOT STARTED`, `IN PROGRESS`, `BLOCKED: <reason>`, `UNVERIFIED: needs a browser`, `DONE: evidence recorded`.
- At the start of a phase, set it to IN PROGRESS and write a dated note.
- After each task, tick it only when it is done and verified, and add an evidence row (changed files, exact command, observed result).
- Keep failures and blockers. Append, do not erase.
- Progress counts verified tasks only. UNVERIFIED and BLOCKED do not count.
- Stop and report at each phase boundary.

## Decisions (defaults apply until the owner edits a row)

| ID | Decision | Default | Owner's answer |
|---|---|---|---|
| D1 | Brand direction | A: keep the logo, align the UI to its blue-violet ring plus amber for "blocking" | |
| D2 | Font | Barlow stack declared; font files only when the owner supplies `.woff2` (no download) | |
| D3 | Profile scope | Profile and Protection on top; Tasks, Reflection, Habits kept under a collapsed "Journal and tasks" | |
| D4 | Pause / snooze | Not now (backlog) | |
| D5 | E2E tooling | `tools/e2e/smoke.cjs`, Playwright installed outside the repo, owner runs it unless the agent has a browser | |
| D6 | Shortcuts | Keep Alt+Shift+F and Alt+Shift+B; add a settings row that shows the live keys | |
| D7 | `package-lock.json` host rewrite | Do not touch; report only | |
| D8 | Git and CI | Commit locally per task; do not push; do not run GitHub Actions | |
| D9 | Version | Fixed at 1.0.1 for every phase; never bump; changelog lines go under 1.0.1 | Owner, 2026-11-06 |

## Phase overview

| Phase | Ships as | Status | Verified | Started | Completed | Blocked by |
|---|---|---|---:|---|---|---|
| 0 Hotfix | v1.0.1 | DONE: evidence recorded | 7/7 | 2026-11-05 | 2026-11-06 |  |
| 1 Blocker tells the truth | v1.0.1 (no bump) | UNVERIFIED: owner must run npm test, typecheck, build and the --engine smoke | 0/5 | 2026-11-06 | 2026-11-06 (code) | |
| 2 Schedules explain themselves | v1.0.1 (no bump) | UNVERIFIED: owner must run npm test, typecheck, build | 0/5 | 2026-11-06 | 2026-11-06 (code) | Phase 1 |
| 3 The extension talks | v1.0.1 (no bump) | NOT STARTED | 0/5 | | | T2.1 |
| 4 A real profile | v1.0.1 (no bump) | NOT STARTED | 0/3 | | | Phase 3 |
| 5 Identity | v1.0.1 (no bump) | NOT STARTED | 0/8 | | | Phase 3 |
| 6 Accessibility and polish | v1.0.1 (no bump) | NOT STARTED | 0/3 | | | Phase 5 |
| 7 Release | v1.0.1 (no bump) | NOT STARTED | 0/3 | | | Phase 6 |
| **Total** | | | **7/39** | | | |

## Phase 0: hotfix (v1.0.1)

- [x] T0.1 Alarm event adapter (`chrome.ts`, `chromeAdapter.test.ts`). Done when: test passes, and reverting line 175 makes `npm run typecheck` fail. (DONE: evidence recorded)
- [x] T0.2 Errors are reported, not swallowed (`chrome.ts`, `worker.ts`, `worker.test.ts`) (DONE: evidence recorded)
- [x] T0.3 The three UI crashes (DashboardPage, HabitsCard, RulesScreen) (DONE: evidence recorded)
- [x] T0.4 Shared `ErrorBoundary` on every surface (DONE: evidence recorded)
- [x] T0.5 UI type-check (`tsconfig.ui.json`, `env.d.ts`, 27 errors in groups G1 to G6) (DONE: evidence recorded)
- [x] T0.6 Smoke test in `tools/e2e/`. `UNVERIFIED` until someone ran it on the fixed build (PASS 31, FAIL 0) and on the unfixed build (must FAIL). (DONE: evidence recorded (fast smoke run here; a11y, slow and engine modes UNVERIFIED, owner-run))
- [x] T0.7 Release 1.0.1 (version and changelog; re-pinned to 1.0.1 on 2026-11-06 per D9) (DONE: evidence recorded (owner publishes))

Notes:

- 2026-11-05: Phase 0 started on local branch `overhaul` (from main@69b452d, v1.1.0). The zip held only the pack, not the repo, so the repo was cloned from GitHub TITANICBHAI/FocusGate and the pack copied in as overhaul/. Nothing is pushed (D8).
- Baseline before any change: npm test = 63 files / 364 tests pass; npm run typecheck exit 0; npm run build exit 0; verify_refs.py = 150 checks ok, 0 mismatches; smoke.cjs on the pristine build = PASS 14 FAIL 17 (same as the pack evidence). The sandbox can run Chromium under xvfb, so smoke is run for real here.
- Ruling: package-lock.json points at Replit-only hosts (194 entries), so npm ci cannot run elsewhere. Installed from a temporary rewritten copy and restored the original with git checkout; the lockfile is unchanged (D7). Plan typo: T0.3 says "T0.8" but means T0.6 (smoke.cjs).
- Your FocusGate-main.zip (embedded commit 69b452da) was compared with the GitHub clone: byte-identical (diff -rq, 0 differences), so the work continues on the clone.
- Ruling (T0.4): the plan test (render a child that throws, expect the crash screen) cannot run in this repo. A probe showed renderToStaticMarkup rethrows the child error even inside a class boundary (THREW: child exploded), and there is no DOM library (no new dependencies). tests/ui/errorBoundary.test.tsx tests the boundary lifecycle instead: children pass through, getDerivedStateFromError then render gives the pinned crash screen, the Reload button calls location.reload, componentDidCatch logs. A forced crash in a real browser was not exercised; smoke only proves nothing regressed. Cost if wrong: the mount.tsx wrapper is covered by smoke only.
- Rulings (T0.5): (1) Config last: tsconfig.ui.json, env.d.ts and the typecheck script landed in the final T0.5 commit, after the G1 to G6 fixes, so no commit in history has a red npm run typecheck. UI type errors after each commit: 27, 18 (G1), 12 (G2), 9 (G3), 7 (G4), 4 (G5), 0 (G6). (2) G2: Segmented was already generic; the real cause was onChange declared with method syntax (bivariant), so a state setter became a candidate for T and T fell back to string. Fixed by declaring it as a function-typed property. (3) G5: line 673 is ListRow's swatch prop (not Card title); widened swatch to ReactNode, ListRow already renders it as a child. (4) G1 is a small visible change: chips with tone live or lock now get the existing .fg-chip--live / .fg-chip--lock classes (they rendered unstyled before). Not checked by eye in a browser. (5) G6 is the one runtime change: Clear today's reflection sends note: null and the old code threw on null.length, so the card showed an error toast and did not clear. Moved the update into an exported applyReflection (same logic) and treat null as no note; tests/ui/reflection.test.ts failed on that case first. This goes beyond the plan's Stop-if line (type-only) but is the plan's own prescribed one-line fix. Cost if wrong: Clear now works instead of failing.

Evidence:

| Date | Item | Changed files | Verification | Result |
|---|---|---|---|---|
| 2026-11-05 | T0.1 | src/background/chrome.ts; tests/background/chromeAdapter.test.ts | RED: npx vitest run tests/background/chromeAdapter.test.ts failed with adaptEvent is not a function; GREEN 2/2. npm test 64 files / 366 tests pass; npm run typecheck exit 0; npm run build exit 0. Proof on a throwaway copy: raw chrome.alarms.onAlarm in line 175 makes tsc exit 2 (TS2322 at chrome.ts 175,7) | PASS |
| 2026-11-05 | T0.2 | src/background/chrome.ts; src/background/worker.ts; tests/background/worker.test.ts | RED: the two new worker tests failed (errors list empty; vitest showed unhandled rejections name.startsWith is not a function and tab exploded); GREEN after the fix. npm test: Test Files 64 passed (64); Tests 368 passed (368); npm run typecheck exit 0; npm run build exit 0 | PASS |
| 2026-11-05 | T0.3 | src/ui/dashboard/DashboardPage.tsx; src/ui/dashboard/HabitsCard.tsx; src/ui/panel/views/RulesScreen.tsx | RED: node overhaul/tools/e2e/smoke.cjs dist on the build with T0.1 and T0.2 only = PASS 16 FAIL 15 (assessUrl is not defined; useState is not defined; crash screen on 6 dashboard pages). GREEN after the three hunks and a rebuild: PASS 31 FAIL 0 (real Chromium under xvfb). npm test: Test Files 64 passed (64); Tests 368 passed (368); npm run typecheck exit 0; npm run build exit 0 | PASS |
| 2026-11-05 | T0.4 | src/ui/components/ErrorBoundary.tsx; src/ui/mount.tsx; src/ui/dashboard/DashboardPage.tsx; tests/ui/errorBoundary.test.tsx | RED: npx vitest run tests/ui/errorBoundary.test.tsx failed with Cannot find module ErrorBoundary.tsx. GREEN 4/4. npm test: Test Files 65 passed (65); Tests 372 passed (372); npm run typecheck exit 0; npm run build exit 0; smoke PASS 31 FAIL 0 | PASS |
| 2026-11-06 | T0.5 | primitives.tsx; storageStore.ts; protectionStatus.ts; FocusScreen.tsx; YouScreen.tsx; tsconfig.ui.json; env.d.ts; package.json; tests/ui/primitives.test.tsx; tests/ui/reflection.test.ts | RED: UI tsc showed the plan's 27 errors; Chip live/lock test and Clear-reflection test failed first (class missing; TypeError null.length). GREEN: UI tsc 0 errors. npm test: Test Files 66 passed (66); Tests 378 passed (378); npm run typecheck exit 0 (also fails, exit 2, with a deliberate UI error); npm run build exit 0 | PASS |
| 2026-11-06 | T0.6 | tools/e2e/smoke.cjs; tools/e2e/README.md (copied unchanged, cmp identical); package.json e2e:smoke | Ran here in Chromium under xvfb-run: fixed build (HEAD) PASS 31 FAIL 0; shipped v1.1.0 build PASS 14 FAIL 17 (dashboard could not start, worker name.startsWith, assessUrl is not defined). npm test 378/378; typecheck exit 0; build exit 0 | PASS (fast mode only) |
| 2026-11-06 | T0.7 | package.json; public/manifest.json; CHANGELOG.md; tests/release.test.ts | RED: tests/release.test.ts 2 failed (version 1.1.0, no changelog entry). GREEN: npm test Test Files 67 passed (67), Tests 380 passed (380); npm run typecheck exit 0; npm run build exit 0 (dist/manifest.json 1.1.1); smoke on that build PASS 31 FAIL 0. package-lock.json untouched (D7). Changelog heading follows the repo format (## [1.1.1] - date) with the pinned sentence verbatim | PASS |

## Phase 1: the blocker tells the truth

- [ ] T1.1 Reconcile after blocking-relevant UI writes (UNVERIFIED: unit tests pass in a stand-in runner; `--engine` smoke needs a browser build)
- [ ] T1.2 Quick-block reconciles (UNVERIFIED: same as T1.1)
- [ ] T1.3 Recover when the browser starts (UNVERIFIED: unit tests pass in a stand-in runner; real `npm test` not run)
- [ ] T1.4 An expired phase is not live (`isWorkPhaseLive`) (UNVERIFIED: same as T1.3)
- [ ] T1.5 (optional) Non-ASCII domains (UNVERIFIED: same as T1.3; behaviour already existed, see notes)

Notes:

- 2026-11-06: Phase 1 started and finished writing in one session. The session had no `node_modules` and no network, so `npm test`, `npm run typecheck` and `npm run build` could not run. Instead a small stand-in for vitest (describe, it, expect, vi subset) was run with tsx. It is NOT vitest and is not part of the repo. Each new test was seen failing first (red) and then passing (green) in it. On the whole non-UI test set, the stand-in gives the same results on the untouched v1.0.1 zip and on the changed tree, except for the one attention fixture noted below and `tests/shared/storage.test.ts` (needs `vi.resetModules`, which the stand-in lacks; fails the same way on the untouched zip). `tests/ui/*` were not run at all (they need React and a DOM); the UI files were not changed in Phase 1.
- Type check: only a global `tsc` without `@types/chrome` or React types was available. `tsc --noEmit -p tsconfig.json` gives the same 83 errors (all from the missing type packages) on the untouched zip and on the changed tree, so no new error came from Phase 1. This is weaker than the real `npm run typecheck`, which was not run.
- T1.4 scope: `isWorkPhaseLive` replaces the `status === "work"` test in `computeBlockPlan` (4 places: session reason, keyword context, linked task, allow-only) and in `lockSource`. Two similar checks were left alone because the plan does not name them: `isBlockContextActive` (`plan.ts`) and the linked-task case in `guard` (`gating.ts`). They still treat an elapsed `work` status as live. Owner: say if you want them switched too.
- T1.4 comparison: `session.ts` and `shared/session.ts` treat `now >= phaseEndsAt` as elapsed, so live is `phaseEndsAt > now`, which is what `isWorkPhaseLive` uses. A test pins the exact-end case.
- T1.5: `normalizeDomain` already converts through `new URL(...)`, and `tests/shared/domains.test.ts` already pinned `bücher.example`. So there was nothing to change in `src/shared/domains.ts`. Added the plan's exact pair (`bücher.de` to `xn--bcher-kva.de`) as a test. The audit's real gap is in `src/shared/dnr.ts`: entries already stored as non-ASCII (old data, imports) are skipped when rules are built. That file is not in T1.5's Files line, so it stays in the backlog.
- T1.1 note: the worker's `state/write` test for `settings` passes before and after the change on purpose; it guards that a settings write does not trigger a reconcile.
- T1.3 note: the test harness gained `alarms.getAll`, `onStartup`, and a record of created alarms. `tasks.reconcile` needs `alarms.getAll`, and the old harness did not have it.

Evidence:

| Date | Item | Changed files | Verification | Result |
|---|---|---|---|---|
| 2026-11-06 | T1.1 | src/background/guardedStateWrites.ts; src/background/worker.ts; tests/background/guardedStateWrites.test.ts; tests/background/worker.test.ts | RED in the stand-in runner: afterChange test "expected 0 calls to be 1"; worker test "expected [] toContain news.test". GREEN: guardedStateWrites 10 passed, worker 12 passed. Real vitest, typecheck, build and `--engine` smoke not run | UNVERIFIED |
| 2026-11-06 | T1.2 | src/background/worker.ts; tests/background/worker.test.ts | RED: "expected [] toContain x.com" (Always mode, Alt+Shift+B). GREEN: worker 13 passed. Real gates and `--engine` smoke not run | UNVERIFIED |
| 2026-11-06 | T1.3 | src/background/worker.ts; src/background/chrome.ts; tests/background/worker.test.ts | RED: expired work phase stayed "work"; startup listener count 0 not 1. GREEN: worker 15 passed (no errors reported, history written, tick alarm created, rule for example.com installed). Real gates not run | UNVERIFIED |
| 2026-11-06 | T1.4 | src/shared/sessionClock.ts (new); src/shared/plan.ts; src/shared/gating.ts; tests/shared/plan.test.ts; tests/shared/gating.test.ts; tests/background/attention.test.ts | RED: plan 3 failed ("expected 1 toBe 0"), gating 1 failed (locked, expected allow). GREEN: plan 22 passed, gating 6 passed. One existing fixture used an elapsed phase and was fixed (see Test edits). Real gates not run | UNVERIFIED |
| 2026-11-06 | T1.5 | tests/shared/domains.test.ts | Test added; passes in the stand-in runner (domains 6 passed); no source change needed. Real gates not run | UNVERIFIED |
| 2026-11-06 | Phase 1 whole | all of the above, CHANGELOG.md | Stand-in run of every `tests/**/*.test.ts` outside `tests/ui`: same results as the untouched zip, apart from `tests/shared/storage.test.ts` (stand-in cannot run it; fails the same way on the untouched zip). `tsc` error list identical to the untouched zip | UNVERIFIED |

## Phase 2: schedules explain themselves

- [ ] T2.1 Pure helpers and tests (`scheduleStatus.ts`, `scheduleSummary.ts`) (UNVERIFIED: passes in the stand-in runner only)
- [ ] T2.2 Week strip (`weekCoverage.ts`, `WeekStrip.tsx`) (UNVERIFIED: same)
- [ ] T2.3 Schedule list redesign (`ScheduleSection.tsx`) (UNVERIFIED: same; component test written after the component)
- [ ] T2.4 Add / edit sheet (UNVERIFIED: logic tested in `scheduleForm.test.ts`; the sheet itself was not rendered or clicked)
- [ ] T2.5 Block page names the schedule (UNVERIFIED: same as T2.1)

Notes:

- 2026-11-06: Phase 2 written in one session. Same limits as Phase 1: no `node_modules`, no network. The stand-in runner (not vitest, not in the repo) ran every `tests/**/*.test.ts(x)`: all pass except 2 tests in `tests/shared/storage.test.ts` (runner cannot reset modules; they fail the same way on the untouched zip). The runner now also covers `tests/ui` (React 19.2.8 from the global install, `lucide-react` replaced by empty icons). `tsc` error list is still the same 83 errors as the untouched zip (missing type packages), so it proves little about the new `.tsx` files. Real `npm test`, `npm run typecheck`, `npm run build` not run.
- Visual check: `ScheduleSection` was rendered to static HTML with the real `styles.css` (Tailwind import swapped for a tiny reset) and screenshotted in Chromium at 392px wide, dark and light: `overhaul/evidence/phase2/schedules-dark.png` and `schedules-light.png`. Long names wrap, nothing truncates, the strip and the "On now" bar read clearly. This is NOT a screenshot of the built extension; the add/edit sheet is not in the screenshots (it needs a browser and a real state).
- Test order: T2.1, the `weekCoverage` part of T2.2, `scheduleForm` (T2.4) and T2.5 each had a failing test first. The `WeekStrip` and `ScheduleSection` render tests were written after their components.
- New files: `src/ui/lib/scheduleSummary.ts`, `src/ui/lib/weekCoverage.ts`, `src/ui/lib/scheduleForm.ts` (not named in the plan: holds the pure form and lock logic so it can be tested without a browser), `src/ui/components/WeekStrip.tsx`, `src/ui/panel/views/ScheduleSection.tsx`. `scheduleStatus.ts` already existed and now also exports `scheduleStatus`.
- T2.3 switch: the row uses a plain `role="switch"` button with only an `aria-label` (no visible "Enable ..." text), reusing the `fg-toggle__track` class. `styles.css` got an extra `[aria-checked="true"]` rule next to the existing `[aria-pressed="true"]` one, so the switch is styled without `aria-pressed`. T6.1 can drop the `aria-pressed` rule when `Toggle` is fixed. `primitives.tsx` was not touched.
- T2.4 lock rule: saving builds the new schedule list and asks the existing classifier (`classifyStateMutation`) and `guard` whether it weakens protection. If a strict or commit lock refuses it, the lock text is shown in the sheet and nothing is saved. Delete is disabled while locked. A password-protected edit still goes through the existing store path.
- T2.4 template buttons are "Work hours" (Mon to Fri 9 to 5), "Study" (Mon to Fri 6 to 9 PM), "Sleep" (every day 10 PM to 7 AM); the plan pinned the names, the hours are my choice. Owner: say if you want other defaults.
- T2.4 known edge: a stored end time of `24:00` is shown as 23:59 in the time input (browsers reject 24:00), and stays `24:00` unless you change it.
- T2.5: the eyebrow for schedule blocks changed from "Blocked by schedule" to "Scheduled block" so it does not repeat the new headline "Blocked by schedule: <name>". The meta line is now "Ends <time>". `reasonTitle` and `reasonMeta` are now exported from `BlockedPage.tsx` for the test.
- Not done on purpose: the weekly-time formats use the browser locale for AM and PM; a plain space replaces the narrow no-break space newer ICU builds insert.

Evidence:

| Date | Item | Changed files | Verification | Result |
|---|---|---|---|---|
| 2026-11-06 | T2.1 | src/ui/lib/scheduleStatus.ts; src/ui/lib/scheduleSummary.ts; tests/ui/scheduleSummary.test.ts; tests/ui/scheduleStatus.test.ts | RED: module not found. GREEN: scheduleSummary 11 passed, scheduleStatus 10 passed; also green with TZ set to America/New_York, Europe/Berlin and UTC. Real gates not run | UNVERIFIED |
| 2026-11-06 | T2.2 | src/ui/lib/weekCoverage.ts; src/ui/components/WeekStrip.tsx; src/ui/styles.css; tests/ui/weekCoverage.test.ts; tests/ui/weekStrip.test.tsx | RED (weekCoverage): module not found. GREEN: weekCoverage 6 passed, weekStrip 3 passed; foundation, themeTokens and claims tests still pass. No hex colours and no font size under 12px in the new CSS. Real gates not run | UNVERIFIED |
| 2026-11-06 | T2.3 and T2.4 | src/ui/panel/views/ScheduleSection.tsx; src/ui/panel/views/RulesScreen.tsx; src/ui/lib/scheduleForm.ts; src/ui/styles.css; tests/ui/scheduleForm.test.ts; tests/ui/scheduleSection.test.tsx | RED (scheduleForm): module not found. GREEN: scheduleForm 9 passed, scheduleSection 7 passed. Screenshots in overhaul/evidence/phase2. Sheet not rendered or clicked. Real gates not run | UNVERIFIED |
| 2026-11-06 | T2.5 | src/ui/blocked/BlockedPage.tsx; tests/ui/blockedReason.test.ts | RED: "does not provide an export named reasonMeta". GREEN: blockedReason 3 passed; claims test still passes | UNVERIFIED |
| 2026-11-06 | Phase 2 whole | all of the above, CHANGELOG.md | Stand-in run of all test files under tests/: all pass except 2 in tests/shared/storage.test.ts (same on the untouched zip). tsc error list identical to the untouched zip (83) | UNVERIFIED |

## Phase 3: the extension talks

- [ ] T3.1 `describeNow`
- [ ] T3.2 Status strip and labelled header pill
- [ ] T3.3 Lock explainer
- [ ] T3.4 Locked controls explain themselves
- [ ] T3.5 First run

Notes:

Evidence:

| Date | Item | Changed files | Verification | Result |
|---|---|---|---|---|

## Phase 4: a real profile

- [ ] T4.1 Two new settings (`displayName`, `why`)
- [ ] T4.2 Profile screen
- [ ] T4.3 The user's reason on the block page, and plural fix

Notes:

Evidence:

| Date | Item | Changed files | Verification | Result |
|---|---|---|---|---|

## Phase 5: identity

- [ ] T5.1 Icons
- [ ] T5.2 Tokens (`node tools/contrast-check.mjs` passes; foundation and theme tests pass)
- [ ] T5.3 Type
- [ ] T5.4 Rows, not stacked cards
- [ ] T5.5 Dashboard layout and charts
- [ ] T5.6 Block page layout
- [ ] T5.7 The gate-closing moment
- [ ] T5.8 About line

Notes:

Evidence:

| Date | Item | Changed files | Verification | Result |
|---|---|---|---|---|

## Phase 6: accessibility and polish

- [ ] T6.1 ARIA fixes (`smoke.cjs --a11y` shows 0 critical or serious)
- [ ] T6.2 Shortcuts row
- [ ] T6.3 Focus, motion, zoom

Notes:

Evidence:

| Date | Item | Changed files | Verification | Result |
|---|---|---|---|---|

## Phase 7: release

- [ ] T7.1 Keep version 1.0.1 (D9); changelog lines under 1.0.1
- [ ] T7.2 Refresh store screenshots and README images
- [ ] T7.3 Final gate: `npm test`, `npm run typecheck`, `npm run build`, `smoke.cjs --a11y --engine --slow`

Notes:

Evidence:

| Date | Item | Changed files | Verification | Result |
|---|---|---|---|---|

## Test edits (only the ones the plan allows)

| Date | Test file | What changed | Why (task) |
|---|---|---|---|
| 2026-11-06 | tests/background/attention.test.ts | In "meters during-block exemptions", the fixture set `session.status = "work"` with `phaseEndsAt` left at 0 (already elapsed). Added `phaseEndsAt = 1_000_000` so the phase is live. No assertion changed | T1.4 (plan allows fixing fixtures that used an elapsed phase) |
| 2026-11-06 | tests/background/worker.test.ts | Harness only: added `alarms.getAll`, `runtime.onStartup`, a list of created alarms, a DNR update counter and a `dnrRuleDomains` helper. No existing test or assertion changed | T1.1, T1.3 |
| 2026-11-06 | tests/ui/scheduleStatus.test.ts | Added `scheduleStatus` to the import and a new `describe("scheduleStatus")` block. No existing test changed | T2.1 |
| 2026-11-06 | tests/release.test.ts | Expected version 1.1.1 changed to 1.0.1, changelog heading [1.1.1] changed to [1.0.1] | D9 (owner: keep v1.0.1 for all phases) |

## Owner-run checks (things an agent without a browser cannot do)

| Check | Command or steps | Who ran it | Date | Result |
|---|---|---|---|---|
| Smoke test, fast | `node tools/e2e/smoke.cjs dist` (see `tools/e2e/README.md`) | Claude, in the sandbox (Chromium under xvfb-run, NODE_PATH=/opt/node-tools/node_modules) | 2026-11-06 | fixed build PASS 31 FAIL 0; v1.1.0 build PASS 14 FAIL 17. Owner can re-run: npm run build && node tools/e2e/smoke.cjs dist |
| Smoke test, accessibility | `... --a11y` | | | |
| Smoke test, engine | `xvfb-run -a node tools/e2e/smoke.cjs dist --engine` (needs a build first; expect 4/4 green after T1.1 and T1.2) | | | |
| Real gates after Phases 1 and 2 | `npm ci` (or `npm install`), then `npm test`, `npm run typecheck`, `npm run build` | | | |
| Smoke test, slow | `... --slow` | | | |
| Screenshots (list in DESIGN.md section 12) | | | | |
| Zoom 200 % and 300 px width | | | | |

## Blockers and questions for the owner

| Date | Task | Question or blocker | Agent's recommended answer | Owner's answer |
|---|---|---|---|---|

## History

- _(date)_: tracker created.
- 2026-11-05: Phase 0 started (see Phase 0 notes).
- 2026-11-06: Phase 0 done (T0.1 to T0.7), stopped for the owner. Nothing pushed.
- 2026-11-06: Phase 2 (T2.1 to T2.5) written and tested in the stand-in runner; stopped for the owner. Nothing pushed. Boxes stay unticked until the real gates are run.
- 2026-11-06: Phase 1 (T1.1 to T1.5) written and tested in a stand-in runner; stopped for the owner. Nothing pushed. Boxes stay unticked until the real gates are run.
- 2026-11-06: Owner decision D9: version is 1.0.1 for every phase. package.json, public/manifest.json, CHANGELOG.md heading, tests/release.test.ts, plan.md, README.md, AGENT_PROMPT.md and this tracker updated. Gates (npm test, typecheck, build) NOT re-run after this change: UNVERIFIED, the session has no node_modules and no network for npm install. Owner-run: npm ci (or npm install), then npm test, npm run typecheck, npm run build.
