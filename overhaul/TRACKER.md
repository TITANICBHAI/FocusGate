# FocusGate overhaul: tracker

**The only progress record for [`plan.md`](plan.md).** Read [`AGENT_PROMPT.md`](AGENT_PROMPT.md) first. The plan is not authorization to edit code.

## Overall status

- **Status:** Phases 1 to 6 code and tests written (stopped for the owner); not yet verified with the real npm gates
- **Progress:** 7/39 tasks verified
- **Current phase:** Phase 0 done; Phases 1 to 6 written, waiting for owner-run checks; Phase 7 not started
- **Last updated:** 2026-11-07

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
| 3 The extension talks | v1.0.1 (no bump) | UNVERIFIED: owner must run npm test, typecheck, build, and look at the panel | 0/5 | 2026-11-06 | 2026-11-07 (code) | T2.1 |
| 4 A real profile | v1.0.1 (no bump) | UNVERIFIED: owner must run npm test, typecheck, build, and look at the You tab and block page | 0/3 | 2026-11-07 | 2026-11-07 (code) | Phase 3 |
| 5 Identity | v1.0.1 (no bump) | UNVERIFIED: owner must run npm test, typecheck, build, and look at every screen in both themes | 0/8 | 2026-11-07 | 2026-11-07 (code) | Phase 4 |
| 6 Accessibility and polish | v1.0.1 (no bump) | UNVERIFIED: owner must run npm test, typecheck, build, the --a11y smoke, and try the panel at 200% zoom | 0/3 | 2026-11-07 | 2026-11-07 (code) | Phase 5 |
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

- [ ] T3.1 `describeNow` (UNVERIFIED: stand-in runner only)
- [ ] T3.2 Status strip and labelled header pill (UNVERIFIED: same; static-HTML screenshots only)
- [ ] T3.3 Lock explainer (UNVERIFIED: same)
- [ ] T3.4 Locked controls explain themselves (UNVERIFIED: same)
- [ ] T3.5 First run (UNVERIFIED: same; the install event was not fired in a real browser)

Notes:

- 2026-11-07: Phase 3 written over two sessions. Same limits as Phases 1 and 2: no `node_modules`, no network. Stand-in runner: all 74 test files outside `tests/shared/storage.test.ts` pass. `tsc` error list is identical to the untouched zip (83 errors, missing type packages). The one real finding from `tsc`: `src/background/chrome.ts` declares its own small `chrome` type and lacked `tabs.create`; added. Real `npm test`, `npm run typecheck`, `npm run build` not run.
- T3.1: `src/ui/lib/statusSummary.ts` (`describeNow`) follows the DESIGN table in order: Block now, live work phase (none, strict, commit), break, schedule, then idle (no sites, Always list only, nothing blocking). An exhausted daily limit adds a second line. A "no schedules" idle state offers `Add a schedule`.
- T3.2: `StatusStrip` sits under the panel header and above the dashboard. Its button is secondary, never primary, so the "one primary action" test still holds. The header pill says `Not blocking`, `Blocking` or `Break` in words, with a lock icon when locked. The old dot-only status is gone.
- T3.3: the lock explainer is a list; the selected lock carries `aria-current`. The two sentences `tests/claims.test.ts` pins are kept word for word.
- T3.4: lock messages now show a clock time (for example "Locked until 12:42 AM by your strict session."), never a raw timestamp. `guard` takes an optional `locale`. `weakeningLockReason` now just returns the guard reason (one wording in one place). The visible lock line has `id="lock-reason"` and every control disabled by the lock has `aria-describedby="lock-reason"`.
- T3.4 shared formatter: `src/shared/clockFormat.ts` (`formatClockTime`) is now used by the lock messages, the block page and the schedule summary. `FocusScreen` and `PasswordSettings` still format times themselves (not in the task's files; backlog).
- T3.5: on `reason === "install"` the worker opens `onboarding.html` in a tab after the install work; a failure to open the tab is reported through `onError` and does not undo the install work. An update opens nothing. The Focus tab's empty state now shows a secondary `Add sites` button instead of the grey line; **Start focus** is not disabled (it still toasts and opens Rules when nothing can be blocked, as before).
- T3.5 test order: the worker test was written first and seen red. The empty-state render test was written together with the change, not before.
- Corrections to Phase 2 strings found while checking DESIGN section 9.3: the Schedules description line, the visible "Days" label, the "(N sites)" count (only for the "list" option) and the empty-sites error ("Add at least one site, or use your Focus list.") now match the pinned text; tests added.
- Class name: my first status classes `.fg-status*` collided with an existing `.fg-status` rule, so mine are `.fg-nowline*`.
- Not done on purpose: the "gate closes" animation (DESIGN, belongs with T6.x). Screenshots are static HTML with the real `styles.css`, not the built extension.
- `describeNow` counts: "The Always list is blocking N sites." counts the Always list only; the Focus list is not added.

Evidence:

| Date | Item | Changed files | Verification | Result |
|---|---|---|---|---|
| 2026-11-06 | T3.1 | src/shared/clockFormat.ts; src/ui/lib/statusSummary.ts; tests/ui/statusSummary.test.ts | RED: module not found. GREEN in the stand-in runner. Real gates not run | UNVERIFIED |
| 2026-11-06 | T3.2 | src/ui/components/StatusStrip.tsx; src/ui/components/primitives.tsx; src/ui/panel/PanelPage.tsx; src/ui/dashboard/DashboardPage.tsx; src/ui/styles.css; tests/ui/statusStrip.test.tsx; tests/ui/panelRender.test.tsx | GREEN in the stand-in runner; foundation, themeTokens, claims still pass. Screenshots overhaul/evidence/phase3/status-{300,400}-{dark,light}.png (static HTML). Real gates not run | UNVERIFIED |
| 2026-11-06 | T3.3 | src/ui/panel/views/FocusScreen.tsx; src/ui/styles.css; tests/ui/panelRender.test.tsx | GREEN; claims test still passes (two lock sentences intact) | UNVERIFIED |
| 2026-11-07 | T3.4 | src/shared/gating.ts; src/ui/lib/guardState.ts; src/ui/panel/views/RulesScreen.tsx; src/ui/panel/views/ScheduleSection.tsx; src/ui/blocked/BlockedPage.tsx; src/ui/lib/scheduleSummary.ts; tests/shared/gating.test.ts; tests/ui/lockedControls.test.tsx | RED: gating 3 failed ("Locked until 1793646720000 by your strict session."), lockedControls 2 failed (no id, no aria-describedby). GREEN: gating 9 passed, lockedControls 3 passed | UNVERIFIED |
| 2026-11-07 | T3.5 | src/background/worker.ts; src/background/chrome.ts; src/ui/panel/views/FocusScreen.tsx; tests/background/worker.test.ts; tests/ui/panelRender.test.tsx | RED: worker "expected length 0 to be 1". GREEN: worker 17 passed, panelRender 6 passed | UNVERIFIED |
| 2026-11-07 | Phase 3 whole | all of the above, CHANGELOG.md | Stand-in run: 74 test files pass (storage.test.ts excluded, same limit as before). tsc error list identical to the untouched zip (83) | UNVERIFIED |

## Phase 4: a real profile

- [ ] T4.1 Two new settings (`displayName`, `why`) (UNVERIFIED: stand-in runner only)
- [ ] T4.2 Profile screen (UNVERIFIED: same; static-HTML screenshots only)
- [ ] T4.3 The user's reason on the block page, and plural fix (UNVERIFIED: same)

Notes:

- 2026-11-07: Phase 4 written. Same limits as before (no `node_modules`, no network). Stand-in runner: all 79 test files outside `tests/shared/storage.test.ts` pass. The `tsc` error list for `tsconfig.json` is identical to the untouched zip.
- New check method for `src/ui`: `tsc -p tsconfig.ui.json` stops at "Cannot find type definition file for chrome / vite/client" and never reports real errors, so earlier phases' UI code was not type-checked by me. I now run a temporary config with `types: []` and compare the real-error codes (2322, 2339, 2345, 2304, 2305, 2551, 2554 and similar) against the untouched zip. Result: no new real errors in Phases 1 to 4. The only differences are `key` prop errors that come from React types being absent (the same class as the existing ones). The owner's real `npm run typecheck` is still the authority.
- T4.1: `Settings.displayName` and `Settings.why` (strings, default `""`). New `src/shared/profile.ts` holds the limits (24 and 140), `cleanDisplayName`, `cleanWhy` and `withProfileDefaults`. Stored settings from 1.1.0 lack the fields, so they are filled when read: in `getState` (`src/shared/storage.ts`) and in the UI store (`storageStore.ts`, both the first load and change events). Migration from v1 and backup restore also fill and cut them. The backup validator accepts the fields as optional strings (an older backup without them still imports; a non-text value is rejected). Merge import keeps the person's own name and reason when the backup has none. These two fields do not weaken any protection, so `classifyStateMutation` already lets them through without a password.
- T4.2: the You tab is now, in order: name with a one-letter badge, "Your reason", "What you're protecting" (rows open the matching Rules section), "Today and this week", "Achievements" (each with its condition), then a collapsed "Journal and tasks" holding tasks, reflection and habits. "Open full dashboard" stays at the bottom. Name and reason save when the box loses focus (name also on Enter) through the guarded settings write. New files are under `src/ui/panel/views/profile/`, plus `src/ui/lib/profileSummary.ts` and `profileActions.ts`.
- T4.2 deviations (decide if you want them changed): (1) No "Focusing since" line: the state holds no install or first-use date and the plan says not to add one. (2) No "Default lock" row: there is no stored default lock (the Focus tab starts at None each time), so any value would be made up. (3) The Password row is not a button: there is no Rules section for it. (4) The old "Best" streak stat was dropped from the compact row (the plan lists focused, goal, streak). (5) Achievements show only Locked or Unlocked: the definitions carry no progress numbers.
- T4.3: `DEFAULT_BLOCK_MESSAGE` is now one constant in `defaults.ts` (string unchanged, so the fixture and `blockPage.test.ts` still pass). The old block page compared the message with a different string ("You are supposed to be focusing right now."), so the stock line "Stay focused. You've got this." was never hidden; it now is. With no custom message the detail line stays "This page is blocked by your current FocusGate rules." The person's reason shows under it as "Your reason" and the text in quotes. "1 pages" is fixed ("1 page blocked today"). The reason section is now an exported component `BlockedReasonBody` so it can be rendered in a test; the pinned `reason.kind === "session" || reason.kind === "standalone"` text is unchanged.
- Chart: the week bars are shorter (80 px tall instead of 120) and their day labels are 12 px with a visible colour in dark mode (they were unreadable).

Evidence:

| Date | Item | Changed files | Verification | Result |
|---|---|---|---|---|
| 2026-11-07 | T4.1 | src/shared/types.ts; defaults.ts; profile.ts (new); migrate.ts; storage.ts; backup.ts; src/ui/hooks/storageStore.ts; tests/shared/profile.test.ts; tests/fixtures/v2-storage.expected.json | RED: profile.test.ts could not import `profile.ts`. GREEN: profile 9 passed, backup 6, migrate 6 (after fixture edit), storageStore 9. Real gates not run | UNVERIFIED |
| 2026-11-07 | T4.2 | src/ui/panel/views/YouScreen.tsx; src/ui/panel/views/profile/*.tsx (6 new); src/ui/lib/profileSummary.ts; src/ui/lib/profileActions.ts; src/ui/panel/PanelPage.tsx; src/ui/styles.css; tests/ui/profileSummary.test.ts; profileActions.test.ts; youScreen.test.tsx | RED: modules missing, then youScreen 6 failed on the old screen. GREEN: 9 + 4 + 6 passed; foundation, themeTokens, claims still pass. Screenshots overhaul/evidence/phase4/profile-{empty,filled}-{300,400}-{dark,light}.png (static HTML with the real styles.css, no horizontal overflow at 300 or 400 px). First pass showed a tall empty chart, unreadable dark-mode day labels, no expand cue on the journal and a reason box that did not look editable; all fixed and re-shot | UNVERIFIED |
| 2026-11-07 | T4.3 | src/shared/defaults.ts; src/ui/blocked/BlockedPage.tsx; src/ui/styles.css; tests/ui/blockedWhy.test.tsx | RED: exports missing. GREEN: blockedWhy 8 passed; blockedReason 3, claims 16, blockPage 2 still pass | UNVERIFIED |
| 2026-11-07 | Phase 4 whole | all of the above, CHANGELOG.md | Stand-in run: 79 test files pass (storage.test.ts excluded). `tsc` list identical to the untouched zip; no new real UI errors (method above) | UNVERIFIED |

## Phase 5: identity

- [ ] T5.1 Icons (UNVERIFIED: stand-in runner only)
- [ ] T5.2 Tokens (`node overhaul/tools/contrast-check.mjs` passes; foundation, theme and claims tests pass in the stand-in runner)
- [ ] T5.3 Type (no font files shipped; see notes)
- [ ] T5.4 Rows, not stacked cards
- [ ] T5.5 Dashboard layout and charts
- [ ] T5.6 Block page layout
- [ ] T5.7 The gate-closing moment
- [ ] T5.8 About line

Notes:

- 2026-11-07: Phase 5 written. Same limits as before (no `node_modules`, no network, no built extension). Stand-in runner: all 86 test files outside `tests/shared/storage.test.ts` pass. `tsc` list for `tsconfig.json` identical to the untouched zip; no new real errors in the `src/ui` check (method in Phase 4 notes; the only differences are `key` prop noise from missing React types and `chrome` not found in the new `AboutLine.tsx`, the same class as the existing `protectionStatus.ts`).
- T5.1: the four app icons, `public/icon.png` (used by the dashboard and block page) and `store-assets/icon-128.png` are now the transparent-corner versions. `public/icon.png` was not named in the plan but is the same logo with the same white corners. `tests/assets/icons.test.ts` decodes each PNG and checks the four corners are transparent and the centre is opaque.
- T5.2: new colour tokens in all four theme blocks (dark, light, system dark, system light), radii 10 px (card) and 6 px (control). The theme test now also checks `danger-contrast` on `danger` and `warning-contrast` on `warning` at 4.5:1. Amber was moved to where it means "blocking now": the "Always" chip, the lock-level pick and the schedule warning line are no longer amber; the radial glow behind the dashboard was removed; the small bar chart is no longer coloured with the accent.
- T5.3: `--font-ui` is `Barlow` then the system font, `--font-num` is `Barlow Semi Condensed` then Barlow then the system font. No `.woff2` is bundled (decision D2: the owner has not sent the files), so the system font is what people see until they do. All-caps labels and tracked letters are gone; labels are 13/500 sentence case. Timer, stat values and the block countdown use the number font with tabular digits. Stat values went from 20 to 28 px as the design table says; check they still fit at 300 px.
- T5.4: in the panel, cards lose their box and become headed groups (24 px apart). Rows are 48 px minimum with a 3 px left bar; the bar is amber on a site that is blocking now (using the plan the row already had), and `ListRow` has a new `blocking` prop. Titles wrap instead of being cut with an ellipsis, chips wrap, and the row wraps its buttons under the text when there is no room. The first screenshot at 300 px showed the `youtube.com` row squeezed to a one-letter-wide column when the chip and the Remove button sat beside it; fixed by letting the row wrap, then re-shot. A new chip tone `strong` is used for the "Always" label (the existing `lock` tone stays amber, as `primitives.test.tsx` pins).
- T5.5: from 1100 px the Overview has two columns (content and a 340 px rail with the week strip, daily limits and "Times protection was off"). The hero now shows only today. The weekly figure is the chart caption. "Completion rate" and "Total focus time" each appear once. The focus score has its formula written under it (60 goal, 30 tasks, 10 streak). "Protection gaps" is renamed "Times protection was off" with one explaining line. The chart is the new `WeekBars` (full width, weekday labels, value on the tallest and today's bar, one summary sentence for screen readers, each bar focusable with its own minutes). Plan wording for the rail says the status strip's detail; I did not add a second copy of it, since the strip is already shown above the page.
- T5.6: the block page is left-aligned in a 480 px column with a small FocusGate mark at the top left. The headline is `Blocked by …` (focus session, Block now, schedule, daily limit, your Always list, keyword; allow-only reads `Blocked: not on your allowed list`). The headline, address and end time share an amber bar; then the countdown (session and standalone only), the detail line, your reason, **Close tab** (now the primary button) and **Open new tab**, then the count. The small label above the headline is gone. `reasonLabel` was removed as unused.
- T5.7: the status strip's bar is a pseudo-element that sweeps from 0 to full height in 280 ms when blocking starts after idle or a break (`shouldSweep`), inside `prefers-reduced-motion: no-preference`. Not on first render. There were no section entrance animations to remove; the sheet, scrim and toast animations (overlays) stay.
- T5.8: `AboutLine` at the top of the About card: `FocusGate v<manifest version> by TBTechs` and `Your data stays in browser storage.` The sentence did not exist in that card before. The two existing FocusFlow links are unchanged and no link was added.
- T5.2 to T5.7 test order: the T5.1, T5.3, T5.4, T5.6 tests were seen red first. The T5.5 tests were written first but the three new components were written before I ran them (`weekBars` was run red-then-green; `dashboardStats` was not run red). The T5.7 and T5.8 tests were written with the code and not run red.

Evidence:

| Date | Item | Changed files | Verification | Result |
|---|---|---|---|---|
| 2026-11-07 | T5.1 | public/icons/*.png; public/icon.png; store-assets/icon-128.png; tests/assets/icons.test.ts | RED: corners opaque. GREEN: 6 files pass | UNVERIFIED |
| 2026-11-07 | T5.2 | src/ui/styles.css; tests/ui/themeTokens.test.ts | `node overhaul/tools/contrast-check.mjs` passes; foundation 3, themeTokens 4, claims 16 pass | UNVERIFIED |
| 2026-11-07 | T5.3 | src/ui/styles.css; tests/ui/typography.test.ts | RED then GREEN: 4 passed | UNVERIFIED |
| 2026-11-07 | T5.4 | src/ui/components/primitives.tsx; src/ui/panel/views/RulesScreen.tsx; FocusScreen.tsx; src/ui/onboarding/OnboardingPage.tsx; src/ui/styles.css; tests/ui/rows.test.tsx | RED: 6 failed. GREEN: 6 passed; primitives, panelRender, claims still pass. Screenshots overhaul/evidence/phase5/p5-rules-{300,400}-{dark,light}.png and p5-you-* (static HTML with the real styles.css; no horizontal overflow) | UNVERIFIED |
| 2026-11-07 | T5.5 | src/ui/components/WeekBars.tsx (new); src/ui/dashboard/DashboardStats.tsx; src/ui/styles.css; tests/ui/weekBars.test.tsx; tests/ui/dashboardStats.test.tsx | weekBars RED (2 failed on date format and value count; fixed). GREEN: weekBars 7, dashboardStats 6. Screenshots p5-dash-{800,1280}-{dark,light}.png | UNVERIFIED |
| 2026-11-07 | T5.6 | src/ui/blocked/BlockedPage.tsx; src/ui/styles.css; tests/ui/blockedWhy.test.tsx; tests/ui/blockedReason.test.ts | RED: 5 failed. GREEN: blockedWhy 12, blockedReason 4, claims 16. Screenshots p5-block-{dark,light}.png | UNVERIFIED |
| 2026-11-07 | T5.7 | src/ui/components/StatusStrip.tsx; src/ui/styles.css; tests/ui/gateAnimation.test.tsx | GREEN: 4 passed. The animation itself has not been seen (static screenshots cannot show it) | UNVERIFIED: needs a browser |
| 2026-11-07 | T5.8 | src/ui/dashboard/AboutLine.tsx (new); src/ui/dashboard/DashboardSettings.tsx; tests/ui/aboutLine.test.tsx | GREEN: 4 passed; claims 16 pass | UNVERIFIED |
| 2026-11-07 | Phase 5 whole | all of the above, CHANGELOG.md | Stand-in run: 86 test files pass (storage.test.ts excluded). `tsc` list identical to the untouched zip | UNVERIFIED |

## Phase 6: accessibility and polish

- [ ] T6.1 ARIA fixes (UNVERIFIED: `smoke.cjs --a11y` not run; no axe-core here)
- [ ] T6.2 Shortcuts row
- [ ] T6.3 Focus, motion, zoom

Notes:

- 2026-11-07: Phase 6 written. Same limits as before (no `node_modules`, no network, no built extension). Stand-in runner: 89 test files pass (577 tests), `tests/shared/storage.test.ts` excluded as before. `tsc` list for `tsconfig.json` identical to the untouched zip (83). The temporary `src/ui` check shows no new real errors (two old `TS7053` ones went away). `contrast-check.mjs`: all pairs meet their target.
- T6.1: `Toggle` keeps `role="switch"` and `aria-checked` only (`aria-pressed` removed; the CSS now reads `[aria-checked="true"]`, and the Phase 3 extra rule for it was merged). `Segmented` keeps `aria-pressed` only (no `aria-selected`, no second `aria-labelledby`; the group is named once by `aria-label`, and the visible label is `aria-hidden`). `Progress` now requires a `label` and all six call sites pass one ("Daily goal", "<label> progress", "Daily limit used on <domain>"). The editable timer's name is `Edit session length, 25:00` so the visible text is in the name. The panel is split into an exported `PanelChrome`: `<h1>` (visually hidden) "FocusGate"; the three tab buttons sit in a `role="tablist"`; each screen is its own `role="tabpanel"` with `aria-labelledby`, so `<main>` is a plain landmark and every `aria-controls` points at an element that exists. I added arrow, Home and End keys and a roving tabindex to the tab bar (not in the plan; it is what a tablist is expected to do). `Card` titles are `h2` (were `h3`, skipping a level), and so are the four profile section titles; the Tasks title is a hidden `h2` (the dashboard pages keep their own hidden `h1`). The dashboard brand link lost its `aria-label` (it did not match the visible text).
- T6.2: new `src/ui/dashboard/ShortcutsRow.tsx` (`shortcutRows`, `loadCommands`, `openShortcutsPage`, `ShortcutsList`, `ShortcutsRow`), shown in a new Shortcuts card in settings. It lists each command from `chrome.commands.getAll()` with its key, or `Not set` plus `Not set. Another app or Chrome itself may be using this key.`, and a **Change in Chrome** button that opens `chrome://extensions/shortcuts`. If the browser returns nothing the card says so and still offers the button. `chrome.ts` is untouched. Not seen with the real extension loaded.
- T6.3: the global `*:focus-visible` ring (2 px accent, 2 px offset) already existed; the only exception was text fields, which used offset 0 and hid the border, now the same ring. No rule removes an outline. The reduced-motion rule already stills every animation, transition and scroll (including pseudo-elements), and the gate sweep is inside `no-preference`; tests now pin both. For zoom: the panel had `min-width: 300px`, which makes a side panel at 200% zoom (about 200 CSS px) scroll sideways. Replaced by `min-width: 0`; segmented controls and the header now wrap. Checked in Chromium on static HTML with the real stylesheet: panel at 300, 200 and 160 px, dashboard settings at 300 and 640 px (200% of 1280), both themes: no horizontal scroll, no control past the right edge. Keyboard Tab shows the 2 px / 2 px accent ring (computed style read back).
- Test order: all new tests were seen red first (aria: missing export; shortcuts: missing module; focusMotion: 4 failed, then the added wrap and header cases each red before the CSS change).
- Not checked: the real side panel at real zoom; screen readers; `--a11y` smoke. Owner commands: `npm ci && npm test && npm run typecheck && npm run build`, then `xvfb-run -a node tools/e2e/smoke.cjs dist --a11y`.

Evidence:

| Date | Item | Changed files | Verification | Result |
|---|---|---|---|---|
| 2026-11-07 | T6.1 | src/ui/components/primitives.tsx; src/ui/panel/PanelPage.tsx; src/ui/panel/views/profile/*Section.tsx; TasksView.tsx; FocusScreen.tsx; RulesScreen.tsx; src/ui/dashboard/DashboardStats.tsx; DashboardPage.tsx; src/ui/styles.css; tests/ui/aria.test.tsx | RED: missing `PanelChrome` export. GREEN: aria 14 passed; primitives, panelRender, claims, foundation still pass | UNVERIFIED: no axe run |
| 2026-11-07 | T6.2 | src/ui/dashboard/ShortcutsRow.tsx (new); DashboardSettings.tsx; src/ui/styles.css (`.fg-kbd`); tests/ui/shortcuts.test.tsx | RED: module missing. GREEN: 9 passed | UNVERIFIED: needs the loaded extension |
| 2026-11-07 | T6.3 | src/ui/styles.css; tests/ui/focusMotion.test.ts; tests/ui/foundation.test.ts; tests/claims.test.ts | RED then GREEN: focusMotion 10 passed; foundation 3; claims 16. Screenshots overhaul/evidence/phase6/p6-{panel-300,panel-200,panel-160,dash-300,dash-640}-{dark,light}.png and p6-focus-400-dark.png; no horizontal overflow | UNVERIFIED: static HTML, not the built extension |
| 2026-11-07 | Phase 6 whole | all of the above, CHANGELOG.md | Stand-in run: 89 test files pass (577 tests; storage.test.ts excluded). `tsc` list identical to the untouched zip | UNVERIFIED |

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
| 2026-11-07 | tests/ui/panelRender.test.tsx, tests/shared/gating.test.ts | Added new cases only (lock explainer, empty state, lock wording). No existing assertion changed | T3.3, T3.4, T3.5 |
| 2026-11-07 | tests/background/worker.test.ts | Harness only: `tabs.create` with `createdTabs` and a `tabCreate.fails` switch; two new tests. No existing assertion changed | T3.5 |
| 2026-11-07 | tests/fixtures/v2-storage.expected.json | Added `"displayName": ""` and `"why": ""` to the expected v2 `settings` (migration now fills them). No existing value changed | T4.1 |
| 2026-11-07 | tests/ui/blockedReason.test.ts | The Phase 2 case that pinned the title `Focus session` now pins `Blocked by focus session` and the other new headlines (T5.6 replaces them) | T5.6 |
| 2026-11-07 | tests/ui/themeTokens.test.ts | Added contrast checks for `danger-contrast` and `warning-contrast`. No existing assertion changed | T5.2 |
| 2026-11-07 | tests/ui/foundation.test.ts, tests/claims.test.ts (C05) | Both pinned `.fg-panel { min-width: 300px }`. Now they pin `min-width: 0` (and, in foundation, that `300px` is gone from the rule). Test titled "300px floor" renamed | T6.3 (200% zoom of a side panel is under 300 CSS px; the floor forced a sideways scroll) |
| 2026-11-07 | tests/ui/focusMotion.test.ts, aria.test.tsx, shortcuts.test.tsx | New files only. No existing test changed | T6.1 to T6.3 |
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
- 2026-11-07: Phase 3 (T3.1 to T3.5) written and tested in the stand-in runner; stopped for the owner. Nothing pushed. Boxes stay unticked until the real gates are run.
- 2026-11-06: Phase 2 (T2.1 to T2.5) written and tested in the stand-in runner; stopped for the owner. Nothing pushed. Boxes stay unticked until the real gates are run.
- 2026-11-06: Phase 1 (T1.1 to T1.5) written and tested in a stand-in runner; stopped for the owner. Nothing pushed. Boxes stay unticked until the real gates are run.
- 2026-11-06: Owner decision D9: version is 1.0.1 for every phase. package.json, public/manifest.json, CHANGELOG.md heading, tests/release.test.ts, plan.md, README.md, AGENT_PROMPT.md and this tracker updated. Gates (npm test, typecheck, build) NOT re-run after this change: UNVERIFIED, the session has no node_modules and no network for npm install. Owner-run: npm ci (or npm install), then npm test, npm run typecheck, npm run build.
