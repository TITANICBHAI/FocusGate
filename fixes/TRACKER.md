# FocusGate Extension — Implementation Tracker

**Authoritative progress record for [`plan.md`](plan.md).** The plan is the implementation contract; it is not authorization to edit app code. Follow [`AGENT_PROMPT.md`](AGENT_PROMPT.md) before any work.

## Overall status

- **Status:** IN PROGRESS
- **Progress:** 34% (53/156 required checklist items currently verified)
- **Current work package:** WP5 — UI foundation and screen fixes
- **Last updated:** 2026-10-28
- **Run order:** WP0 → WP1 → WP2 module/unit work → WP3 staged engine → WP4 staged content → WP5 staged UI (current) → WP1b browser spikes (required before WP5 cutover/M1 green) → WP5 atomic v1→v2 cutover → WP6 → WP7 (Tier A, then Tier B) → WP8 → WP9 → WP10
- **Reconciliation:** The owner clarified that the 0/156 reset must not erase verified non-browser work. Checkmarks below reflect current source review and fresh local checks; WP1b remains genuinely incomplete, and browser/runtime/cutover gates remain open.

**Progress calculation:** The 156 required items are the WP0–WP10 task, unit-test, spike, and acceptance-criteria checkboxes. The C01–C40 claims regression and global Definition of Done are separate final gates and are not double-counted.

## Tracker rules

- Status values: `NOT STARTED`, `IN PROGRESS`, `BLOCKED — <reason>`, `DONE — evidence recorded`.
- At the start of each work package, change its status to `IN PROGRESS` and write a dated start note before doing its work.
- Update the relevant notes and progress after each meaningful change; do not wait until a work package is finished.
- As soon as a checklist item or individual verification step completes or fails, update its checkbox/status and record the exact command or reproduction and observed result here before starting the next item or check.
- Owner's standing validation instruction (2026-10-28): always run `npm test`, `npm run typecheck`, and `npm run build` after a coherent code-change batch, plus other applicable non-browser checks. Browser-driven checks are the only validation blocked by this environment; leave them explicitly unverified and continue the other checks.
- Tick an item only after it is complete and verified. An attempt, partial result, or unverified change stays unchecked.
- For each completed item, record changed files, the exact verification performed, and its observed result.
- Record decisions, failed checks, blockers, fixes and successful reruns, and deferred work. Do not erase failures; append what happened next.
- If a check fails, leave the affected item unchecked until the fix and successful rerun are documented.
- Reconcile this tracker against current code and observed verification before reporting completion. Leave unfinished items unchecked and explain why.
- Do not delete, revert, replace, or clean up files or work outside the currently owner-authorized work package/batch, including work from another agent or an earlier batch. Only remove items explicitly required by the active authorized scope and its plan gates; otherwise preserve them and ask the owner if they block progress.
- Stop and report at each phase boundary. Do not begin the next phase until the current phase's completion conditions and required checks pass.
- Calculate progress from verified checklist items only. Do not count blocked, attempted, or unverified work.

## Phase overview

| Work package | Status | Verified progress | Started | Completed | Blocked by |
|---|---|---:|---|---|---|
| WP0 — Repo hygiene and tooling | DONE — evidence recorded | 6/6 | 2026-10-27 | 2026-10-28 | — |
| WP1 — Foundation, build, storage, migration | DONE — evidence recorded | 16/16 | 2026-10-27 | 2026-10-28 | — |
| WP1b — De-risking spikes | BLOCKED — not verified; browser environment unavailable | 0/5 | 2026-10-28 | — | Before WP5 cutover/M1 green |
| WP2 — Session engine | IN PROGRESS | 4/14 | 2026-10-28 | — | Runtime AC after WP5 cutover |
| WP3 — Blocking engine | IN PROGRESS | 10/22 | 2026-10-28 | — | WP3.5 alias UI; WP3.10 active v1 fallback removal; browser AC/S1 |
| WP4 — Content script | IN PROGRESS | 6/15 | 2026-10-28 | — | Live selector/runtime acceptance and WP5 cutover |
| WP5 — UI foundation and screen fixes | IN PROGRESS | 11/18 | 2026-10-28 | — | Accessibility/copy pass, legacy v1 cleanup, browser acceptance and gated cutover |
| WP6 — Security, standalone, protection, backup | NOT STARTED | 0/17 | — | — | WP5 |
| WP7 — Feature ports, Tier A and Tier B | NOT STARTED | 0/20 | — | — | M1 green |
| WP8 — Stats, insights, reports | NOT STARTED | 0/8 | — | — | WP7 Tier A |
| WP9 — QA hardening | NOT STARTED | 0/6 | — | — | WP8 |
| WP10 — Release | NOT STARTED | 0/9 | — | — | WP9 |
| **Total** | **IN PROGRESS** | **53/156** | — | — | |

**Implementation gates:** WP1b is still incomplete (0/5); it does not block staged WP2/WP3/WP4 module work or WP5 UI work, but its browser spikes and runtime evidence remain required before WP5 cutover and M1 green. Keep v1 consumers active and do not activate migration or v2 runtime entrypoints before the atomic cutover. Do not start WP7 until M1 is green. Re-credited items have current source/test/build evidence; browser-dependent criteria remain unchecked.

## Milestones

| Milestone | Includes | Exit criteria | Status |
|---|---|---|---|
| M1 — Correct core | WP0–WP3, including WP1b | WP2/WP3 module and unit criteria plus browser spikes pass; the v1 runtime stays active and migration is not activated | NOT STARTED |
| M2 — Trustworthy UI | WP4–WP6 | WP4–WP6 acceptance criteria pass; WP5 switches all consumers together, migrates v1 data with backup, and passes the WP2–WP4 runtime checks | NOT STARTED |
| M3 — Features | WP7 Tier A and WP8 | Tier A and WP8 acceptance criteria pass | NOT STARTED |
| M4 — Release | WP9 and WP10 | Plan §8.2–§8.4 gates and upgrade test pass | NOT STARTED |

---

## WP0 — Repo hygiene and tooling

**Plan:** §6 WP0 · **Blocked by:** None · **Status:** DONE — evidence recorded · **Started:** 2026-10-27 · **Completed:** 2026-10-28 · **Progress:** 6/6

- [x] WP0.1 Set `package.json` name to `focusgate`, version to `1.1.0-dev`; remove `express`, `@types/express`, `dotenv`, and `tsx`; set `clean` to remove `dist` and `build`; add `typecheck` (`tsc --noEmit`), `test` (`vitest run`), and `build` (`node scripts/build-extension.mjs`).
- [x] WP0.2 Delete `patch_req.cjs`; ignore `node_modules`, `dist`, `build`, and `*.log`; untrack `dist/`.
- [x] WP0.3 Check the GitHub repository for files missing from the upload (plan §1.2), including LICENSE, store documentation, docs/privacy policy, store assets, and `.github/`; do not recreate them blindly.
- [x] WP0.4 Run `npm run typecheck` and record the baseline error list, including the expected legacy comparison/prop-type errors if present.
- [x] WP0.5 Add Vitest and an empty `tests/` folder with one smoke test; add `CHANGELOG.md`.
- [x] WP0.AC Run `npm ci && npm run typecheck && npm test`; verify `dist/` is untracked, `patch_req.cjs` is gone, and `package.json` has no server dependencies. Legacy type errors may remain until WP5 removes the old app.

**Notes / progress:**
- 2026-10-27 — Owner authorized WP0. Status set to IN PROGRESS before repo inspection. Re-evaluate each task from the current checkout; prior tracker claims are not credited.
- 2026-10-27 — The owner authorized continuation with WP1. Following `AGENT_PROMPT.md`, prior progress and pass claims are not credited; WP0 is being freshly verified in order before WP1 implementation begins.
- 2026-10-27 — WP0 acceptance re-verified in the current checkout: `npm ci` exited 0 (123 packages); `npm run typecheck` exited 0 with no diagnostics; `npm test` exited 0 (14 files, 61 tests); the hygiene assertions passed (`patch_req.cjs` absent, `dist/index.html` ignored, no tracked `dist/`, no server dependencies). WP0 is complete; the earlier failures remain in history.
- 2026-10-28 — Owner asked for the tracker to reflect completed non-browser work rather than preserve the erroneous global 0/156 reset. Fresh verification in the current checkout: package/hygiene/support-file assertions passed; `npm ci` exited 0; `npm run typecheck` exited 0; `npm test` passed 30 files / 163 tests; `npm run build` exited 0. WP0 is re-credited 6/6; no source or package-manifest changes were made. npm reported 4 dependency vulnerabilities (2 moderate, 2 high).

**Evidence:**

| Date | Item | Changed files | Verification | Result |
|---|---|---|---|---|
| 2026-10-27 | WP0.1 | None; target configuration was already present. | Inline Node assertions checked package name/version, exact scripts, absence of the four server dependencies, build-script existence, and package-lock root name/version. | PASS — all assertions passed. |
| 2026-10-27 | WP0.2 | None; target hygiene was already present. | Inspected `.gitignore`; looped over `patch_req.cjs` and generated paths; `git ls-files 'dist/**' 'dist'` returned no paths. | PASS — script absent; required ignores present; no tracked `dist/`. |
| 2026-10-27 | WP0.3 | None; all listed support/release files were present. | `git ls-files --error-unmatch` and `test -s` for LICENSE, STORE_LISTING.md, STORE_PUBLISHING.md, AFTER_PUBLISHING.md, docs/privacy-policy.html, and `.github/workflows/build-extension.yml`; `git ls-files 'store-assets/*'` found 12 files. | PASS — nothing from plan §1.2 is missing in this checkout, so no remote lookup or file recreation was needed. |
| 2026-10-27 | WP0.AC prerequisite | `node_modules/` installed from the existing lockfile; it is ignored by Git. | `npm ci` — completed successfully; 123 packages added. npm reported 4 dependency vulnerabilities (2 moderate, 2 high); no automatic audit fix was applied. | PASS — clean install completed; remaining AC checks are pending. |
| 2026-10-27 | WP0.AC fresh verification | `node_modules/` only (ignored). | `npm ci` — exit 0; `npm run typecheck` — exit 0; `npm test` — exit 0 (14 files / 61 tests); `test ! -e patch_req.cjs`, `git check-ignore -q dist/index.html`, `test -z "$(git ls-files -- dist)"`, and Node package assertions — exit 0. | PASS — all WP0 acceptance checks observed in the current checkout. |
| 2026-10-27 | WP0.4 | None. | `npm run typecheck` — exit 0; `tsc --noEmit` reported no diagnostics. | PASS — baseline typecheck is clean. |
| 2026-10-27 | WP0.5 | None; Vitest, tests, and changelog already existed. | Inspected `package.json`, `tests/manifest.smoke.test.js`, and `CHANGELOG.md`; `npm test` ran the manifest smoke test successfully. | PASS — the required tooling/smoke test/changelog are present; another existing session test fails, recorded below. |
| 2026-10-27 | WP0.AC test suite | None. | `npm test` — exit 1; 4 test files, 15 tests: 14 passed, 1 failed. `tests/shared/session.test.ts > session transitions > marks a phase interrupted when the lost-time gap exceeds half its duration`: expected session status `idle`, received `shortBreak` (`tests/shared/session.test.ts:73`). | FAIL — WP0.AC remains unchecked; do not change this out-of-scope session behavior in WP0. |
| 2026-10-28 | WP0 fresh re-verification | `node_modules/` only (ignored); no tracked source or manifest changes. | `npm ci` — exit 0, 125 packages; `npm run typecheck` — exit 0; `npm test` — exit 0, 30 files / 163 tests; `npm run build` — exit 0; Node assertions checked package metadata/scripts, dependencies, `.gitignore`, support/release files, smoke test, changelog, and untracked `dist/`. | PASS — WP0.1–WP0.5 and WP0.AC re-credited from current evidence. npm reported 4 audit vulnerabilities (2 moderate, 2 high); no audit fix was applied. |
| 2026-10-28 | Preview workflow recovery | No source changes; dependency restore used ignored `node_modules/`. | Restarted `FocusGate Extension Preview` and `FocusGate Docs Preview`; both Vite servers reported ready (ports 3000 and 5000). Browser console showed Vite connected; only the existing Tailwind CDN production warning appeared. | PASS — workflows are running. Startup/log verification only; no extension browser acceptance was performed. |
| 2026-10-27 | Focused session rerun | `src/shared/session.ts` and `fixes/plan.md` changed under the narrow owner-authorized exception. | `npm test -- tests/shared/session.test.ts` — exit 1; 4/5 tests passed. The interrupted-work assertion now passes; `continues missed auto-start cycles without exceeding the recovery bound` fails because it expected 10 transitions but recovery correctly stopped after 3 at the interrupted work phase. | FAIL — update that prior expectation to reflect the owner-approved stop-on-interruption behavior, then rerun. |
| 2026-10-27 | Focused session rerun | Updated `src/shared/session.ts`, `tests/shared/session.test.ts`, and the recovery contract in `fixes/plan.md`. | `npm test -- tests/shared/session.test.ts` — exit 0; 1 test file, 5 tests passed. | PASS — both interrupted-recovery and auto-start interruption expectations now pass; full-suite/typecheck reruns pending. |
| 2026-10-27 | WP0.AC typecheck rerun | `src/shared/session.ts`, `tests/shared/session.test.ts`, and `fixes/plan.md`. | `npm run typecheck` — exit 0; `tsc --noEmit` reported no diagnostics after the recovery change. | PASS — full-suite test rerun pending. |
| 2026-10-27 | WP0.AC final test suite | `src/shared/session.ts`, `tests/shared/session.test.ts`, and `fixes/plan.md`. | `npm test` — exit 0; 4 test files, 15 tests passed. | PASS — all WP0.AC checks and hygiene conditions are verified. |
| 2026-10-27 | Fresh WP0 dependency setup | `node_modules/` only (ignored). | `npm ci` — exit 0; 123 packages added; audit reported 4 vulnerabilities (2 moderate, 2 high). | PASS — dependencies restored from the committed lockfile; no automatic audit fix applied. |
| 2026-10-27 | Fresh WP0.1 verification | None. | Node assertions checked package name/version, required scripts, removal of the four server dependencies, build-script presence, and package-lock name/version. | PASS — all assertions passed. |
| 2026-10-27 | Fresh WP0.2 verification | None. | Node assertions verified `.gitignore` contains `node_modules/`, `dist/`, `build/`, `*.log`; `patch_req.cjs` is absent; `git ls-files -- dist` returned no paths. | PASS — current hygiene state matches the package requirement. |
| 2026-10-27 | Fresh WP0.3 verification | None. | `test -s` checks for LICENSE, store documents, privacy policy and build workflow; `git ls-files 'store-assets/*'` counted 12 tracked assets. | PASS — required files exist; no remote lookup or recreation needed. |
| 2026-10-27 | Fresh WP0.4 verification | None. | `npm run typecheck` — exit 0; `tsc --noEmit` reported no diagnostics. | PASS — strict TypeScript baseline is clean. |
| 2026-10-27 | Fresh WP0.5 verification | None. | Node assertions checked Vitest in devDependencies, `vitest run`, a manifest smoke test with a test case, the tests directory, and non-empty CHANGELOG. | PASS — required test tooling and changelog are present. |
| 2026-10-27 | Fresh WP0.AC test suite | None. | `npm test` — exit 1; 14 files, 61 tests: 57 passed, 4 failed (`allowance.test.ts` visit counting, `dnr.test.ts` non-ASCII/rule-limit classification, `migrate.test.ts` health default snapshot, `stats.test.ts` current streak). | FAIL — WP0.AC remains unchecked; failures require triage before acceptance. |

**Failures / blockers:**
- 2026-10-27 — Earlier WP0 test failures and the missing-dependency startup errors are resolved for the current checkout by lockfile install; fresh `npm test` passed 61/61 and `npm run typecheck` passed. The old failure entries remain as history.
- 2026-10-27 — Fresh `npm ci` reported 4 dependency vulnerabilities (2 moderate, 2 high). No audit fix was applied because dependency changes are outside the current WP1 scope.
- 2026-10-27 — Fresh WP0.2 verification command (`test ! -e patch_req.cjs; git check-ignore -q node_modules dist build sample.log; git ls-files -- dist`) exited 1 before printing a result. The failed path is not yet identified; WP0.2 remains unchecked pending inspection.
- 2026-10-27 — WP0.2 diagnostic: `patch_req.cjs` is absent, `node_modules/` and `*.log` are ignored, `dist/` and `build/` are not ignored, and `git ls-files -- dist` is empty. The missing ignore rules need to be resolved before this item can pass.
- 2026-10-27 — Correction after inspecting `.gitignore` and running `git check-ignore -v --no-index dist build node_modules sample.log`: rules for `dist/`, `build/`, `node_modules/`, and `*.log` are present. The earlier check misread ignored-path status because `dist/` is absent and tracked `build/` paths are not reported as ignored by default; `git ls-files -- dist` is empty. No `.gitignore` edit is needed.
- 2026-10-27 — Fresh `npm test` failed with four tests: allowance visit opens expected 2/received 1 (`tests/shared/allowance.test.ts:67`); DNR expected non-ASCII skipped as `non-ascii` but got `rule-limit` (`tests/shared/dnr.test.ts:75`); migration snapshot differed because `health.skipped` was present (`tests/shared/migrate.test.ts:16`); current streak expected 3/received 0 (`tests/shared/stats.test.ts:50`). Exact command: `npm test`; 57/61 passed. Do not mark WP0.AC complete until these are resolved and rerun.
- 2026-10-27 — The four failing test/snapshot assumptions were corrected without changing runtime behavior. Results remain unverified until tests are rerun.
- 2026-10-27 — `npm test` fails in the existing shared-session test described above. This blocks the WP0 acceptance criterion; fixing it belongs to the relevant session work package, not WP0.
- 2026-10-27 — Read-only investigation found `recoverSession()` records the overdue work phase as `interrupted`, then `advanceSession()` still starts a configured break. At 11 minutes into recovery, the 10-minute work phase has ended but the five-minute break has not; the test expects `idle`, while code returns `shortBreak`. Owner directed “do the best practice”; treat an interrupted work phase as ending the session immediately. This is a narrow exception to the WP0-only scope; no other session work is authorized.
- 2026-10-27 — The focused rerun now passes the interrupted-work regression but fails the former auto-start catch-up expectation (10 expected, 3 observed). That test must reflect the interruption stop rule; no other cycle/recovery changes are authorized.
- 2026-10-27 — Updated the auto-start recovery test to expect an interrupted work phase to end idle. The test edit is not verified until the focused rerun passes.
- 2026-10-27 — Focused session tests now pass 5/5. The original and intermediate failures are retained above; final full-suite verification is pending at this point in history.
- 2026-10-27 — Post-fix `npm run typecheck` passed with no diagnostics. Full `npm test` was the remaining WP0 acceptance gate at this point in history.
- 2026-10-27 — Resolved the original session test failure with the owner-authorized immediate-idle recovery rule. Final `npm test` passed all 15 tests across four files; WP0 has no remaining blocker.

**Decisions / deferred work:** None recorded.

---

## WP1 — Foundation: shared core, build, storage, migration

**Plan:** §5.1–§5.2, §6 WP1, §8.1 · **Blocked by:** — · **Status:** DONE — evidence recorded · **Started:** 2026-10-27 · **Completed:** 2026-10-28 · **Progress:** 16/16

### Tasks

- [x] WP1.1 Create the shared types, defaults, time/domain/keyword/allowance/DNR/plan/gating/password/stats modules, presets, and helpers listed in plan §5.1; set `strict: true` for new code (legacy exclusions only until WP5).
- [x] WP1.2 Convert the public background/content entries to bridge shells; implement `scripts/build-extension.mjs` and safe base manifest fields while keeping the current popup and v1 behavior active through WP5.
- [x] WP1.3 Implement `shared/storage.ts`: one-read typed `getState()` with defaults, `patch(partial)`, `update(key, fn)`, and `onStateChanged(cb)`.
- [x] WP1.4 Implement and test `shared/migrate.ts` and `ready()`; do not activate migration from runtime entrypoints until WP5's atomic consumer cutover.
- [x] WP1.5 Keep old `public/background.js` / `public/content.js` active through WP4; remove them only in WP5 after all v1 consumers are replaced.

### Required unit-test coverage

- [x] WP1.T1 `time.ts`: normal/overnight windows, `24:00`, start=end, end-exclusive behavior, previous-day rule, week-boundary scheduling, local-date keys, DST dates.
- [x] WP1.T2 `domains.ts`: valid/invalid inputs, aliases, subdomains/look-alikes, and exception boundaries including `&`, `?`, and `#`.
- [x] WP1.T3 `keywords.ts`: comma/newline split, hashtags, whole-word/substring, host-specific params, and `p` ignored outside Yahoo.
- [x] WP1.T4 `plan.ts`: precedence/reasons, break phase, standalone start, schedule boundaries, allowance cap/exemption, exceptions, always-blocked, global allow-only disabled/empty/non-empty cases.
- [x] WP1.T5 `allowance.ts`: three modes, midnight rollover, interval expiry, capped attention delta, and visit-gap behavior.
- [x] WP1.T6 `dnr.ts`: redirect rule and stable IDs, ASCII guard, regex substitution/escaping, allow-only, rule limits.
- [x] WP1.T7 `migrate.ts`: v1 fixture to v2 snapshot, including active session, overnight schedule, numeric allowance, legacy password, seconds-to-ms history.
- [x] WP1.T8 `password.ts`: PBKDF2 round trip; legacy verification/upgrade; generator length/alphabet/source.
- [x] WP1.T9 `gating.ts`: every action/state combination in Appendix E.4, with password set and unset.
- [x] WP1.T10 `stats.ts`: streak, focus score, insights, weekly totals, and hour/minute formatting.
- [x] WP1.AC `npm run build` produces the staged `dist/` with current UI and v1 bridge behavior; `npm test` is green; migration fixture passes; `ready()` is idempotent across 10 concurrent calls. Cross-browser install and upgrade validation is deferred to WP9 after WP5.

**Notes / progress:**
- 2026-10-27 — Historical note: an earlier reset temporarily cleared prior WP1 progress. Superseded by the 2026-10-28 fresh re-credit at 16/16 below.
- 2026-10-27 — Owner explicitly authorized continuation of WP1. Before implementation, the fresh WP0 test gate exposed four failures in WP1 shared-core modules; WP1 is active to repair these scoped failures, then WP0 acceptance will be rerun. No earlier WP1 checklist evidence is credited.
- 2026-10-27 — Owner authorized continuing WP1 from the current checkout. Reconcile the existing partial implementation and fresh verification against plan §5.1–§5.2 and §8.1; remain within WP1 and stop at its acceptance boundary.
- 2026-10-27 — Fresh `npm ci`, `npm run typecheck`, `npm test`, and `npm run build` completed successfully; WP0 acceptance was verified. Source inspection found that the still-active `src/App.tsx` and `public/background.js` use v1 keys, while `ready()` migration removes/reshapes those keys. Activating migration from `onInstalled` now would break the existing UI/worker before their planned replacement. No app-code edits made; awaiting the owner's choice of migration timing or a compatibility bridge.
- 2026-10-28 — Owner chose the best-practice transition: preserve the active v1 UI/worker/content behavior and defer live migration activation until all v1 consumers are cut over. Do not call `ready()` from `onInstalled` or entrypoints during this transition. Keep migration logic and fixture tests; avoid manifest paths for popup/blocked/dashboard pages until those pages exist. Continuing safe WP1 coverage; final migration activation remains a sequencing blocker.
- 2026-10-28 — Added focused regression cases for DST fall-back, exception hash fragments, and a future-start standalone block. Corrected the test timestamps after the first run exposed an incorrect ISO offset; all focused cases now pass.
- 2026-10-28 — Historical interim status, superseded by the 16/16 re-credit below: this note marked WP1.T4, WP1.2, and WP1.4 open before the later full-suite/build re-verification. Task-scoped allow-only remains a separate WP7 B4 item.
- 2026-10-28 — Added `src/content/sites.ts` as the host-pattern table and changed the manifest smoke test to compare `manifest.json` against it. This keeps the current host list unchanged; focused manifest verification passed. Multi-page UI paths and migration activation remain deferred.
- 2026-10-28 — Owner chose “reorder cutover before migration.” Updated `fixes/plan.md` so WP2–WP4 stage v2 modules while v1 consumers remain active, WP5 performs the atomic all-consumer cutover and only then activates migration, and WP9 owns cross-browser install/upgrade checks. Added global allow-only disabled/empty assertions for WP1.T4; final verification is pending.
- 2026-10-28 — WP1.T4 passed after narrowing the base-engine requirement to global allow-only behavior; task-scoped overrides remain assigned to WP7 B4. `npx vitest run tests/shared/plan.test.ts` — exit 0, 1 file / 7 tests passed.
- 2026-10-28 — WP1.2 passed: the manifest smoke test passed (1 file / 2 tests); `npm run build` completed, and an output check parsed `dist/manifest.json`, confirmed the active popup remains `index.html`, and verified the referenced background/content bundles exist. Full acceptance and migration-readiness test review remain pending.
- 2026-10-28 — WP1.4 and WP1.AC passed. `tests/shared/storage.test.ts` confirms ten concurrent `ready()` calls share one migration promise; `npm test` passed 14 files / 63 tests, including migration fixture coverage; `npm run typecheck` and `npm run build` passed, and the output smoke check verified the staged v1 popup/worker/content paths. WP1 is complete; browser install/upgrade validation is retained for WP9 after WP5.
- 2026-10-28 — Kept the WP5 cutover gate inside its existing final task and acceptance criterion; checklist totals remain 18 items for WP5 and 156 overall.
- 2026-10-28 — Re-ran the complete test suite, typecheck, and build after adding the host table; all checks passed. The modified set is limited to the tracker, manifest smoke test, shared test cases, and the new content host table.
- 2026-10-27 — Corrected three failing test assumptions against the plan: allowance visit gap is measured from the most recent attention sample; DNR's 200-entry cap applies before evaluating entries beyond that cap; a current streak ends after a missed local day. Updated the migration expected snapshot to include the default empty `health.skipped`. Runtime modules were unchanged; focused verification is pending.
- 2026-10-27 — Added missing shared algorithm modules and their initial tests; extended keyword types/migration for v2 rules; updated the manifest to the current supported content hosts and added the `idle` permission/minimum Chrome version. Do not count these tasks complete until the full relevant checks pass.

**Evidence:**

| Date | Item | Changed files | Verification | Result |
|---|---|---|---|---|
| 2026-10-28 | WP1 manifest host table | `src/content/sites.ts`, `tests/manifest.smoke.test.js`, `fixes/TRACKER.md`. | `npx vitest run tests/manifest.smoke.test.js` — exit 0; 1 file / 2 tests passed. | PASS — manifest content-script host patterns exactly match the source table. |
| 2026-10-28 | WP1 re-credit after owner correction | No source changes; generated `dist/` remains ignored. | `npm run typecheck` — exit 0; `npm test` — exit 0, 30 files / 163 tests; `npm run build` — exit 0; Node output assertions confirmed the v1 manifest routes, v1 bridge bundles, staged `content-v2.js`, and four staged UI pages. | PASS — shared modules, migration fixture/readiness tests, and staged build are verified. Runtime migration activation remains deferred to the WP5 cutover. |
| 2026-10-28 | WP1.T4 | `tests/shared/plan.test.ts`, `fixes/TRACKER.md`. | `npx vitest run tests/shared/plan.test.ts` — exit 0; 1 file / 7 tests passed. | PASS — plan precedence, boundary, allowance, exception, and global allow-only cases pass; WP7 B4 retains task-scoped overrides. |
| 2026-10-28 | WP1.2 staged build | `fixes/plan.md`, `fixes/TRACKER.md`, `src/background/index.ts`, `src/content/index.ts`. | `npx vitest run tests/manifest.smoke.test.js` — exit 0 (1 file / 2 tests); `npm run build` — exit 0; Node output smoke test parsed `dist/manifest.json`, confirmed popup `index.html`, and checked referenced worker/content files. | PASS — staged manifest routes point to generated current UI and v1 bridge bundles. |
| 2026-10-28 | WP1 final suite/typecheck/build | `fixes/plan.md`, `fixes/TRACKER.md`, `src/background/index.ts`, `src/content/index.ts`, `tests/shared/plan.test.ts`. | `npm test` — exit 0 (14 files / 63 tests); `npm run typecheck` — exit 0; `npm run build` — exit 0; Node output smoke test verified the staged popup and referenced bundle files. | PASS — full current source validation is green; migration fixture/idempotency review remains to finish WP1. |
| 2026-10-28 | WP1.4 migration readiness and WP1.AC | `fixes/plan.md`, `fixes/TRACKER.md`. | `rg -n -C 4 'Promise\\.all|ready\\(' tests` confirmed the ten-concurrent-call readiness test; `npm test` passed 14 files / 63 tests, including `migrate.test.ts` fixture coverage and `storage.test.ts` idempotency. | PASS — migration logic and shared-promise behavior are tested; activation remains deferred to the WP5 cutover. |
| 2026-10-28 | WP1 final checks after host-table update | `src/content/sites.ts`, `tests/manifest.smoke.test.js`, `tests/shared/time.test.ts`, `tests/shared/domains.test.ts`, `tests/shared/plan.test.ts`, `fixes/TRACKER.md`. | `npm test` — exit 0; 14 files / 63 tests passed. `npm run typecheck` — exit 0. `npm run build` — exit 0; Vite emitted `dist/index.html` and assets, then extension bundling completed. | PASS — current source/tests verify; browser installation and migration runtime remain unverified. |
| 2026-10-28 | WP1 full test suite after edge-case additions | `tests/shared/time.test.ts`, `tests/shared/domains.test.ts`, `tests/shared/plan.test.ts`, `fixes/TRACKER.md`. | `npm test` — exit 0; 14 files / 63 tests passed. | PASS — verified WP1.T1–T3 and WP1.T5–T10; WP1.T4 remains incomplete for task-scoped allow-only semantics. |
| 2026-10-28 | WP1 final typecheck and build | No tracked runtime changes; `dist/` is ignored build output. | `npm run typecheck` — exit 0, no diagnostics. `npm run build` — exit 0; Vite built `dist/index.html` and assets, and the extension bundle step completed. | PASS — source still typechecks and the existing extension build completes; browser installation/UI acceptance remains unverified. |
| 2026-10-28 | WP1 supplemental edge-case coverage | `tests/shared/time.test.ts`, `tests/shared/domains.test.ts`, `tests/shared/plan.test.ts`, `fixes/TRACKER.md`. | `npx vitest run tests/shared/time.test.ts tests/shared/domains.test.ts tests/shared/plan.test.ts` — exit 1; 2/3 files passed, 18/19 tests passed. | FAIL — the new fall-back test reports the first repeated-hour interval as inactive; exception-fragment and future-start standalone tests pass. |
| 2026-10-28 | WP1 supplemental edge-case rerun | `tests/shared/time.test.ts`, `fixes/TRACKER.md`. | `npx vitest run tests/shared/time.test.ts tests/shared/domains.test.ts tests/shared/plan.test.ts` — exit 0; 3 files and 19 tests passed. | PASS — DST spring/fall, exception fragment, and future-start standalone cases pass. The earlier failure was a test-offset error and is retained in the failure history. |
| 2026-10-27 | WP1 migration compatibility review | `fixes/TRACKER.md` only. | `rg -n 'timer_isActive|timer_timeLeft|blockedKeywords|standaloneMode|dailyAllowances|onInstalled' public/background.js src/App.tsx src/hooks/useChromeStorage.ts`; inspected `LEGACY_KEYS_TO_REMOVE`, migration mapping, and `src/background/index.ts`. | BLOCKED — current UI/worker still consume old keys that migration removes or transforms. Owner decision required before adding the `onInstalled` migration activation. |
| 2026-10-27 | WP1 fresh-check baseline | None. | `npm test`, `npm run typecheck`, and `npm run build` — each failed before executing project code because `node_modules` is absent (`vitest: command not found`, `tsc: command not found`, and `ERR_MODULE_NOT_FOUND: esbuild`). | BLOCKED — restore dependencies from the existing lockfile, then rerun the checks. |
| 2026-10-27 | WP1 dependency restore | `node_modules/` only (ignored). | `npm ci` — exit 0; 123 packages added from the existing lockfile. | PASS — package manifests unchanged; npm reported 4 vulnerabilities (2 moderate, 2 high), with no automatic audit fix applied. |
| 2026-10-27 | WP1 current shared-core/build checks | No implementation files changed. | `npm test` — exit 0, 14 files / 61 tests passed; `npm run typecheck` — exit 0, no diagnostics; `npm run build` — exit 0, Vite built `dist/index.html` and assets, then the build script completed. | PASS for these commands only; WP1 browser-install and migration-runtime acceptance remain unverified. |
| 2026-10-27 | WP1 environment setup | `node_modules/` only (ignored). | `npm ci` — exit 0; 123 packages added. | PASS — restored packages from the committed lockfile; npm reported 4 dependency vulnerabilities (2 moderate, 2 high); no audit fix applied. |
| 2026-10-27 | WP1 dependency baseline | None. | `npm ls --depth=0` — exit 0; all 16 declared top-level packages resolved. `git status --short -- package.json package-lock.json` returned no paths. | PASS — lockfile and package declarations unchanged. |
| 2026-10-27 | WP1 typecheck baseline | None. | `npm run typecheck` — exit 0; `tsc --noEmit` reported no diagnostics. | PASS — current shared core compiles before WP1 additions. |
| 2026-10-27 | WP1 test baseline | None. | `npm test` — exit 0; 4 test files, 15 tests passed. | PASS — baseline suite is green. |
| 2026-10-27 | Shared-module compile checkpoint | `src/shared/types.ts`, `defaults.ts`, `time.ts`, `domains.ts`, `keywords.ts`, `allowance.ts`, `plan.ts`, `dnr.ts`, `gating.ts`, `password.ts`, `presets.ts`, `stats.ts`. | `npm run typecheck` — exit 0 after fixing the recorded TS2322 tuple/result mismatch in `plan.ts`. | PASS — all current shared modules compile; unit coverage and full acceptance checks remain pending. |

**Failures / blockers:**
- 2026-10-28 — The first fall-back test run reported `false` because its `2026-11-01T05:45:00-04:00` input represented 09:45Z / 04:45 EST, outside the schedule; the source behavior was not shown to be defective. Corrected both test timestamps to UTC `Z` values; the focused rerun passed all 19 tests.
- 2026-10-28 — Owner decision resolved the migration approach: defer live `onInstalled`/lazy activation until all v1 consumers are cut over. WP1 can continue on safe foundation work, but its literal activation acceptance cannot be met without changing the work-package sequence or adding a compatibility bridge. The plan's `popup.html`, `blocked.html`, and `dashboard.html` manifest targets also do not exist yet; retain the working existing popup until their UI phase.
- 2026-10-28 — WP1.T4 remains incomplete: the current state model exposes only a global `settings.allowOnly.enabled/domains` value, while Appendix A.3 requires task-scoped `null` / `[]` / list behavior. The plan assigns that task-level feature to WP7 B4; do not back-port it into WP1 solely to satisfy the future behavior row.
- 2026-10-28 — Resolved the earlier WP1.T4 ambiguity: base `plan.ts` covers global allow-only disabled, empty, and non-empty cases; task-scoped `null` / `[]` / list overrides remain in WP7 B4. Focused verification now passes.
- 2026-10-28 — Resolved the earlier migration-sequencing blocker: the owner chose to reorder cutover before migration, so WP5 now activates migration only after the UI, worker, and content consumers switch together. Historical blocker notes remain above.
- 2026-10-28 — The final WP5 checklist-count script exited 1 because it omitted the `fixes/plan.md` input file and therefore counted 0/0. This is a checker-command error, not a plan failure; rerunning with the explicit file path.
- 2026-10-28 — Rerun passed: `git diff --check` was clean and the count script with `fixes/plan.md` as input found 13 WP5 tasks + 5 acceptance criteria = 18; the 156-item project total is unchanged.
- 2026-10-27 — Plan §6 WP1 requires migration from `runtime.onInstalled`, but the current popup and background still read/write legacy v1 keys. `migrateV1()` removes or transforms keys including `blockedKeywords`, timer keys, `standaloneMode`, and `dailyAllowances`; schedules also change shape. Starting migration now would break the existing UI/worker, contrary to the WP1 acceptance requirement that the existing UI keeps working. Await the owner's choice: defer live activation until v1 consumers switch to v2, or implement a compatibility bridge (broader scope). No app behavior changed.
- 2026-10-27 — `npm ci` reported four dependency vulnerabilities (2 moderate, 2 high). No automatic audit fix was applied; dependency upgrades are outside WP1 unless a required check identifies a relevant blocker.
- 2026-10-27 — Current-checkout `npm test`, `npm run typecheck`, and `npm run build` could not start because the ignored `node_modules/` directory is absent. Exact outputs: `vitest: command not found`; `tsc: command not found`; `ERR_MODULE_NOT_FOUND` for `esbuild`. Restore only from the committed lockfile; do not change dependency declarations.
- 2026-10-27 — After `npm ci`, the same checks passed (14 test files / 61 tests; no TypeScript diagnostics; build exit 0). The initial missing-dependency failure is retained above; extension install behavior is not established by these commands.
- 2026-10-27 — Baseline dependency check `npm ls --depth=0` exited 1 because all declared packages are missing from `node_modules/`. Restore dependencies from the existing lockfile before project checks; no package declarations should change.
- 2026-10-27 — Replit-managed package installation for the already-declared Node dependencies failed with npm internal error `Cannot read properties of null (reading 'edgesOut')`; the package-manager output was exit 16. Retry with a lockfile-preserving install; verify `package.json` and `package-lock.json` remain unchanged.
- 2026-10-27 — `npm ci` succeeded and restored the dependencies. The two earlier failures are retained as history; confirm package manifests are unchanged before continuing.
- 2026-10-27 — First post-module `npm run typecheck` failed with one TS2322 in `src/shared/plan.ts`: `aliasAllowance` returned an entry tuple instead of the declared `{ key, value }` shape. Fix the return mapping, then rerun typecheck.
- 2026-10-27 — Corrected the `aliasAllowance` result mapping; `npm run typecheck` then exited 0 with no diagnostics.

**Decisions / deferred work:** None recorded.

---

## WP1b — De-risking spikes

**Plan:** §6 WP1b · **Blocked by:** Browser test environment unavailable · **Status:** BLOCKED — not verified · **Started:** 2026-10-28 · **Completed:** — · **Progress:** 0/5

- [ ] WP1b.S1 Test DNR URL preservation through typed URL, link, `window.open`, and redirect-chain paths; include `&`/`?`/`#`, test with/without web-accessible resources in Chrome, Edge, Firefox; choose among plan designs A/B/C.
- [ ] WP1b.S2 Sample attention using focused window, active tab, `idle.queryState(60)`, and `tab.audible` at five-second intervals; test switching/minimizing/locking/video/second monitor. Never credit unfocused/minimized time; do credit audible time.
- [ ] WP1b.S3 Check `alarms.getAll()` before/after worker stop and browser restart; verify alarm recreation/reset behavior, minimum period, `ensureAlarms()` idempotency, and firing with popup closed.
- [ ] WP1b.S4 Verify Firefox MV3 `background.scripts`/module behavior, DNR regex substitution, host-permission opt-in, `idle`, buttonless notifications, and `storage.session`.
- [ ] WP1b.AC Add `docs/spikes.md` with browser versions, pass/fail outcomes, chosen redirect design, and any plan assumptions changed.

**Notes / progress:**
- 2026-10-28 — Owner authorized WP1b. Initial environment discovery found `/repl/tools/bin/chromium`; no Edge, Firefox, Playwright, or Puppeteer executable/dependency was found. Inspect existing spike records and Chromium launch options before any browser claim.
- 2026-10-28 — Existing `docs/spikes.md` records prior harness failures and no browser API conclusions. A plain control run, `timeout 12s chromium --headless --no-sandbox --disable-gpu --disable-dev-shm-usage --user-data-dir=/tmp/focusgate-wp1b-headless-baseline --dump-dom 'data:text/html,<title>wp1b-baseline</title><p>PAGE_OUTPUT_OK</p>'`, exited 0 and emitted `PAGE_OUTPUT_OK` despite D-Bus warnings. This confirms only generic headless page output, not extension behavior.
- 2026-10-28 — Updated `docs/spikes.md` with this environment recheck. S1–S4 remain blocked: no extension behavior was tested, and no pass/fail browser API conclusion is claimed. A controllable Chrome/Edge/Firefox test environment is required before these gates can continue.
- 2026-10-28 — Owner directed that WP1b be done later and not block further work. WP1b remains incomplete at 0/5 and is a gate before WP5 cutover/M1 green, but WP2/WP3 module and unit work may proceed under the plan's conservative fallbacks.

**Evidence:** `docs/spikes.md` records prior harness outcomes and the 2026-10-28 environment recheck. Generic Chromium page output is verified; no spike behavior is verified.

**Failures / blockers:**
- No controllable Chrome/Edge/Firefox extension environment is available in this workspace. The generic Chromium control page does not satisfy any S1–S4 behavior criterion.
- 2026-10-28 — `git diff --check` exited 2 because the two new date lines in `docs/spikes.md` had trailing spaces. Remove those new spaces and rerun; this is a formatting issue, not a browser behavior result.
- 2026-10-28 — Resolved: removed the new trailing spaces; reran `git diff --check`, which exited 0 with no output.

**Decisions / deferred work:** None recorded.

---

## WP2 — Session engine owned by the background

**Plan:** §5.3–§5.4, §6 WP2, §8 · **Blocked by:** — · **Status:** IN PROGRESS · **Started:** 2026-10-28 · **Completed:** — · **Progress:** 4/14

### Tasks

- [x] WP2.1 Implement `isBlockingActive` and session helpers; `background/session.ts`, `alarms.ts` (`ensureAlarms`), `notify.ts` (badge/notifications), and `messages.ts` handlers for `session/*`.
- [x] WP2.2 Prepare the staged v2 timer view: read session and render `max(0, endsAt - now)` with a one-second local-state interval; message start/stop/extend. Keep the active v1 popup unchanged until WP5.
- [x] WP2.3 Write `sessionHistory` and `dayStats` at phase end using `SessionRecord`/`DayStats`; cap history at 500; never write history at session start.
- [x] WP2.4 Prepare the v2 keyboard command handler: idle starts the default duration with lock `none` and notification; running/unlocked stops; locked reports locked and does nothing. Keep the active v1 handler until WP5.

### Acceptance criteria

- [ ] WP2.AC1 With popup closed, a two-minute session notifies at 2:00, badge changes to break, sites unblock during break, and session becomes idle after break; history records one `completed` session with elapsed time near 120,000 ms.
- [ ] WP2.AC2 Stop the service worker mid-session from `chrome://extensions`; remaining time is correct on wake and session ends on time.
- [ ] WP2.AC3 Close/reopen browser after a session ends; session finalizes under the gap rule, nothing stays stuck, and badge clears.
- [ ] WP2.AC4 Commitment has no stop button; `session/stop` returns `LOCKED`; locked shortcut does nothing; session ends automatically.
- [ ] WP2.AC5 Strict rejects wrong passwords in the background; shortcut cannot stop it; without a password, require `I GIVE UP`.
- [ ] WP2.AC6 Extend by 15 minutes at every lock level; ring, badge, and alarm update.
- [ ] WP2.AC7 Open/close popup 20 times mid-session, with and without linked task; session never changes.
- [ ] WP2.AC8 Two popups/tabs cause no double decrement; worker-console measurement shows no more than one storage write per minute during a session.
- [ ] WP2.AC9 `autoStartNext` alternates two work/break cycles correctly, including long break on the configured cycle.
- [ ] WP2.AC10 Stats › Session History shows UI-started sessions; claims C06–C11 pass.

**Notes / progress:**
- 2026-10-28 — Re-credited WP2.1–WP2.4 from the current staged source and fresh full-suite/typecheck/build checks. These are module/staging items only; WP2.AC1–WP2.AC10 remain open for post-cutover browser/runtime verification.
- 2026-10-28 — WP2.1–WP2.4 module/staging work is verified (4/14). Session, alarm, message, notification/badge, recovery, and transition-failure behavior have unit coverage; staged timer compiles; build routing confirms the v1 worker and popup remain active. WP2 remains IN PROGRESS because all ten browser/runtime acceptance criteria must run after WP5 cutover.
- 2026-10-28 — Owner authorized continuation of WP2 with the attached work-package checklist. Re-inspected current source: the v2 session service, alarm/notification helpers, message handlers, shared session logic, and staged timer exist; the active background entry still imports the v1 worker as required. WP2 remains 0/14 until fresh checks pass.
- 2026-10-28 — Started WP2 after the owner's instruction to defer WP1b without blocking further work. Keep v1 popup/worker active until WP5; build v2 modules and unit tests only. Use focused/active attention with background-audio credit off, and idempotently re-arm alarms; runtime/browser acceptance remains deferred.
- 2026-10-28 — Owner explicitly authorized WP2 and asked the agent to choose best-practice defaults without clarification questions, documenting decisions. Keep all v2 listeners and UI staged until WP5; use background-enforced password verification or the no-password phrase plus 15-second wait for Strict stops, and persist a clock-skew flag when recovery extends a phase after a backward clock jump. State transitions will be serialized and phase-end state written atomically; external notification/badge failures must not roll back session state.
- 2026-10-28 — First implementation slice added shared clock-skew recovery state, dormant v2 alarm/notification/session/command modules, and behavior tests. No WP2 checklist item is marked complete yet; source and tests remain unverified. The live v1 entrypoint and popup have not been changed.
- 2026-10-28 — Restored the existing lockfile dependencies with `npm ci` — exit 0; 123 packages added. npm reported 4 vulnerabilities (2 moderate, 2 high); no audit fix was applied. Re-run the targeted typecheck and tests before proceeding.
- 2026-10-28 — Adjusted the clock-skew test to exceed the specified 60-second threshold and changed recovery notification dispatch to include break-end state transitions even when they produce no session record. The earlier failure remains recorded; the focused rerun is pending.
- 2026-10-28 — Added a staged React timer view and v2-only storage hook, included them in strict typechecking, and kept both unmounted from the active v1 popup. This staged UI supports timestamp-rendered time, start/extend/skip/stop messages, Strict password/phrase handling, and inline confirmation; it is not yet verified.
- 2026-10-28 — Added isolated Tailwind component styles for the staged timer and synced its duration field after settings hydration. The active `App` still does not import or render the staged view; verification is pending.
- 2026-10-28 — Added the missing `@types/react` development dependency through the workspace package manager so the staged TSX can remain in strict typechecking; the next typecheck is pending.
- 2026-10-28 — Restored dependencies with `npm ci` — exit 0; 125 packages installed; npm reported 4 vulnerabilities (2 moderate, 2 high). No audit fix was applied.
- 2026-10-28 — Re-ran `npm test -- tests/background/session.test.ts tests/background/alarms.test.ts tests/background/messages.test.ts` — exit 1; session and alarm tests passed (16 tests), while all 3 message tests failed. Failures expose test/handler contract mismatches: start forwards the discriminator, malformed payloads are reported as unknown, and the command test expects a callback that Chrome's command event does not provide. Correct the handler contract/tests, then rerun.
- 2026-10-28 — Corrected the staged message contract to distinguish invalid from unknown message types and pass only session fields to `start`/`stop`; expanded handler tests to cover stop/skipBreak and the actual command return contract. Verification is pending.
- 2026-10-28 — Added deterministic notification/badge adapter tests and service tests for overdue-session recovery and state persistence when alarm, badge, reconcile, and notification APIs fail. The new tests are pending execution.
- 2026-10-28 — `npm run typecheck` now exits 0 with the staged TSX included after adding `@types/react`. The prior missing-typings failure is resolved; message-handler coverage and the final full verification remain pending.
- 2026-10-28 — Added focused tests for valid/invalid v2 messages and the staged shortcut callback. Listener registration remains intentionally absent from the active background entrypoint; run the full unit suite and confirm build outputs before marking implementation tasks complete.

**Evidence:**

| Date | Item | Changed files | Verification | Result |
|---|---|---|---|---|
| 2026-10-28 | WP2 re-credit after owner correction | No source changes; ignored generated output only. | `npm run typecheck` — exit 0; `npm test` — exit 0, 30 files / 163 tests; `npm run build` — exit 0; output assertions confirm v1 routes remain active and staged v2 UI/assets build. | PASS — the four staged WP2 implementation tasks are verified; browser acceptance remains open. |
| 2026-10-28 | WP2 message, alarm, and service unit tests | `src/background/messages.ts`, `tests/background/messages.test.ts`, `fixes/TRACKER.md`. | `npm test -- tests/background/session.test.ts tests/background/alarms.test.ts tests/background/messages.test.ts` — exit 0; 3 files / 19 tests passed. | PASS — staged session service, alarm scheduling, and corrected message/command contracts pass their focused behavior tests; browser/runtime acceptance remains deferred. |
| 2026-10-28 | WP2 message payload normalization rerun | `src/background/messages.ts`, `tests/background/messages.test.ts`, `fixes/TRACKER.md`. | `npm test -- tests/background/session.test.ts tests/background/alarms.test.ts tests/background/messages.test.ts` — exit 0; 3 files / 19 tests passed. | PASS — both start and stop pass only their typed fields to the service; malformed and unknown messages return distinct errors. |
| 2026-10-28 | WP2 notification, alarm, message, and recovery tests | `tests/background/notify.test.ts`, `tests/background/session.test.ts`, `fixes/TRACKER.md`. | `npm test -- tests/background/session.test.ts tests/background/alarms.test.ts tests/background/messages.test.ts tests/background/notify.test.ts` — exit 0; 4 files / 25 tests passed. | PASS — badge/notification formatting, overdue recovery, and state preservation despite browser side-effect failures are covered with deterministic test inputs. |
| 2026-10-28 | WP2 typecheck | `src/background/messages.ts`, `tests/background/messages.test.ts`, `fixes/TRACKER.md`. | `npm run typecheck` — exit 0; `tsc --noEmit` reported no diagnostics. | PASS — the staged background modules and timer view compile under strict TypeScript. |
| 2026-10-28 | WP2 full unit suite | `src/background/messages.ts`, `tests/background/messages.test.ts`, `fixes/TRACKER.md`. | `npm test` — exit 0; 17 files / 83 tests passed. | PASS — full current test suite is green; browser/runtime acceptance remains deferred until WP5 cutover and WP1b evidence. |
| 2026-10-28 | WP2 full unit suite with adapter/recovery coverage | `tests/background/notify.test.ts`, `tests/background/session.test.ts`, `tests/background/messages.test.ts`, `fixes/TRACKER.md`. | `npm test` — exit 0; 18 files / 89 tests passed. | PASS — full current suite remains green with new WP2 behavior tests included. |
| 2026-10-28 | WP2 staged build | `src/background/messages.ts`, `tests/background/messages.test.ts`, `fixes/TRACKER.md`; generated output in ignored `dist/`. | `npm run build` — exit 0; Vite transformed 2,079 modules and emitted `dist/index.html` plus JS/CSS bundles. | PASS — current extension build completes. The v2 modules remain staged and the v1 entry remains active pending the WP5 cutover. |
| 2026-10-28 | WP2 staged-build routing smoke check | `src/background/index.ts`, generated `dist/manifest.json` / `dist/background.js` (ignored), `fixes/TRACKER.md`. | Node assertions checked popup=`index.html`, service worker=`background.js`, both output bundles exist, source bridge imports `public/background.js`, and the generated bundle retains the v1 `timer_isActive` consumer. | PASS — current v1 behavior remains the active background; `type: module` describes bundle format and does not activate v2 session handlers. |
| 2026-10-28 | WP2 extension preview smoke check | `fixes/TRACKER.md`; no app-preview files changed. | Restarted `FocusGate Extension Preview`; screenshot of `/` on port 3000 shows the existing v1 timer UI. | PASS — active preview renders. Browser console reported one 404 resource; screenshot does not exercise the staged v2 timer. |

**Failures / blockers:**
- 2026-10-28 — Runtime acceptance remains open by design: the v1 consumers stay active through WP4, and WP1b browser spikes remain deferred. WP2.AC1–WP2.AC10 cannot be claimed until the WP5 atomic cutover and browser verification; the current preview screenshot only confirms the active v1 popup loads.
- 2026-10-28 — Resolved after correcting the message handler/test contracts: the focused suite passed 3 files / 19 tests (exact command and changed files recorded in Evidence). Earlier failure entries are retained as history.
- 2026-10-28 — The post-install focused suite exposed 3 failing message tests (16/19 passed) for the mismatches recorded in Notes / progress. Session/alarm tests passed. This is the current WP2 test blocker.
- 2026-10-28 — Resolved the focused-suite startup blocker: `npm ci` exited 0 and restored the lockfile dependencies (125 packages). The earlier baseline test command remains recorded above; rerun it now that Vitest is installed.
- 2026-10-28 — Baseline focused suite `npm test -- tests/background/session.test.ts tests/background/alarms.test.ts tests/background/messages.test.ts` exited 127 because `vitest` is not installed (`sh: 1: vitest: command not found`). Restore dependencies from the existing lockfile before running checks; no project code changed for this check.
- 2026-10-28 — Initial WP2 verification could not start because dependencies are absent: `npm run typecheck` exited 127 (`tsc: command not found`); `npx vitest run tests/shared/session.test.ts tests/background/session.test.ts tests/background/alarms.test.ts` exited 1 because Vitest could not load `vite.config.ts` without `@tailwindcss/vite`, `@vitejs/plugin-react`, and `vite`. Restore the existing lockfile dependencies with `npm ci`, then rerun the checks. No package manifests were intentionally changed.
- 2026-10-28 — After `npm ci`, `npm run typecheck` passed. `npx vitest run tests/shared/session.test.ts tests/background/session.test.ts tests/background/alarms.test.ts` failed 2 of 22 tests: the clock-skew fixture was exactly at the 60-second threshold (the plan says more than 60 seconds), and the recovery notification test exposed that break-end transitions with no `SessionRecord` did not notify. Correct the fixture threshold and notify on session-state transitions, then rerun.
- 2026-10-28 — Resolved the test failures: `npm run typecheck` exited 0; `npx vitest run tests/shared/session.test.ts tests/background/session.test.ts tests/background/alarms.test.ts` exited 0 with 3 files / 22 tests passing.
- 2026-10-28 — Expanding strict typecheck to the staged TSX view exposed the repository's missing React type declarations: `npm run typecheck` exited 2 with 70 diagnostics in the two staged TSX files, all beginning with unresolved React/JSX typings and implicit JSX elements. Add the matching React type package, then rerun; do not suppress the diagnostics.

**Decisions / deferred work:** Keep WP2.AC1–WP2.AC10 unchecked until WP5 cutover and required browser verification. Do not promote the staged v2 worker, messages, or timer into the active runtime early.

---

## WP3 — Blocking engine

**Plan:** §5.3–§5.4, §6 WP3, Appendix A · **Blocked by:** WP2; S1 before runtime enforcement · **Status:** IN PROGRESS · **Started:** 2026-10-28 · **Completed:** — · **Progress:** 10/22

### Tasks

- [x] WP3.1 Implement pure `computeBlockPlan(state, now)` and `explainBlock(url, state, now)`; worker, fallback listeners, block page, and Check-a-URL use the same decision function.
- [x] WP3.2 Implement serialized `reconcile(reason)` with `try/catch`, health fields, one `updateDynamicRules` call, one `boundary` alarm, transition-only tab audits, and one-minute safety tick while blocking.
- [x] WP3.3 Implement one DNR redirect using `requestDomains`, `regexFilter`, and `regexSubstitution`; use priority-2 `allow` rules for exceptions.
- [x] WP3.4 Normalize/validate inputs at entry using URL hostname parsing and punycode; reject malformed values, show inline UI errors, and report invalid stored values through health state.
- [ ] WP3.5 Implement alias groups (including `x.com`/`twitter.com`/`t.co`); adding one blocks the group and UI shows group chips.
- [x] WP3.6 Implement named schedules with own lists or `useGlobalLists`; cover overnight, `24:00`, end-exclusive and previous-day rules; calculate boundaries for schedules, standalone, allowance windows, and local midnight.
- [x] WP3.7 Implement `time_budget`, `count`, and `interval` allowances with attention ledger; count focused active-tab/non-idle or audible use; enforce per-entry caps, `duringBlocks`, and always-blocked precedence.
- [x] WP3.8 Implement normalized boundary-checked exceptions and DNR allow rule from the same entry; exceptions override other rules.
- [x] WP3.9 Implement keyword scope/match and host parameter table (`yahoo p`, `yandex text`, `baidu wd`, `youtube search_query`, `amazon k`, generic `q`/`query` only); never generic `p`; retain last 50 matches.
- [ ] WP3.10 Add filtered `webNavigation` fallback listeners for HTTP(S) using `explainBlock`, `recordBlock`, and `tabs.update`; delete `tabs.onUpdated` fallback and repeated audit loop.
- [x] WP3.11 Deduplicate `recordBlock` for three seconds by tab/domain; cap `recentBlocks` at 200 and update daily/domain/session counters.
- [x] WP3.12 Route `tick`, `boundary`, `session_phase_end`, `weekly_report`, and `midnight` alarms through `ensureAlarms()`.

### Acceptance criteria

- [ ] WP3.AC1 Typed URL, link, new tab, and SPA route all reach `blocked.html` with original URL/reason, no flash, and worker-restart resilience.
- [ ] WP3.AC2 `notexample.com`, `example.com.au`, and `example.community` remain unblocked; `www.example.com` and `a.b.example.com` are blocked.
- [ ] WP3.AC3 Exception for `youtube.com/watch?v=abc` allows only that video (including `&t=5`), not `v=abcd`, root URL, or look-alike hosts.
- [ ] WP3.AC4 09:00–17:00 weekday schedule starts/stops without user action; overnight, previous-day rule, `24:00`, owned/global lists all work.
- [ ] WP3.AC5 Time-budget/count/interval modes enforce the specified examples; background/unfocused/idle time does not count; remaining budget is visible; `duringBlocks` does not flash.
- [ ] WP3.AC6 `q`, `query`, `search_query`, `text`, and `wd` match; comma input splits; whole-word matching works; YouTube in-page search is blocked.
- [ ] WP3.AC7 Injected garbage/IDN entries do not prevent valid rules; Protection status shows the error.
- [ ] WP3.AC8 Ten rapid site additions produce one consistent rule set with no duplicate-ID errors.
- [ ] WP3.AC9 One block produces one recent-block entry and one daily-stat increment regardless of event path.
- [ ] WP3.AC10 Schedule/standalone end removes their domains from dynamic rules without storage change; rules survive browser restart.

**Notes / progress:**
- 2026-10-28 — Re-credited 10 WP3 implementation tasks after fresh verification. Shared `explainBlock` is used by the staged block page, Check-a-URL, and fallback path; domain validation is wired into Rules and invalid stored values are reported. WP3.5 remains open because alias chips are not present in the UI; WP3.10 remains open because the active v1 worker still registers `tabs.onUpdated`. All ten browser/runtime ACs remain unchecked; WP1b/S1 is genuinely incomplete.
- 2026-10-28 — Owner authorized continuing WP3 to complete implementation and deterministic module/unit verification, with real-browser verification deferred. Keep S1 and the WP5 activation gate closed; unit tests do not establish browser behavior. UI integrations assigned to WP5/WP7 remain open and must not be counted complete from staged engine coverage.
- 2026-10-28 — Historical reset note: WP3 and total checkmarks were temporarily cleared to 0/22 and 0/156. Superseded by the owner-directed evidence reconciliation at 10/22 above; S1 runtime enforcement remains gated.
- 2026-10-28 — Fresh post-authorization checks: `npm ci` exited 0 (125 packages; npm reported 4 vulnerabilities), `npm run typecheck` exited 0, `npm test` passed 23 files / 123 tests, `npm run build` exited 0, and `git diff --check` was clean. These confirm the staged modules compile/build and deterministic tests pass; no browser verification was run.
- 2026-10-28 — Historical interim status at 8/22, superseded by the current 10/22 reconciliation above. WP3.5 still lacks alias UI; WP3.10's active v1 fallback removal still waits for the WP5 atomic cutover. Browser/runtime acceptance remains unchecked.
- 2026-10-28 — Restored local dependencies from the existing lockfile: `npm ci` exited 0; 125 packages added. npm reported 4 dependency vulnerabilities (2 moderate, 2 high). No package manifest or lockfile was changed.
- 2026-10-28 — Fresh `npm run typecheck` passed after dependency restore; command exited 0 with no TypeScript diagnostics. This verifies compilation only; WP3 behavior items remain unchecked pending fresh behavior tests and gap review.
- 2026-10-28 — Fresh focused WP3 behavior suite passed: 12 test files / 66 tests. This covers pure plan, domain/exception/keyword/schedule/allowance logic, DNR construction, reconciliation, attention, alarms, block recording, and staged navigation; it does not establish browser runtime behavior or UI acceptance.
- 2026-10-28 — Source review found the sampler counted an unfocused audible tab unconditionally, contrary to the deferred WP1b S2 conservative fallback. Made audible accounting explicitly opt-in (off when unset); focused-window/non-idle accounting remains the default. `npm test -- tests/background/attention.test.ts` exited 0; 1 file / 8 tests passed. Combined verification remains pending.
- 2026-10-28 — Re-ran the focused WP3 suite after that correction: 12 files / 67 tests passed. Marked WP3.2, .3, .7, .8, .9, .11, and .12 verified. WP3.6 still needs explicit `useGlobalLists` behavior coverage; UI integration and runtime acceptance stay open.
- 2026-10-28 — Added a schedule test for `useGlobalLists`, proving active schedules use the current global list and stop doing so when the flag is off. `npm test -- tests/shared/plan.test.ts` exited 0; 1 file / 11 tests passed. WP3.6 is freshly verified at the module/unit level.
- 2026-10-28 — Full repository suite passed after the attention fallback and schedule-list test changes: `npm test` exited 0; 23 files / 121 tests passed.
- 2026-10-28 — Fresh post-change `npm run typecheck` passed; `tsc --noEmit` exited 0 with no diagnostics.
- 2026-10-28 — Fresh post-change `npm run build` passed; the extension build transformed 2,079 modules and emitted the production bundle.
- 2026-10-28 — Restarted `FocusGate Extension Preview`; Vite served the popup on port 3000 and the screenshot showed the app. The browser console reported one unidentified 404; this is not extension runtime/S1 evidence.
- 2026-10-28 — Restarted `FocusGate Docs Preview` after dependency restoration; Vite became ready on port 5000. Both web previews are running; GitHub Sync remains stopped and was not started.
- 2026-10-28 — Historical final-scope checkpoint at 8/22, superseded by the current re-credit above. The blocked-page/Check-a-URL and validation UI integrations are now present; WP3.5 alias chips and WP3.10 cutover remain open. Browser/runtime acceptance and S1 remain unverified.
- 2026-10-28 — Historical WP3.4 note: per-site health reporting and inline validation were incomplete at that checkpoint. Current source review confirms both are now wired; WP3.4 is re-credited above.
- 2026-10-28 — Added planner-level alias coverage: a single `twitter.com` always-block entry must block `x.com` and `t.co` through the shared decision function. `npm test -- tests/shared/plan.test.ts` exited 0; 1 file / 12 tests passed. WP3.5 remains unchecked because the UI alias chips are deferred.
- 2026-10-28 — Owner authorized continuation of WP3 and supplied a WP3-specific checklist. Reset all prior completion marks to 0/156; revalidate dependencies and current WP3 code from the checkout. Keep navigation enforcement and DNR activation gated on WP1b.S1.
- 2026-10-28 — Fresh source review found the pure plan, DNR builder, reconciler, block recorder, and staged navigation listener present. Attention sampling, keyword-match persistence, and boundary/weekly-report/midnight alarm scheduling are still missing. The active worker remains the v1 bridge; do not activate v2.
- 2026-10-28 — Added a dependency-injected attention sampler and fake-event-source tests for focused/idle/audible attribution, alias/domain matching, cap reconciliation, and listener cleanup. Usage checkpoints advance before durable writes to avoid double-credit after recovery; the sampler remains unregistered and verification is pending.
- 2026-10-28 — Corrected the attention no-credit test to expect an absent record during idle/unfocused time, then verify 60 seconds are credited after focus returns. Rerun pending; the failed attempt remains recorded below.
- 2026-10-28 — The corrected attention test passed 1 file / 5 tests. The original assertion failure is retained in the failure history; sampler still requires typecheck and broader-suite verification.
- 2026-10-28 — Fresh `npm run typecheck` passed after adding the attention sampler; `tsc --noEmit` emitted no diagnostics. WP3.7 remains incomplete pending alarm integration and final combined checks.
- 2026-10-28 — Extended the serialized block recorder to append keyword match records to the existing 50-entry ring when the reason is a keyword. `npm test -- tests/background/recordBlock.test.ts` passed 1 file / 5 tests; typecheck and broader verification remain.
- 2026-10-28 — Extended `ensureAlarms` to maintain the one-minute tick, schedule boundary, session/standalone expiries, next weekly report, and local midnight rollover. Added explicit targets and idempotency tests; alarm test/typecheck reruns are pending.
- 2026-10-28 — Updated the existing session-alarm test to match by alarm name/target instead of list position, because ensureAlarms now schedules additional one-shots. The rerun passed 1 file / 6 tests; the first failed attempt is retained below.
- 2026-10-28 — Added a separate open-tab safety audit and staged alarm dispatcher. Recognized alarms re-arm schedules first; ticks sample attention and audit tabs only while blocking is active; boundary/session/report/midnight names route to injected handlers. No listeners are registered; focused tests and typecheck are pending.
- 2026-10-28 — Corrected alarm-handler tests to derive `nextBoundaryAt` from the same plan as the dispatcher, preserving timezone-independent behavior. The combined audit/handler suite passed 5 files / 26 tests; the initial mismatch is retained below.
- 2026-10-28 — Fresh strict typecheck passed after the alarm-handler and safety-audit additions; `npm run typecheck` exited 0 with no diagnostics.
- 2026-10-28 — Full repository test suite passed after the WP3 module changes: `npm test` exited 0; 23 files / 116 tests passed.
- 2026-10-28 — Extension production build passed: `npm run build` exited 0; Vite transformed 2,079 modules and generated the extension bundle in `dist/`.
- 2026-10-28 — Final source review found an attention edge case: the sampler could continue accruing after an allowance was exhausted, and the safety-tick active check omitted allowance-only blocks. Correct both before final verification; previous full-suite/build passes predate this correction.
- 2026-10-28 — Corrected attention accounting to stop crediting exhausted or blocked sites and to respect metered exemptions; changed `isBlockingActive` to derive from the current block plan so allowance-only blocks receive safety audits. `npm test -- tests/background/attention.test.ts tests/background/alarmHandler.test.ts` passed 2 files / 11 tests.
- 2026-10-28 — Added deterministic count-visit and interval-window coverage, including starting an interval at the observed reset boundary and crediting only time after that boundary. `npm test -- tests/background/attention.test.ts` passed 1 file / 7 tests; final suite/build reruns remain.
- 2026-10-28 — `npm run typecheck` passed after the count/interval window-boundary refinement with no TypeScript diagnostics.
- 2026-10-28 — Final full repository test suite passed after the count/interval refinement: `npm test` exited 0; 23 files / 119 tests passed.
- 2026-10-28 — Final extension build passed after the count/interval boundary refinement: `npm run build` exited 0; Vite transformed 2,079 modules and emitted extension assets.
- 2026-10-28 — Strict typecheck passed after the final attention/safety-tick correction: `npm run typecheck` exited 0 with no TypeScript diagnostics.
- 2026-10-28 — Final full test suite passed after the attention-cap correction: `npm test` exited 0; 23 files / 118 tests passed.
- 2026-10-28 — Final extension build passed after the attention-cap correction: `npm run build` exited 0; Vite transformed 2,079 modules and emitted the extension assets.
- 2026-10-28 — Final working-tree review: `git status --short && git diff --check && git diff --stat` exited 0; only expected source/test/tracker files are listed, build output is not tracked, and no whitespace errors were reported.
- 2026-10-28 — Owner authorized WP3 module and unit-test work. Keep DNR rules and navigation enforcement out of the active runtime until S1 is verified; WP1b remains deferred and does not block code/unit work. No WP3 item is marked complete yet.
- 2026-10-28 — Fixed the pure-planning gaps: query/URL keyword scopes are honored, interval boundaries require a live window, malformed schedules are ignored without aborting other rules, and DNR exception patterns now use normalized exception entries. Focused tests are pending.
- 2026-10-28 — Added the staged `recordBlock` service: serialized per-tab/domain dedupe, local-day/domain counters, active-session attempts, and a 200-record cap are written together through injected state/dedupe adapters. Its fake-clock behavior tests are pending.
- 2026-10-28 — Pure planning/DNR and block-recording checks passed: 7 files / 39 tests. Broader WP3 services remain unimplemented, so no WP3 checklist item is complete.
- 2026-10-28 — Exported schedule validation for reuse by the upcoming reconcile health report; this is a module-only helper and remains outside the active worker. Reconcile tests are pending.
- 2026-10-28 — Added a dependency-injected staged reconciler with serialized/coalesced calls, atomic DNR batch installation plus failure isolation, health reporting, transition-only tab audit, and alarm reconciliation. Reconcile behavior tests are pending; it is not registered in the active v1 worker.
- 2026-10-28 — Reconcile and block-recording behavior tests passed: 4 files / 23 tests, including serialized coalescing, DNR failure isolation, new-domain tab audits, health reporting, dedupe, caps, and atomic state patches.
- 2026-10-28 — Added the staged `webNavigation` fallback listener module with HTTP(S) filters, main-frame checks, shared `explainBlock`, block-recording, and original-URL redirect construction. It remains unregistered; behavior tests are pending.
- 2026-10-28 — Fixed the two strict-TypeScript diagnostics found in `isBlockingActive` and malformed-schedule reporting; the typecheck rerun is pending.
- Follow plan §6 WP3 and Appendix A.

**Evidence:**

| Date | Item | Changed files | Verification | Result |
|---|---|---|---|---|
| 2026-10-28 | WP3 re-credit after owner correction | No source changes; ignored generated output only. | `npm run typecheck` — exit 0; `npm test` — exit 0, 30 files / 163 tests; `npm run build` — exit 0; source audit confirmed shared decision reuse, inline domain validation/health reporting, absent alias chips, and the active v1 fallback registration. | PASS — WP3.1–.4, .6–.9, .11–.12 are verified; WP3.5/.10 and all browser/runtime acceptance criteria remain open. |
| 2026-10-28 | WP3 fresh staged verification | `fixes/plan.md`, `fixes/TRACKER.md`; `node_modules/` and generated `dist/` are ignored. | `npm ci` — exit 0 (125 packages; 4 audit vulnerabilities); `npm run typecheck` — exit 0; `npm test` — exit 0 (23 files / 123 tests); `npm run build` — exit 0 (2,079 modules); `git diff --check` — exit 0. | PASS — current staged implementation compiles, passes deterministic tests, and builds. No browser/runtime behavior was exercised; WP3 UI/cutover tasks remain open. |
| 2026-10-28 | WP3.5 planner alias-group behavior | `tests/shared/plan.test.ts`, `fixes/TRACKER.md`. | `npm test -- tests/shared/plan.test.ts` — exit 0; 1 file / 12 tests passed. | PASS — one configured alias entry blocks the related domains through `explainBlock`; UI chips remain unimplemented. |
| 2026-10-28 | WP3.4 scheduled-domain health reporting | `src/background/reconcile.ts`, `tests/background/reconcile.test.ts`, `fixes/TRACKER.md`. | `npm test -- tests/background/reconcile.test.ts` — exit 0; 1 file / 7 tests passed. | PASS — malformed scheduled site is reported and the valid site remains in the generated rule set; UI validation remains unimplemented. |
| 2026-10-28 | Final WP3 working-tree review | `fixes/TRACKER.md`, `src/background/attention.ts`, `tests/background/attention.test.ts`, `tests/shared/plan.test.ts`. | `git diff --check && git status --short --branch && git diff --stat` — exit 0; four expected modified files; no whitespace errors. | PASS — only the attention fallback, its tests, the global-list test, and tracker changed; no generated bundle was staged. |
| 2026-10-28 | Docs preview after dependency restore | No app-source changes; existing workflow restarted. | `WorkflowsRestart` for `FocusGate Docs Preview`; workflow logs show Vite ready on port 5000. | PASS — docs preview is serving; GitHub Sync remains stopped. |
| 2026-10-28 | Extension preview smoke | No app-source changes; preview workflow restarted. | `WorkflowsRestart` for `FocusGate Extension Preview`; screenshot of `/` on port 3000. | PASS — popup rendered; browser console logged one resource 404 with no URL details. Does not verify extension APIs, DNR, or navigation enforcement. |
| 2026-10-28 | Fresh post-change extension build | `dist/` generated by the existing build script; `fixes/TRACKER.md`. | `npm run build` — exit 0; Vite transformed 2,079 modules and emitted extension assets. | PASS — production bundle builds; no runtime behavior or S1 redirect evidence. |
| 2026-10-28 | Fresh post-change WP3 typecheck | `src/background/attention.ts`, `tests/background/attention.test.ts`, `tests/shared/plan.test.ts`, `fixes/TRACKER.md`. | `npm run typecheck` — exit 0; no TypeScript diagnostics. | PASS — the new opt-in parameter and global-list test compile strictly. |
| 2026-10-28 | Fresh full repository test suite | Current repository tests; `fixes/TRACKER.md`. | `npm test` — exit 0; 23 files / 121 tests passed. | PASS — all current unit tests pass after the WP3 changes; this does not verify browser runtime enforcement. |
| 2026-10-28 | WP3 schedule global-list behavior test | `tests/shared/plan.test.ts`, `fixes/TRACKER.md`. | `npm test -- tests/shared/plan.test.ts` — exit 0; 1 file / 11 tests passed. | PASS — validates active owned/global list behavior and immediate use of the current global list. |
| 2026-10-28 | Fresh WP3 suite after conservative audio default | `src/background/attention.ts`, `tests/background/attention.test.ts`, current WP3 modules/tests, `fixes/TRACKER.md`. | `npm test -- tests/shared/plan.test.ts tests/shared/dnr.test.ts tests/shared/domains.test.ts tests/shared/keywords.test.ts tests/shared/time.test.ts tests/shared/allowance.test.ts tests/background/reconcile.test.ts tests/background/recordBlock.test.ts tests/background/blockNavigation.test.ts tests/background/attention.test.ts tests/background/alarms.test.ts tests/background/alarmHandler.test.ts` — exit 0; 12 files / 67 tests passed. | PASS — revalidates module-level WP3 tasks; runtime and UI acceptance remain unverified. |
| 2026-10-28 | WP3 attention audible-time default | `src/background/attention.ts`, `tests/background/attention.test.ts`, `fixes/TRACKER.md`. | `npm test -- tests/background/attention.test.ts` — exit 0; 1 file / 8 tests passed. | PASS — audible time is off by default and the explicit opt-in path is covered; broader combined verification remains. |
| 2026-10-28 | Fresh WP3 focused behavior suite | Current WP3 source/tests; `fixes/TRACKER.md`. | `npm test -- tests/shared/plan.test.ts tests/shared/dnr.test.ts tests/shared/domains.test.ts tests/shared/keywords.test.ts tests/shared/time.test.ts tests/shared/allowance.test.ts tests/background/reconcile.test.ts tests/background/recordBlock.test.ts tests/background/blockNavigation.test.ts tests/background/attention.test.ts tests/background/alarms.test.ts tests/background/alarmHandler.test.ts` — exit 0; 12 files / 66 tests passed. | PASS — fake-clock/event-source module tests pass; browser gates remain closed. |
| 2026-10-28 | Fresh WP3 strict typecheck | No source changes; `fixes/TRACKER.md`. | `npm run typecheck` — exit 0; no TypeScript diagnostics. | PASS — current checkout compiles; no runtime behavior or browser activation is established. |
| 2026-10-28 | WP3 count/interval attention boundary refinement | `src/background/attention.ts`, `tests/background/attention.test.ts`, `fixes/TRACKER.md`. | `npm test -- tests/background/attention.test.ts` — exit 0; 1 file / 7 tests passed. | PASS — fake-clock tests cover count visits, interval cap/reset timing, and credit only after a reset boundary. |
| 2026-10-28 | WP3 typecheck after attention boundary refinement | `src/background/attention.ts`, `tests/background/attention.test.ts`. | `npm run typecheck` — exit 0; `tsc --noEmit` emitted no diagnostics. | PASS — current sampler compiles after count/interval timing changes. |
| 2026-10-28 | WP3 final full unit suite after attention refinement | All current test files; source unchanged. | `npm test` — exit 0; 23 files / 119 tests passed. | PASS — final code state passes the full suite; browser DNR/listener activation remains unverified. |
| 2026-10-28 | WP3 final extension build after count/interval refinement | `dist/` generated by the existing build script; no hand edits. | `npm run build` — exit 0; Vite transformed 2,079 modules and emitted extension assets. | PASS — final source state builds; no browser enforcement was activated. |
| 2026-10-28 | WP3 allowance cap and safety-audit behavior | `src/background/attention.ts`, `src/shared/plan.ts`, `tests/background/attention.test.ts`, `tests/background/alarmHandler.test.ts`, `fixes/TRACKER.md`. | `npm test -- tests/background/attention.test.ts tests/background/alarmHandler.test.ts` — exit 0; 2 files / 11 tests passed. | PASS — verifies no credit beyond an exhausted cap, metered exemptions while blocking, always-blocked precedence, and tick audits for allowance-only blocks. |
| 2026-10-28 | WP3 strict typecheck after cap correction | `src/background/attention.ts`, `src/shared/plan.ts`, `tests/background/attention.test.ts`, `tests/background/alarmHandler.test.ts`. | `npm run typecheck` — exit 0; `tsc --noEmit` emitted no diagnostics. | PASS — corrected allowance and safety-plan logic compiles. |
| 2026-10-28 | WP3 final full repository unit suite | All current test files; source unchanged. | `npm test` — exit 0; 23 files / 118 tests passed. | PASS — final source state passes all unit tests; DNR/browser runtime behavior remains unverified and gated. |
| 2026-10-28 | WP3 final extension production build | Build output generated by the existing script in `dist/`; no hand edits. | `npm run build` — exit 0; Vite transformed 2,079 modules and emitted extension assets. | PASS — final source state builds; no browser enforcement was activated. |
| 2026-10-28 | WP3 working-tree and whitespace review | Expected staged modules/tests and `fixes/TRACKER.md`. | `git status --short && git diff --check && git diff --stat` — exit 0; no whitespace errors. | PASS — no unexpected tracked or untracked files appeared; generated `dist/` output is absent from the working tree listing. |
| 2026-10-28 | WP3 allowance cap and safety-audit correction | `src/background/attention.ts`, `src/shared/plan.ts`, `tests/background/attention.test.ts`, `tests/background/alarmHandler.test.ts`, `fixes/TRACKER.md`. | Verification pending. | UNVERIFIED — attention now stops at the cap, respects `duringBlocks` and always-blocked precedence; safety activity includes allowance-only blocked plans. |
| 2026-10-28 | WP3 safety-audit/alarm-dispatch first combined test attempt | `src/background/reconcile.ts`, `src/background/alarmHandler.ts`, `tests/background/reconcile.test.ts`, `tests/background/alarmHandler.test.ts`, `fixes/TRACKER.md`. | `npm test -- tests/background/reconcile.test.ts tests/background/alarmHandler.test.ts tests/background/attention.test.ts tests/background/alarms.test.ts tests/background/recordBlock.test.ts` — exit 1; 4 files passed, 1 failed; 24 tests passed, 2 failed in `alarmHandler.test.ts`. | FAIL — tests expected a `null` boundary, but `computeBlockPlan` correctly returns the next local-day boundary; update expectations to derive the boundary from the plan. |
| 2026-10-28 | WP3 safety audit and alarm dispatch behavior | `src/background/reconcile.ts`, `src/background/alarmHandler.ts`, `tests/background/reconcile.test.ts`, `tests/background/alarmHandler.test.ts`, `tests/background/attention.test.ts`, `tests/background/alarms.test.ts`, `tests/background/recordBlock.test.ts`, `fixes/TRACKER.md`. | `npm test -- tests/background/reconcile.test.ts tests/background/alarmHandler.test.ts tests/background/attention.test.ts tests/background/alarms.test.ts tests/background/recordBlock.test.ts` — exit 0; 5 files / 26 tests passed. | PASS — fake adapters verify staged alarm routing, schedule re-arming, tick attention/safety audit, blocking-only tab audit, and the surrounding WP3 record/attention behavior. |
| 2026-10-28 | WP3 strict typecheck after alarm integration | `src/background/attention.ts`, `src/background/recordBlock.ts`, `src/background/alarms.ts`, `src/background/alarmHandler.ts`, `src/background/reconcile.ts`, and tests. | `npm run typecheck` — exit 0; `tsc --noEmit` emitted no diagnostics. | PASS — current staged modules compile; runtime remains unregistered. |
| 2026-10-28 | WP3 full repository unit suite | All current test files; source unchanged. | `npm test` — exit 0; 23 files / 116 tests passed. | PASS — full unit suite is green; this does not verify browser DNR or listener activation. |
| 2026-10-28 | WP3 extension production build | `dist/` generated by the existing build script; no hand edits. | `npm run build` — exit 0; 2,079 modules transformed, extension assets emitted. | PASS — build succeeds; browser runtime behavior remains gated and was not exercised. |
| 2026-10-28 | WP3 alarm scheduling first focused test attempt | `src/background/alarms.ts`, `tests/background/alarms.test.ts`, `fixes/TRACKER.md`. | `npm test -- tests/background/alarms.test.ts` — exit 1; 5 tests passed, 1 failed at `tests/background/alarms.test.ts:113` because the test assumed the session alarm would be the final scheduled alarm after new weekly/midnight alarms were added. | FAIL — assertion ordering is stale; verify the session alarm by matching its name and target instead. |
| 2026-10-28 | WP3 planned alarm scheduling | `src/background/alarms.ts`, `tests/background/alarms.test.ts`, `fixes/TRACKER.md`. | `npm test -- tests/background/alarms.test.ts` — exit 0; 1 file / 6 tests passed. | PASS — fake alarm API verifies tick period, phase/standalone expiry, exact schedule boundary, weekly-report and midnight one-shots, idempotency, and clearing stale alarms. |
| 2026-10-28 | WP3 keyword match persistence | `src/background/recordBlock.ts`, `tests/background/recordBlock.test.ts`, `fixes/TRACKER.md`. | `npm test -- tests/background/recordBlock.test.ts` — exit 0; 1 file / 5 tests passed. | PASS — keyword match records append with normalized domain and injected time; the rolling cap remains 50 entries. |
| 2026-10-28 | WP3 attention sampler first focused test attempt | `src/background/attention.ts`, `tests/background/attention.test.ts`, `fixes/TRACKER.md`. | `npm test -- tests/background/attention.test.ts` — exit 1; 4 tests passed, 1 failed at `tests/background/attention.test.ts:123` because the no-credit case returned no usage record rather than a record with `usedMs: 0`. | FAIL — assertion did not represent expected behavior; test will be corrected and rerun. |
| 2026-10-28 | WP3 attention sampler behavior | `src/background/attention.ts`, `tests/background/attention.test.ts`, `fixes/TRACKER.md`. | `npm test -- tests/background/attention.test.ts` — exit 0; 1 file / 5 tests passed. | PASS — fake clock and event sources verify attentive attribution, idle/unfocused non-credit, audible credit, alias/domain matching, exhaustion reconciliation, and listener cleanup. |
| 2026-10-28 | WP3 post-attention strict typecheck | `src/background/attention.ts`, `tests/background/attention.test.ts`, `fixes/TRACKER.md`. | `npm run typecheck` — exit 0; `tsc --noEmit` emitted no diagnostics. | PASS — attention module compiles; not a browser runtime activation check. |
| 2026-10-28 | WP3 dependency restore | `node_modules/` only (ignored); `fixes/TRACKER.md`. | `npm ci` — exit 0; 125 packages added. npm reported 4 vulnerabilities (2 moderate, 2 high). | PASS — dependencies restored from the existing lockfile; no audit fix or manifest change was made. |
| 2026-10-28 | WP3 fresh strict typecheck | No source changes; dependencies were restored from the lockfile. | `npm run typecheck` — exit 0; `tsc --noEmit` emitted no diagnostics. | PASS — current checkout typechecks; this does not activate or verify staged browser runtime behavior. |
| 2026-10-28 | WP3 fresh focused behavior suite | No source changes; `fixes/TRACKER.md`. | `npm test -- tests/shared/plan.test.ts tests/shared/dnr.test.ts tests/shared/domains.test.ts tests/shared/keywords.test.ts tests/shared/time.test.ts tests/shared/allowance.test.ts tests/background/reconcile.test.ts tests/background/recordBlock.test.ts tests/background/blockNavigation.test.ts` — exit 0; 9 files / 46 tests passed. | PASS — pure planning, schedule, allowance, DNR, reconciliation, block recording, and staged navigation tests pass with injected times/events. |
| 2026-10-28 | WP3 pure planning and DNR normalization | `src/shared/plan.ts`, `src/shared/dnr.ts`, `tests/shared/plan.test.ts`, `tests/shared/dnr.test.ts`. | `npm test -- tests/shared/plan.test.ts tests/shared/dnr.test.ts tests/shared/domains.test.ts tests/shared/keywords.test.ts tests/shared/time.test.ts tests/shared/allowance.test.ts` — exit 0; 6 files / 35 tests passed. | PASS — query/URL scopes, malformed schedule tolerance, interval reset boundaries, normalized exception rules, and existing pure helpers pass focused behavior tests. |
| 2026-10-28 | WP3 pure planning plus block recording | `src/shared/plan.ts`, `src/shared/dnr.ts`, `src/background/recordBlock.ts`, `tests/shared/plan.test.ts`, `tests/shared/dnr.test.ts`, `tests/background/recordBlock.test.ts`. | `npm test -- tests/background/recordBlock.test.ts tests/shared/plan.test.ts tests/shared/dnr.test.ts tests/shared/domains.test.ts tests/shared/keywords.test.ts tests/shared/time.test.ts tests/shared/allowance.test.ts` — exit 0; 7 files / 39 tests passed. | PASS — pure-plan edge cases and deterministic block-attempt persistence/dedupe/caps pass. |
| 2026-10-28 | WP3 reconciliation and block-recording behavior | `src/background/reconcile.ts`, `src/background/recordBlock.ts`, `tests/background/reconcile.test.ts`, `tests/background/recordBlock.test.ts`, `src/shared/plan.ts`, `src/shared/dnr.ts`. | `npm test -- tests/background/reconcile.test.ts tests/background/recordBlock.test.ts tests/shared/plan.test.ts tests/shared/dnr.test.ts` — exit 0; 4 files / 23 tests passed. | PASS — injected tests cover coalescing, one-call install, bisection fallback, health, transition audits, counters, and dedupe. |
| 2026-10-28 | WP3 strict typecheck | `src/shared/plan.ts`, `src/background/reconcile.ts`, `fixes/TRACKER.md`. | `npm run typecheck` — exit 0; no TypeScript diagnostics. | PASS — staged plan and reconcile modules compile strictly. |

**Failures / blockers:**
- 2026-10-28 — Current boundary: WP3.5 is still an implementation gap because alias chips are absent from the UI; WP3.10 must wait for the gated WP5 cutover. Remaining WP3 acceptance criteria require observed browser/runtime evidence.
- 2026-10-28 — Browser/runtime verification was explicitly deferred by the owner. No DNR redirect, extension navigation, alarm lifecycle, or cross-browser acceptance result is claimed.
- 2026-10-28 — Resolved: after fixing the sampler to stop at exhausted caps and checking blocking from the computed plan, `npm test -- tests/background/attention.test.ts tests/background/alarmHandler.test.ts` exited 0; 2 files / 11 tests passed.
- 2026-10-28 — Resolved: after deriving alarm-handler expectations from `computeBlockPlan(state, now)`, the combined command above exited 0; 5 files / 26 tests passed.
- 2026-10-28 — First combined audit/handler suite attempt: the command above exited 1; 24/26 tests passed. Both failures were stale test expectations: the default plan includes the next local-day boundary. Make boundary expectations derive from `computeBlockPlan(state, now)`, then rerun.
- 2026-10-28 — Resolved: after changing the old list-position assertion to match the session alarm by name and scheduled time, `npm test -- tests/background/alarms.test.ts` exited 0; 1 file / 6 tests passed.
- 2026-10-28 — First alarm suite attempt: `npm test -- tests/background/alarms.test.ts` exited 1; 5/6 tests passed. The implementation added weekly and midnight alarms, so the existing assertion that `creates.at(-1)` was `session_phase_end` became invalid; change it to an order-independent exact-match assertion and rerun.
- 2026-10-28 — Resolved: after correcting the no-credit assertion to expect no usage record until attentive time is observed, `npm test -- tests/background/attention.test.ts` exited 0; 1 file / 5 tests passed.
- 2026-10-28 — Attention sampler test attempt: `npm test -- tests/background/attention.test.ts` exited 1; 4/5 tests passed. The remaining assertion expected a zero-valued usage record where the intended no-credit behavior leaves the record absent; update the test to transition back to a focused active window and verify resumed credit. No production defect has been established by this failure.
- 2026-10-28 — Fresh WP3 typecheck did not start: `npm run typecheck` exited 127 with `sh: 1: tsc: not found`. Dependencies are absent from `node_modules`; inspect the lockfile and restore dependencies with the repository's existing package manager before rerunning. No source changes were made.
- 2026-10-28 — Resolved: after correcting the stale `activeSchedules` call and narrowing malformed schedules from `unknown`, `npm run typecheck` exited 0 with no diagnostics.
- 2026-10-28 — Resolved: the new reconciler/recorder suite passed 4 files / 23 tests; no real browser DNR rules were installed.
- 2026-10-28 — `npm run typecheck` exited 2 with two diagnostics: `isBlockingActive` still referenced the removed `activeSchedules` helper, and the invalid-schedule reporter narrowed an already-typed `Schedule` branch to `never`. Fix both typing references, then rerun.
- 2026-10-28 — Resolved: corrected the hostname-escaping expectation; the combined focused suite passed 7 files / 39 tests.
- 2026-10-28 — Resolved: corrected the new DNR test to expect the hostname dot escaped; the focused suite then passed 6 files / 35 tests.
- 2026-10-28 — `npm test -- tests/shared/plan.test.ts tests/shared/dnr.test.ts tests/shared/domains.test.ts tests/shared/keywords.test.ts tests/shared/time.test.ts tests/shared/allowance.test.ts` exited 1: 34/35 tests passed; the new DNR assertion expected the normalized hostname dot to be unescaped, while the builder correctly escapes it for regex matching. The test expectation was corrected and rerun.

**Decisions / deferred work:** None recorded.

---

## WP4 — Content script

**Plan:** §6 WP4, Appendix B · **Blocked by:** WP3 residual UI/cutover/browser gates; owner authorized staged work · **Status:** IN PROGRESS · **Started:** 2026-10-28 · **Completed:** — · **Progress:** 6/15

### Tasks

- [ ] WP4.1 Add the Appendix B site table; load session, standalone, schedules, content filters, and hidden keywords; use shared `isFilteringActive`; react to storage changes, schedule boundaries, and `visibilitychange`.
- [x] WP4.2 Use one CSS style element for enabled filters; hide keywords with `data-fg-hidden="1"` and restore by removing the attribute.
- [x] WP4.3 Observe `document.documentElement` (never `document.body`), debounce by 200 ms, and attach only when filtering and keywords are active; assign the observer only after successful `observe()`.
- [x] WP4.4 Match exact hosts or dot-prefixed suffixes; never use substring matching.
- [x] WP4.5 Generate `manifest.content_scripts[0].matches` from the site table (no `<all_urls>`); test manifest/table equality.
- [x] WP4.6 Re-run YouTube filtering on `yt-navigate-finish`.
- [x] WP4.7 Replace unconditional Shorts/Reels/TikTok hiding with `settings.contentFilters` toggles; existing users default ON for the three previously unconditional filters.
- [ ] WP4.8 Delete old `public/content.js` and `public/background.js` after WP3/WP4 replace them.

### Acceptance criteria

- [ ] WP4.AC1 Each filter toggle works and reverses without reload.
- [ ] WP4.AC2 Twenty cold `document_start` loads produce no console errors.
- [ ] WP4.AC3 Filters are off during breaks/outside blocking contexts and on during active schedules.
- [ ] WP4.AC4 Removing a keyword unhides matching items.
- [ ] WP4.AC5 Unsupported sites do not receive the content script.
- [ ] WP4.AC6 A YouTube home-feed mutation batch takes under 5 ms in the Performance panel.
- [ ] WP4.AC7 Claim C23 passes.

**Notes / progress:**
- 2026-10-28 — Re-credited the six staged WP4 implementation items WP4.2–WP4.7 from current tests/typecheck/build. WP4.1 remains open because every selector is still `verified: null` and no live selector inspection occurred; WP4.8 remains open because v1 public scripts are intentionally retained until the gated WP5 cutover. All seven runtime/performance acceptance criteria remain open.
- 2026-10-28 — Owner authorized staged WP4 work while WP3 remains 8/22. The active manifest and `src/content/index.ts` remain on v1; the v2 entry builds separately and is not registered.
- 2026-10-28 — WP4.2–WP4.7 are freshly verified at module/unit level. WP4.1 remains open because Appendix B requires live selector verification; all selector `verified` fields remain null.
- 2026-10-28 — WP4.8 and all WP4 acceptance criteria remain open until the WP5 atomic cutover and controlled browser verification. The old public scripts were not deleted.
- 2026-10-28 — Owner authorized continuing WP4 while deferring browser verification. Re-inspected the clean worktree and staged content controller; continue deterministic implementation/tests only, keep live selector/runtime checks open, and preserve v1 scripts until WP5.
- 2026-10-28 — Shared filter activity now follows work/standalone/active-schedule contexts independent of the blocked-site list; always-hide keywords remain active without turning on unrelated feed filters. Added deterministic planner/controller coverage; checks pending.
- 2026-10-28 — Restored dependencies with `npm ci` from the existing lockfile (125 packages); npm reported 4 vulnerabilities (2 moderate, 2 high). No package manifest/lockfile edits were made.
- 2026-10-28 — Focused verification passed: `npm test -- tests/shared/plan.test.ts tests/content/v2.test.ts` — exit 0, 2 files / 25 tests. Full suite, typecheck, and build remain pending.
- 2026-10-28 — `npm run typecheck` passed after the filter-context change; `tsc --noEmit` exited 0 with no diagnostics. Full suite and build remain pending.
- 2026-10-28 — Full unit suite passed: `npm test` — exit 0, 25 files / 145 tests. Build and staged-output checks remain pending.
- 2026-10-28 — `npm run build` exited 0 after transforming 2,079 modules. Output smoke check confirmed `dist/content-v2.js` exists while the manifest still activates `index.html` and `content.js`; the active v1 path is preserved.
- 2026-10-28 — Restarted the existing `FocusGate Extension Preview` after dependency restoration; logs show Vite 6.4.3 ready on port 3000. This confirms preview-server startup only, not extension/browser behavior.
- 2026-10-28 — Final scope audit passed: `git diff --check`; both v1 public scripts still exist; `package.json`, `package-lock.json`, the active manifest, and build script have no diff. Only the WP4 source/tests and tracker are modified.
- 2026-10-28 — Post-tracker-edit check passed: `git diff --check && git status --short --branch && git diff --stat` — exit 0; the same five expected files remain modified.

**Evidence:**

| Date | Item | Changed files | Verification | Result |
|---|---|---|---|---|
| 2026-10-28 | WP4 re-credit after owner correction | No source changes; ignored generated output only. | `npm run typecheck` — exit 0; `npm test` — exit 0, 30 files / 163 tests; `npm run build` — exit 0; output assertion confirms staged `content-v2.js` and active v1 `content.js`. | PASS — WP4.2–WP4.7 are verified at module/unit level; selector/browser acceptance and legacy removal remain open. |
| 2026-10-28 | WP4 staged content-script verification | `src/content/sites.ts`, `src/content/filterDom.ts`, `src/content/v2.ts`, `src/content/v2-entry.ts`, `src/shared/contentFilterDefaults.ts`, `src/shared/migrate.ts`, `src/shared/plan.ts`, `scripts/build-extension.mjs`, content/migration/planner tests. | `npm run typecheck` — exit 0; `npm test` — exit 0, 25 files / 140 tests; `npm run build` — exit 0; output check confirms `dist/content-v2.js` exists while `dist/manifest.json` still references `content.js`; `git diff --check` — exit 0. | PASS — staged implementation and migration defaults compile and pass deterministic tests. No live selector or browser behavior was verified. |
| 2026-10-28 | WP4 filter-context regression coverage | `src/shared/plan.ts`, `src/content/v2.ts`, `tests/shared/plan.test.ts`, `tests/content/v2.test.ts`, `fixes/TRACKER.md`. | `npm test -- tests/shared/plan.test.ts tests/content/v2.test.ts` — exit 0; 2 files / 25 tests passed. | PASS — covers focus/standalone/schedule activation independent of site-list membership, schedule-boundary deactivation, and always-hide keywords without unrelated CSS filters. Browser selectors/runtime remain unverified. |
| 2026-10-28 | WP4 strict typecheck | `src/shared/plan.ts`, `src/content/v2.ts`, `tests/shared/plan.test.ts`, `tests/content/v2.test.ts`. | `npm run typecheck` — exit 0; `tsc --noEmit` reported no diagnostics. | PASS — the shared context logic, staged controller, and added tests compile. |
| 2026-10-28 | WP4 full unit suite | All current test files; `fixes/TRACKER.md`. | `npm test` — exit 0; 25 files / 145 tests passed. | PASS — complete deterministic test suite passes; no browser behavior was exercised. |
| 2026-10-28 | WP4 staged build | Generated output under ignored `dist/`; `fixes/TRACKER.md`. | `npm run build` — exit 0; Node smoke assertion confirmed `dist/background.js`, `dist/content.js`, and `dist/content-v2.js` exist; `dist/manifest.json` routes to `index.html` and `content.js`. | PASS — v2 is built separately; active v1 worker/popup/content remain in place. |
| 2026-10-28 | WP4 extension preview startup | Existing preview workflow; `fixes/TRACKER.md`. | Restarted `FocusGate Extension Preview`; logs show `VITE v6.4.3 ready in 867 ms` and port 3000. | PASS — preview server is running; browser extension APIs/selectors were not exercised. |
| 2026-10-28 | WP4 final scope and worktree audit | `fixes/TRACKER.md`, WP4 implementation/test files. | `git diff --check && test -e public/content.js && test -e public/background.js && test -z "$(git diff -- package.json package-lock.json public/manifest.json scripts/build-extension.mjs)" && git status --short --branch && git diff --stat` — exit 0. | PASS — v1 scripts remain; no manifest/build/dependency files changed; five expected files are modified. |

**Failures / blockers:**
- 2026-10-28 — Appendix B selectors are not live-verified; keep `verified: null` until a controllable browser is available.
- 2026-10-28 — Runtime acceptance and old-script removal remain gated until WP5's atomic cutover.
- 2026-10-28 — First verification attempt after the owner-authorized WP4 continuation: `npm test -- tests/shared/plan.test.ts tests/content/v2.test.ts` exited 127 (`vitest: command not found`); `npm run typecheck` exited 127 (`tsc: command not found`). `git diff --check` exited 0. Restore dependencies from the existing lockfile before rerunning; no dependency declaration changes are authorized.
- 2026-10-28 — The package-install auto-restart of `FocusGate Extension Preview` failed with `sh: 1: vite: command not found`; `npm ci` has since restored dependencies. This is a preview startup failure, not browser-extension verification; restart the existing extension preview once and check its logs.
- 2026-10-28 — Resolved the preview startup failure: after `npm ci`, restarting `FocusGate Extension Preview` succeeded and Vite reported ready on port 3000. `FocusGate Docs Preview` remains failed but is unrelated to WP4; it was not restarted.
- 2026-10-28 — Resolved the missing-dependency check failures: `npm ci` restored dependencies; the focused tests, full suite, typecheck, and build then all passed. The original command failures are retained above.

**Decisions / deferred work:**
- Keep `public/content.js`, `public/background.js`, and the active v1 manifest unchanged until WP5.
- Run WP4 browser acceptance after WP5 cutover; do not claim C23 or performance results from unit tests.

---

## WP5 — UI foundation and screen fixes

**Plan:** §6 WP5, Appendix C · **Blocked by:** WP4 browser/runtime gates (owner authorized staged UI work only) · **Status:** IN PROGRESS · **Started:** 2026-10-28 · **Completed:** — · **Progress:** 11/18

### Tasks

- [x] WP5.1 Split pages: `popup.html` fixed at 380×580; full-viewport `blocked.html`; onboarding full tab with max-480px column; full-tab dashboard. Remove role query flags and old popup sizing classes. Block/onboarding render final screen on first paint.
- [x] WP5.2 Add `useStorage`/`StorageGate`: one per-page store via `useSyncExternalStore`, latest-value updaters, skeleton until all keys are ready, no default flicker or half-hydrated effects, `localStorage` only as Vite fallback, and no per-second rerenders except timer text.
- [x] WP5.3 Implement Appendix C tokens/components: Button, IconButton, Card, Toggle, Field, accessible Modal, Toast, ConfirmDialog, Tabs/Segmented, Chip, EmptyState, ProgressRing, PasswordField; dark/light themes, reduced motion, minimum 12px text, contrast ≥4.5:1; remove `pb-safe` and relative nav buttons.
- [x] WP5.4 Replace every `alert()` with Toast/ConfirmDialog; disabled actions explain why.
- [x] WP5.5 Implement information architecture: header status/protection indicators; Focus/Tasks/Rules/Stats/Settings tabs; Focus timer/Block now switch; Rules sections Sites/Exceptions/Keywords/Schedules/Limits; specified Settings sections.
- [x] WP5.6 Build Focus view: duration presets and string-state field committing on blur/Enter; lock control with descriptions and Appendix E.5 prevention summary; ring/countdown; lock-aware Start/Extend/Stop/Skip; inline hint when no sites are blocked.
- [x] WP5.7 Build Tasks view: lock only during linked task sessions; restart completed tasks; show date/time; remove scratch comment from `toggleTask`.
- [x] WP5.8 Build Rules view: site timing chips/live status, Check a URL, pasted-URL normalization, comma/newline keyword parsing and modes, always-visible delete controls, editable schedules including `24:00`, and Appendix F allowance UI.
- [x] WP5.9 Build block page: read URL from hash; use `explainBlock`; show countdown only for session/standalone; show today's block count; safe text rendering; working close/open-tab actions; no promo footer; “Block ended” flow for URLs no longer blocked; no popup bundle.
- [x] WP5.10 Implement onboarding Welcome → goal → presets/sites → optional password with honest tradeoffs → Protection check → Open FocusGate.
- [ ] WP5.11 Apply the replacement-copy table and review every string for the prohibited words: “completely,” “instantly,” “cannot,” “always,” and “guaranteed.”
- [ ] WP5.12 Complete accessibility pass: labels, focus-visible ring, modal focus traps, no color-only status, visual tab order, keyboard-only walkthrough.
- [ ] WP5.13 Delete `src/App.tsx` and `src/hooks/useChromeStorage.ts` after all views move; `npm run typecheck` is clean with strict mode.

### Acceptance criteria

- [ ] WP5.AC1 Popup remains exactly 380×580 on every tab with no size jump; block/onboarding show final UI on first paint under 4× CPU throttle.
- [x] WP5.AC2 `grep -R "alert(" src` returns nothing; tab closing does not use `window.close()`.
- [ ] WP5.AC3 Light/dark contrast passes; keyboard-only flow works; modals trap/restore focus; Lighthouse accessibility is at least 95 per built page.
- [ ] WP5.AC4 Typing “25” works naturally; `funny shorts, #gaming` creates two keywords; pasted Reddit URL stores `reddit.com`.
- [ ] WP5.AC5 All WP5 UI claims assigned from plan §4.7 pass.

**Notes / progress:**
- 2026-10-28 — Owner authorized continuing WP5 for remaining implementation and all non-browser verification, excluding browser checks. Keep the v1 runtime and atomic cutover gated; reconcile checklist counts against the current checkboxes before reporting.
- 2026-10-28 — Owner clarified that browser checks alone are environment-blocked. Always run tests, typecheck, build, and other applicable non-browser checks; this supersedes the prior interpretation that no verification should run. Running the available checks now.
- 2026-10-28 — Restored the existing dependency tree with `npm ci --no-audit`; exit 0, 125 packages added, no package manifest or lockfile changes.
- 2026-10-28 — `npm test` exited 127 because `vitest` is absent from the current workspace (`sh: line 1: vitest: command not found`). No tests ran. Restore dependencies from the existing lockfile, then rerun the required checks.
- 2026-10-28 — Reran `npm test` after the lockfile restore; exit 0, all 32 test files and 170 tests passed.
- 2026-10-28 — `npm run typecheck` exited 0; `tsc --noEmit` reported no diagnostics.
- 2026-10-28 — `npm run build` exited 0. The extension build emitted the active bundle plus the four staged UI pages and their assets under ignored `dist/`.
- 2026-10-28 — `git diff --check` exited 0 with no whitespace errors.
- 2026-10-28 — Current-source search found no `alert()` or `window.close()` references under `src/`; the block-page close action uses the extension tabs API. WP5.AC2 is verified by source checks; browser-specific criteria remain open. This supersedes earlier historical findings for the prior source state.
- 2026-10-28 — Static disabled-control audit found the staged dashboard backup buttons still relied on `title` tooltips only. WP5.4 remains open until those controls have an always-visible reason as well.
- 2026-10-28 — Added visible, screen-reader-linked backup-control guidance in the dashboard. A follow-up source audit found visible reasons for all currently disabled actions; rerun local checks before closing WP5.4.
- 2026-10-28 — Post-dashboard-change `npm test` exited 0; all 32 test files and 170 tests passed.
- 2026-10-28 — Post-dashboard-change `npm run typecheck` exited 0; no TypeScript diagnostics.
- 2026-10-28 — Post-dashboard-change `npm run build` exited 0; active extension bundle and all four staged UI pages emitted.
- 2026-10-28 — Post-dashboard-change `git diff --check` exited 0 with no whitespace errors.
- 2026-10-28 — Restarted `FocusGate Extension Preview`; workflow is RUNNING and Vite reported ready on port 3000. Startup log only; no browser interaction check was performed.
- 2026-10-28 — Closed WP5.4 after source review: no `alert()`/`window.close()` references remain under `src/`, and every current disabled action has visible reason/state text. The full test suite, typecheck, and build pass.
- 2026-10-28 — Continued the WP5.11 copy pass and aligned the staged Limits labels, caps, presets, and reset explanations with Appendix F. Updated Rules, manifest, metadata, and store-listing copy; the banned-word scan and local checks for these changes are pending.
- 2026-10-28 — Continued WP5 staged UI work under the owner's instruction not to run verification. Updated dialog descriptions/focus handling, visible explanations for disabled task and password controls, lock tradeoff copy, and Rules helper copy. No WP5 checkbox or acceptance criterion was closed; tests, typecheck, build, and browser checks were not run. Keep v1 active and cutover/legacy removal gated.
- 2026-10-28 — WP5 remains the current package. Re-credited staged UI implementation items WP5.1, .2, and .5–.10 after current source review plus fresh typecheck, 30-file/163-test suite, build, and staged-route assertions. No browser acceptance was claimed. WP5.3/.12 need contrast/accessibility verification; WP5.4 is not complete because `src/App.tsx` still contains `alert()`/`window.close()`; WP5.11 copy audit and WP5.13 atomic cutover/legacy removal remain open. The active manifest still routes to v1.
- 2026-10-28 — Closed WP5.3 after verifying the Appendix C component exports and implementations, theme/reduced-motion/focus styles, minimum text size, and no `pb-safe`; the theme-token and primitive tests passed in the 32-file/170-test suite. A token-pair contrast sweep passed with minimums 4.94:1 dark and 4.59:1 light. WP5.12's keyboard walkthrough and WP5.AC3 remain open; staged UI is not browser-verified.
- 2026-10-28 — Pre-fix staged UI audit: the light-theme warning token measured 4.33:1 on `surface-2`, below the 4.5:1 target; the dark-theme minimum was 4.94:1. CSS font sizes were at least 12px, and focus-visible/reduced-motion rules were present. WP5.3 remains open until contrast is corrected and regression-tested.
- 2026-10-28 — Legacy UI audit also found sub-12px text classes, stale/misleading copy, blocking `alert()` calls, a non-working `window.close()` action, and commitment-task delete locking outside its active session. Correcting these UI-only gaps without changing active v1 routes or state contracts; browser acceptance and cutover remain open.
- 2026-10-28 — Historical reset note: WP3/WP4 checkmarks were temporarily cleared after a reset. The current owner reconciliation above restored only evidence-backed work. UI remains staged; WP1b/WP4 browser gates still block v2 activation, migration startup, cutover, and legacy-consumer removal.
- 2026-10-28 — Fixed the storage hydration race: late initial-read success and failure results are ignored after a newer snapshot is published. Verification: focused storage tests 6/6, full suite 151/151 across 26 files, typecheck, and production extension build all passed.
- 2026-10-28 — Popup preview rendered at its 380×580 layout. Browser console reported one 404 resource; this preview smoke check does not satisfy the extension browser gates.
- 2026-10-28 — Owner authorized beginning WP5 staged UI work while WP1b and WP4 browser verification remain unavailable. This defers gates for implementation only; it does not authorize cutover, v2 activation, migration startup, or v1 removal.
- 2026-10-28 — Inspected the existing UI/build entrypoints and staged timer. Keep the active v1 `index.html`, `src/App.tsx`, manifest, worker, and content path in place until WP1b plus WP2–WP4 browser/runtime evidence permits the atomic cutover.
- 2026-10-28 — Added the first staged `useStorage`/`StorageGate` implementation with a per-page external store, latest-value serialized updates, storage change subscriptions, and localStorage fallback only when the extension storage API is absent. Typecheck and store tests pending.
- 2026-10-28 — `npm run typecheck` passed for the staged storage hook and gate with `tsc --noEmit` exit 0. Behavior tests and page integration remain pending.
- 2026-10-28 — Added storage-store tests for hydration gating, latest-value updaters, cross-context changes, and the localStorage fallback boundary. The focused UI-storage suite is pending.
- 2026-10-28 — `npm test -- tests/ui/storageStore.test.ts` passed (1 file / 4 tests). Storage primitives behave as expected in deterministic tests; the WP5.2 checklist remains open until page integration and timer-render isolation are complete.
- 2026-10-28 — Fresh `npm run typecheck` initially exited 127 (`tsc: not found`) because local dependencies were absent. `npm ci` restored 125 packages from the existing lockfile and exited 0; npm reported 4 vulnerabilities (2 moderate, 2 high). No package manifest or lockfile changes were made. Rerun `npm run typecheck` exited 0 with no diagnostics; `npm test` exited 0 (30 files / 163 tests); `npm run build` exited 0 and emitted the active v1 bundle plus staged UI pages. The manifest remains on the v1 popup/worker/content routes; browser acceptance is still open.
- Follow Appendix C and the replacement-copy table in plan §6 WP5.

**Evidence:**

| Date | Item | Changed files | Verification | Result |
|---|---|---|---|---|
| 2026-10-28 | WP5.11 copy and WP5.8 Limits refinements | `src/ui/popup/RulesView.tsx`; `public/manifest.json`; `metadata.json`; `STORE_LISTING.md` | Pending. | UNVERIFIED — source changes are applied; banned-word audit and full local checks are next. |
| 2026-10-28 | WP5.4 and WP5.AC2 close-out | `src/ui/components/feedback.tsx`; `src/ui/popup/TasksView.tsx`; `src/ui/popup/FocusView.tsx`; `src/ui/popup/SettingsView.tsx`; `src/ui/dashboard/DashboardPage.tsx` | `rg -n 'alert\\s*\\(|window\\.close\\s*\\(' src` — no matches; `rg -n -C 2 'disabled' src/ui` — reviewed visible reasons; `npm test` — 32 files / 170 tests; `npm run typecheck` — exit 0; `npm run build` — exit 0. | PASS — native alert/close calls are absent and disabled actions explain their current state. Browser acceptance remains open. |
| 2026-10-28 | WP5 final native-alert source check | None. | `rg -n 'alert\\s*\\(|window\\.close\\s*\\(' src` — no matches. | PASS — current source still contains no native alert or `window.close()` references. |
| 2026-10-28 | WP5 extension preview startup | No source changes; workflow restart only. | Restarted `FocusGate Extension Preview`; `RefreshAllLogs` reported RUNNING and Vite ready on port 3000. | PASS — preview server starts; browser acceptance remains environment-blocked and unclaimed. |
| 2026-10-28 | WP5 post-dashboard whitespace check | None. | `git diff --check` — exit 0; no output. | PASS — current diff has no whitespace errors. |
| 2026-10-28 | WP5 post-dashboard build | Ignored `dist/` outputs only. | `npm run build` — exit 0; active extension bundle plus staged onboarding, blocked, popup, and dashboard pages emitted. | PASS — build succeeds; browser-specific acceptance remains open. |
| 2026-10-28 | WP5 post-dashboard typecheck | None. | `npm run typecheck` — exit 0; no TypeScript diagnostics. | PASS — dashboard helper and current project source typecheck. |
| 2026-10-28 | WP5 post-dashboard test suite | None. | `npm test` — exit 0; 32 files / 170 tests passed. | PASS — full suite remains green after the dashboard helper change. |
| 2026-10-28 | WP5 disabled-control source audit — follow-up | `src/ui/dashboard/DashboardPage.tsx` | `rg -n -C 2 'disabled' src/ui` — reviewed all matches after adding shared visible helper text and `aria-describedby`. | PASS — all current disabled controls have visible state/reason text or helper copy; WP5.4 awaits final local checks. |
| 2026-10-28 | WP5 disabled-control source audit | None. | `rg -n -C 2 'disabled' src/ui` — reviewed all matches. | OPEN — dashboard backup buttons have tooltip-only explanations; make the reason visible before closing WP5.4. |
| 2026-10-28 | WP5.AC2 source checks | None. | `rg -n 'alert\\s*\\(|window\\.close\\s*\\(' src` — no matches; source review confirms close-tab action uses the extension tabs API. | PASS — static acceptance is satisfied; no browser claim is made. |
| 2026-10-28 | WP5 source whitespace check | None. | `git diff --check` — exit 0; no output. | PASS — no whitespace errors in the current diff. |
| 2026-10-28 | WP5 post-change build | Ignored `dist/` outputs only. | `npm run build` — exit 0; active extension bundle and staged onboarding, blocked, popup, and dashboard outputs emitted. | PASS — production build succeeds; this does not establish browser behavior or authorize cutover. |
| 2026-10-28 | WP5 post-change typecheck | None. | `npm run typecheck` — exit 0; no TypeScript diagnostics. | PASS — current project typechecks. |
| 2026-10-28 | WP5 post-change test suite — rerun | None. | `npm test` — exit 0; 32 files / 170 tests passed. | PASS — the full test suite passes after restoring dependencies. |
| 2026-10-28 | Lockfile dependency restore | `node_modules/` only (ignored); manifests and lockfile unchanged. | `npm ci --no-audit` — exit 0; 125 packages added. | PASS — dependencies restored from the existing lockfile so local checks can run. |
| 2026-10-28 | WP5 post-change test suite — attempt 1 | None; no test code ran. | `npm test` — exit 127; `vitest: command not found`. | BLOCKED — local dependencies are absent. Lockfile-based restore and rerun pending. |
| 2026-10-28 | WP5 staged accessibility and copy updates | `src/ui/components/feedback.tsx`; `src/ui/popup/TasksView.tsx`; `src/ui/popup/FocusView.tsx`; `src/ui/popup/SettingsView.tsx`; `src/ui/popup/RulesView.tsx` | Not run per owner instruction. | Changes applied; unverified. No WP5 checkbox or acceptance criterion was closed. |
| 2026-10-28 | WP5 staged UI re-credit after owner correction | No source changes; generated output remains ignored. | `npm run typecheck` — exit 0; `npm test` — exit 0, 30 files / 163 tests; `npm run build` — exit 0; Node route assertions confirm four staged pages while manifest remains on v1; source review confirms separate popup/blocked/onboarding/dashboard UI, storage gates, Rules/Focus/Tasks screens, and block-page actions. | PASS — WP5.1/.2/.5–.10 are credited as staged implementation. Browser/a11y/copy/cutover criteria remain open; legacy `src/App.tsx` still has alerts. |
| 2026-10-28 | Staged storage primitive tests | `src/ui/hooks/storageStore.ts`, `src/ui/hooks/useStorage.ts`, `src/ui/components/StorageGate.tsx`, `tests/ui/storageStore.test.ts`. | `npm run typecheck` — exit 0; `npm test -- tests/ui/storageStore.test.ts` — exit 0, 1 file / 4 tests. | PASS — per-page storage store/gate, latest-value updater, external changes, and fallback boundary covered. Page integration and timer-render isolation remain pending; no WP5 task checkbox closed. |
| 2026-10-28 | Fresh workspace typecheck | No source changes; dependencies restored from the existing lockfile. | `npm ci` — exit 0, 125 packages added; `npm run typecheck` — exit 0, no TypeScript diagnostics. | PASS — current source typechecks. The initial missing-dependency failure and npm audit result (4 vulnerabilities: 2 moderate, 2 high) are recorded in Notes / progress. |
| 2026-10-28 | Fresh full test suite | No source changes; dependencies restored from the existing lockfile. | `npm test` — exit 0; 30 files / 163 tests passed. | PASS — current deterministic suite is green; browser-dependent acceptance remains unverified. |
| 2026-10-28 | Fresh extension build | No source changes; generated output remains under ignored `dist/`. | `npm run build` — exit 0; Vite emitted the active `dist/index.html` and separately emitted staged popup, blocked, onboarding, and dashboard pages under `dist/staged-ui/`. | PASS — build succeeds, while the manifest remains on v1 routes; no cutover or browser behavior is established. |
| 2026-10-28 | WP5 checks — initial attempt | No source changes. | `npm test` — exit 127 (`vitest: command not found`); `npm run typecheck` — exit 127 (`tsc: command not found`); `npm run build` — exit 1 (`ERR_MODULE_NOT_FOUND` for `esbuild`). | BLOCKED — local dependencies are absent; restore from the existing lockfile, then rerun all three checks. |
| 2026-10-28 | WP5 dependency restore | `node_modules/` only (ignored). | `npm ci --no-audit` — exit 0; 125 packages added from the existing lockfile. | PASS — package manifests and lockfile were not changed; project checks can be rerun. |
| 2026-10-28 | WP5 full verification after dependency restore | Generated `dist/` output only; `node_modules/` is ignored. | `npm test` — exit 0 (32 files / 170 tests); `npm run typecheck` — exit 0; `npm run build` — exit 0, including active v1 bundle and staged popup/blocked/onboarding/dashboard pages. | PASS — non-browser checks are green; the build does not activate v2 or establish browser behavior. |
| 2026-10-28 | WP5 staged output, token contrast, and preview startup | Generated `dist/` output only; existing extension workflow restarted. | Node output assertions found four staged HTML pages plus `content-v2.js` while the manifest still targets v1; contrast token matrix passed 21 foreground/background pairs per theme (minimum 4.94:1 dark, 4.59:1 light; primary button 5.84:1/5.48:1); `FocusGate Extension Preview` restarted and Vite reported ready on port 3000. | PASS — staged build routing, defined token combinations, and preview startup are verified; no browser interaction or extension API behavior was tested. |
| 2026-10-28 | WP5 source-audit command attempt | No source changes. | Static source assertion reached the final `rg` with incorrect path `src/ui/Tabs.tsx`; exit 2 (`No such file or directory`). | FAIL — prior assertions found no native alert/close APIs or sub-12px staged styles, but the grouped command is not a clean pass; rerun with the actual `src/ui/components/Tabs.tsx` path. |
| 2026-10-28 | WP5 corrected static source audit | `fixes/TRACKER.md` only. | Source assertions passed: no `alert()`/`window.close()` in `src`, no `pb-safe`/legacy popup sizing/sub-12px text in `src/ui`, and required focus-visible, reduced-motion, relative-nav, modal, tabs, and icon-label markers are present. Copy scan found no `completely`, `instantly`, `cannot`, or `guaranteed`; `Always` occurrences are the documented Always-blocked/keyword feature labels. | PASS — these static items are verified; exact replacement-copy mapping and runtime keyboard interactions remain open. |
| 2026-10-28 | WP5.11 cross-version copy audit | No source changes. | `rg -n -i 'completely|instantly|cannot|guaranteed|fullscreen|time remaining|close tab|start focusing|no limit|whitelist|inaccessible|social media, video, news|always blocked|blocks all configured' src/ui src/App.tsx public/manifest.json metadata.json STORE_LISTING.md` — staged UI uses the revised copy, but active `src/App.tsx` still contains legacy fullscreen handling/wording, `Close Tab`, and standalone “No limit” wording (up to 1000 hours). | OPEN — active v1 remains in place pending the cutover gate; do not remove or route around it here. Cross-version copy review is not signed off. |
| 2026-10-28 | WP5 repository hygiene | No source changes. | `git diff --check` — exit 0; `git diff -- package.json package-lock.json` — no changes; `git status --short --branch` showed only `fixes/TRACKER.md` modified. | PASS — dependency restore and build artifacts did not alter tracked package files; no whitespace errors. |
| 2026-10-28 | WP5.3 Appendix C implementation and contrast | No source changes; staged `src/ui` and generated `dist/` only. | `npm test` — exit 0 (32 files / 170 tests, including theme-token and primitive tests); `npm run typecheck` — exit 0; `npm run build` — exit 0; component/source audit confirmed the listed primitives, theme modes, reduced motion, focus styles, 12px floor, relative nav, modal keyboard/focus implementation, and no `pb-safe`; contrast sweep passed 21 text/background token pairs per theme (dark minimum 4.94:1, light 4.59:1). | PASS — implementation task WP5.3 is checked. Keyboard-only walkthrough and browser accessibility score remain explicitly open under WP5.12/WP5.AC3. |
| 2026-10-28 | WP5 progress reconciliation | No source changes. | Checklist script verified WP5 = 11/18 and overall = 53/156 (34%); `git diff --check` — exit 0; package manifests/lockfile unchanged. `git status` also showed `.replit` modified unexpectedly; inspect before finalizing. | OPEN — progress counts agree, but the workflow/config diff must be reviewed to determine whether it belongs to this task. |
| 2026-10-28 | WP5 config cleanup attempt | No source changes. | `git diff -- .replit` showed only `python-base-3.13` added to the existing modules; direct `functions.apply_patch` restore was rejected by the Replit configuration guard, and no file changed. | OPEN — restore the prior TOML through `verifyAndReplaceDotReplit` using a validated temporary file, then confirm only the tracker remains modified. |

**Failures / blockers:**
- WP1b browser spikes and WP4 live-selector/runtime acceptance remain unverified; these block the WP5 atomic cutover and M1 green.
- Keep all affected browser acceptance criteria open until evidence from the controlled browser is recorded.

**Decisions / deferred work:**
- Stage UI pages/components and deterministic checks without changing the active v1 popup/manifest/worker/content entrypoints.
- Defer v2 activation, `ready()` migration on runtime entrypoints, legacy consumer deletion, and atomic cutover until the browser gates pass.

---

## WP6 — Security, standalone, protection status, backup

**Plan:** §6 WP6, Appendices D–E · **Blocked by:** WP5 · **Status:** NOT STARTED · **Started:** — · **Completed:** — · **Progress:** 0/17

### Tasks

- [ ] WP6.1 Implement PBKDF2-SHA256 with 600,000 iterations and 16-byte salt; verify/upgrade legacy hashes; generate 20–28 character ambiguity-free passwords with `crypto.getRandomValues`.
- [ ] WP6.2 Require custom passwords of 8–64 characters with strength hint and “Generate (recommended)” option.
- [ ] WP6.3 Implement PasswordField: visible by default, setup copy/paste allowed, unlock paste blocked but autofill allowed, disabled below 8 characters.
- [ ] WP6.4 Implement one `guard(action, state)` returning Appendix E outcomes; UI explains/disables and background messages enforce it; test every action/state combination.
- [ ] WP6.5 Implement Appendix D standalone Block now: own list, absolute 5-minute–30-day expiry, append-only while active, extend/add only, live countdown, confirmation, no “No limit”; remove old card/keys/functions and every stop path.
- [ ] WP6.6 Add Protection status for incognito, host permission, notifications, heartbeat, reconcile/error, DNR count, recent gaps, settings link, and the limitations from plan §3.
- [ ] WP6.7 Implement backup that excludes password/runtime secrets, validates versions/unknown keys, caps at 2 MB, previews counts, and merges safely; empty-state restore allowed without password; no Replace button; reset requires password and typed confirmation and is refused during lock.
- [ ] WP6.8 Add dark/light/system theme and 0.9–1.2 font scale settings.

### Acceptance criteria

- [ ] WP6.AC1 Background (not only UI) rejects incorrect password.
- [ ] WP6.AC2 Removing an allowance, exception, or site asks for password when one is set.
- [ ] WP6.AC3 Legacy hashes unlock and upgrade on successful verify, covered by fixture.
- [ ] WP6.AC4 No UI, shortcut, or message can end standalone early; it can be extended/added to with popup closed; refused weakening actions explain themselves.
- [ ] WP6.AC5 Export → reset → import restores data into empty state.
- [ ] WP6.AC6 Import into working state only adds/strengthens, reports skipped data and works during a lock.
- [ ] WP6.AC7 Reset is refused during a lock.
- [ ] WP6.AC8 Protection card reports missing incognito access and host permission, including Firefox behavior.
- [ ] WP6.AC9 Appendix E.4 `guard()` matrix is fully covered by table-driven unit test.

**Notes / progress:** Not started. Follow Appendices D and E for lock and destructive-action behavior.

**Evidence:** No verified evidence recorded.

**Failures / blockers:** None recorded for this reset.

**Decisions / deferred work:** None recorded.

---

## WP7 — Feature ports from Android and PC

**Plan:** §6 WP7 · **Blocked by:** M1 green · **Status:** NOT STARTED · **Started:** — · **Completed:** — · **Progress:** 0/20

**Scope note:** Tier C is backlog and requires an owner request. Do not implement anything on the plan's “Do not port” list.

### Tier A

- [ ] WP7.A1 Quick block: header button, `block-current-site` (Alt+Shift+B), optional context menu; add normalized domain/alias group to Sites or Always; remember choice; show toast; disable with reason on non-HTTP(S) tabs.
- [ ] WP7.A2 Always-blocked list enforced 24/7; Rules › Sites has During focus/Always segments; removal is password-gated; precedence follows Appendix A.3.
- [ ] WP7.A3 Add confirmed built-in/custom presets (Social, Video, News, Shopping, Gaming, Messaging, Deep focus); onboarding can preselect; never apply silently.
- [ ] WP7.A4 Add short/long break, cycles-before-long, auto-start-next (defaults 5/15/4/off), and default session length settings.
- [ ] WP7.A5 Add +10/15/20/30/45/60 minute session extensions at all lock levels and record extensions in history.
- [ ] WP7.A6 Add full task fields and in-place edit/restart; idempotent recurring-task generation; alarm-based reminder chain; supported “Start now” action; optional `autoStartTasks` defaults off.
- [ ] WP7.A7 Add custom block message and daily rotating quotes/toggle; optional WebAudio block-page tone defaults off.
- [ ] WP7.A8 Add one Settings toggle per Appendix B content filter.
- [ ] WP7.A9 Add notification toggles for session/break end, task reminders, weekly report, and achievements; editable offsets; request permission lazily.
- [ ] WP7.A10 Show alias chips (e.g. x.com also blocks twitter.com/t.co); allow individual alias removal while preserving exclusions on edits.
- [ ] WP7.A11 Add Check a URL with Blocked/Allowed, reason from `explainBlock`, next change time, and Why? links on blocked-site rows.
- [ ] WP7.A12 Add task time windows, running/next task card, Today grouping/day navigation, task-linked session duration, end-of-task notification, and “will be blocked” summary.

### Tier B

- [ ] WP7.B1 Add work-phase debrief card and notification copy.
- [ ] WP7.B2 Add the selected achievements, evaluated by the background.
- [ ] WP7.B3 Add a last-50 keyword match log with Clear action.
- [ ] WP7.B4 Add allow-only mode per task, requiring at least one allowed domain; never affect extension/non-HTTP(S) pages; never emit an empty excluded-domain list.
- [ ] WP7.B5 Add optional daily mood (1–5)/note and off-by-default end-of-day notification.
- [ ] WP7.B6 Add habit list, emoji, daily check-in, per-habit streak, and dashboard card.
- [ ] WP7.B7 Add allowance heads-up at five minutes/10% remaining and exhaustion; optional badge; session badge takes precedence.

### Acceptance criteria

- [ ] WP7.AC Every Tier A item works end-to-end in Chrome/Edge and supported Firefox APIs; reminders fire at the right time after restart; a 14:00 task shows 13:50/13:55/13:59 and at-start notifications; recurring tasks create one instance per day; presets require confirmation; C01 and C13/C14 pass.

**Notes / progress:** Not started. Do not begin before M1 is green.

**Evidence:** No verified evidence recorded.

**Failures / blockers:** None recorded for this reset.

**Decisions / deferred work:** None recorded.

---

## WP8 — Stats, insights, reports

**Plan:** §6 WP8 · **Blocked by:** WP7 Tier A · **Status:** NOT STARTED · **Started:** — · **Completed:** — · **Progress:** 0/8

- [ ] WP8.1 Build Dashboard › Stats with Today/Week/Month, actual `elapsedMs`, inline-SVG daily chart, daily goal/ring, focus score, streaks, and specified insights.
- [ ] WP8.2 Add popup mini stats: today's focus, streak, goal ring, and five latest sessions.
- [ ] WP8.3 Schedule the next local Monday 09:00 weekly report once through `ensureAlarms()`; use last-seven-day totals and non-floored hours/minutes; store the latest and last eight reports; show them in Dashboard › Reports.
- [ ] WP8.4 Prune sessionHistory (500), dayStats (400 days), and recentBlocks (200) during midnight alarm.
- [ ] WP8.AC1 Stats show UI-started sessions immediately.
- [ ] WP8.AC2 Fixture generator and aggregate tests match hand-calculated seeded values.
- [ ] WP8.AC3 Weekly report alarm scheduled time remains unchanged across at least 20 worker restarts.
- [ ] WP8.AC4 Streak/score match formulas and no chart library is added.

**Notes / progress:** Not started.

**Evidence:** No verified evidence recorded.

**Failures / blockers:** None recorded for this reset.

**Decisions / deferred work:** None recorded.

---

## WP9 — QA hardening

**Plan:** §6 WP9, §8 · **Blocked by:** WP8 · **Status:** NOT STARTED · **Started:** — · **Completed:** — · **Progress:** 0/6

- [ ] WP9.1 Run the full manual matrix in plan §8.2 on Chrome, Edge, and Firefox temporary add-on; record failures by browser.
- [ ] WP9.2 Run plan §8.3 lifecycle checks: worker stop, mid-session stop, browser restart, suspend/resume across session end/schedule boundary, clock moved back ten minutes, 20 restarts with stable alarm times, and 10,000-event burst without duplicate IDs or exceeding recentBlocks cap.
- [ ] WP9.3 Measure idle worker CPU, content-script batch time, popup open time, and storage after 90 days of seeded data against plan budgets.
- [ ] WP9.4 Cover all plan §8.5 edge cases EC01–EC54 with test or manual check.
- [ ] WP9.5 Fix verified issues found; do not add features.
- [ ] WP9.AC Plan §8.2 and §8.3 pass and every §8.4 claim regression is green.

**Notes / progress:** Not started. No new features in this work package.

**Evidence:** No verified evidence recorded.

**Failures / blockers:** None recorded for this reset.

**Decisions / deferred work:** None recorded.

---

## WP10 — Release

**Plan:** §6 WP10 · **Blocked by:** WP9 · **Status:** NOT STARTED · **Started:** — · **Completed:** — · **Progress:** 0/9

### Tasks

- [ ] WP10.1 Set version `1.1.0` in manifest and `package.json`; update changelog with migration and behavior changes.
- [ ] WP10.2 Make `STORE_LISTING.md` truthful, add permission justification table, and publish `docs/privacy-policy.html` with accurate local-data/no-network statements.
- [ ] WP10.3 Capture new popup, onboarding, and block-page store screenshots.
- [ ] WP10.4 Run `npm run package:all`; install all three packages and smoke-test start session → blocked site → block page → end session.
- [ ] WP10.5 Upgrade a real v1 profile containing sites, schedules, allowances, tasks, password, and history; verify nothing is lost.

### Acceptance criteria

- [ ] WP10.AC1 The three ZIPs install.
- [ ] WP10.AC2 The v1 upgrade test passes.
- [ ] WP10.AC3 Every plan §4.7 row is verified or its copy is changed.
- [ ] WP10.AC4 No `alert()`, content-script `<all_urls>`, or network-call APIs (`fetch`, `XMLHttpRequest`, `WebSocket`) appear in release bundles.

**Notes / progress:** Not started.

**Evidence:** No verified evidence recorded.

**Failures / blockers:** None recorded for this reset.

**Decisions / deferred work:** None recorded.

---

## Claims regression C01–C40

Track these final user-facing claim checks separately from the WP progress count. A claim passes only when observed against the final UI and behavior.

- [ ] C01 Presets and store/manifest descriptions match.
- [ ] C02 Bundles contain no network calls; injection scope and privacy policy match.
- [ ] C03 Popup-started sessions update history and today's focus time.
- [ ] C04 Every file mentioned by README/scripts exists or its reference is removed.
- [ ] C05 Popup is 380 × 580 on every tab.
- [ ] C06 Session ends on time with popup closed.
- [ ] C07 Strict-lock copy matches behavior; no fullscreen claim.
- [ ] C08 Commitment session cannot be stopped early and ends by itself.
- [ ] C09 Break advances with popup closed and filters are off during breaks.
- [ ] C10 Task-linked session completes correctly with popup closed.
- [ ] C11 Shortcut starts correctly and refuses to stop a locked session.
- [ ] C12 Duration input works naturally.
- [ ] C13 Timed task reminders fire as described.
- [ ] C14 Task empty-state copy and dated/recurring tasks are accurate.
- [ ] C15 Commitment task can be deleted when its session is not running.
- [ ] C16 Site-blocking copy matches observed behavior.
- [ ] C17 `x.com` and `twitter.com` aliases work and copy is current.
- [ ] C18 Always-blocked list works outside sessions and copy matches.
- [ ] C19 Exception matching allows only the intended video.
- [ ] C20 Refused exception changes during standalone block are explained.
- [ ] C21 Keyword behavior matches the UI description.
- [ ] C22 Comma-separated keywords create separate entries.
- [ ] C23 Hiding works, reverses without reload, and follows breaks/schedules.
- [ ] C24 Schedules start/end without user action.
- [ ] C25 Schedule blocks exactly its selected lists.
- [ ] C26 Stats accurately show today's focus and session outcomes.
- [ ] C27 One navigation counts as one blocked attempt.
- [ ] C28 Session history includes UI-started sessions.
- [ ] C29 Password copy and gated actions match.
- [ ] C30 Lock `none` is described as unprotected.
- [ ] C31 Password generation uses `crypto.getRandomValues`; legacy hashes upgrade.
- [ ] C32 Standalone copy matches finite expiry, own list, extend/add only, and no early stop.
- [ ] C33 Allowance copy, usage, and removal behavior match.
- [ ] C34 Onboarding's final button does what it says.
- [ ] C35 Onboarding includes presets and a protection check.
- [ ] C36 Block-page headline gives the real reason.
- [ ] C37 Countdown appears only for session/standalone reasons and is accurate.
- [ ] C38 “Blocks today” matches the actual count.
- [ ] C39 Close-tab action closes the tab.
- [ ] C40 Promo link is in About, not on the block page.

---

## Definition of Done

Tick each item only after the stated evidence has been observed and recorded in the relevant WP above.

- [ ] `npm run typecheck`, `npm test`, and `npm run build` pass.
- [ ] No `alert(` remains in `src/`.
- [ ] No `localStorage` is used outside the Vite development fallback.
- [ ] No authoritative module-level state remains in `src/background`.
- [ ] No per-second storage writes occur during a running session.
- [ ] Every new string passes the banned-word check in plan Appendix C.6.
- [ ] Manifest permissions match the justification table.
- [ ] `CHANGELOG.md` is updated.

---

## Batch / phase history

Append dated entries; do not replace earlier history.

| Date | Work item | Progress, decision, failure, blocker, or deferred work | Evidence / outcome |
|---|---|---|---|
| 2026-10-28 | WP4 staged content script | Added the Appendix B data table, v2 content controller, reversible CSS/keyword hiding, observer lifecycle, migration defaults, and separate staged build while preserving the active v1 entry. | `npm run typecheck`, `npm test` (25 files / 140 tests), `npm run build`, active-manifest bundle check, and `git diff --check` passed. WP4 remains 6/15; live selector and runtime acceptance are open. |
| 2026-10-28 | WP3 owner-authorized verification scope | Completed fresh deterministic checks while deferring browser verification. Kept S1/atomic-cutover gate closed and left UI/cutover task items open. | `npm ci`, `npm run typecheck`, `npm test` (23 files / 123 tests), `npm run build`, and `git diff --check` passed. No browser behavior was tested. |
| 2026-10-28 | WP3.5 planner alias-group coverage | Added an end-to-end pure-plan assertion that one alias-group member blocks the other members. | `npm test -- tests/shared/plan.test.ts` — exit 0; 1 file / 12 tests passed. WP3.5 remains incomplete due to deferred UI chip integration. |
| 2026-10-28 | WP3.4 scheduled-domain validation gap | Reconcile checked schedule shape but did not report invalid `sites[]` values within an otherwise valid schedule; added validation that reports malformed entries without discarding good ones. | `npm test -- tests/background/reconcile.test.ts` — exit 0; 1 file / 7 tests passed. WP3.4 remains unchecked pending its user-facing inline validation portion. |
| 2026-10-28 | Final WP3 working-tree review | Reviewed the completed diff and tracker counts after the module work. | `git diff --check && git status --short --branch && git diff --stat` — exit 0; four expected modified files; no whitespace errors. |
| 2026-10-28 | Docs preview restart | Restarted the existing docs preview after restoring dependencies. | Logs show Vite ready at port 5000; GitHub Sync was not started. |
| 2026-10-28 | Extension preview smoke | Restarted the configured extension preview after code/package checks. | Vite ready on port 3000; root UI rendered in screenshot. Browser console showed one unspecified 404; no extension API was exercised. |
| 2026-10-28 | Fresh post-change extension build | Built with the existing project script; no generated files were hand-edited. | `npm run build` — exit 0; 2,079 modules transformed; extension assets emitted. |
| 2026-10-28 | Fresh post-change WP3 typecheck | Checked the attention opt-in behavior and schedule global-list test. | `npm run typecheck` — exit 0; no TypeScript diagnostics. |
| 2026-10-28 | Fresh full repository tests | Ran the entire Vitest suite after WP3 attention and global-list changes. | `npm test` — exit 0; 23 files / 121 tests passed. |
| 2026-10-28 | WP3 schedule global-list coverage | Added a behavior test for an active schedule toggling between its own list and the live global list. | `npm test -- tests/shared/plan.test.ts` — exit 0; 1 file / 11 tests passed. WP3.6 freshly verified at module/unit level. |
| 2026-10-28 | Fresh WP3 module task verification | Re-ran the full focused WP3 unit suite after the attention fallback correction. | 12 files / 67 tests passed. WP3.2, .3, .7, .8, .9, .11, .12 freshly verified; .6 needs global-list behavior coverage; S1/browser and UI integration remain gated. |
| 2026-10-28 | WP3 attention fallback correction | Source review showed default audio accounting contradicted the conservative WP1b S2 fallback. Changed the staged sampler to require explicit opt-in and added tests for default-off and opted-in behavior. | `npm test -- tests/background/attention.test.ts` — exit 0; 1 file / 8 tests passed. Combined suite still pending; no browser activation. |
| 2026-10-28 | Fresh WP3 focused tests | Ran the staged WP3 module suites after restoring dependencies. | The 12-file Vitest command exited 0; 66 tests passed. It did not load the extension in a browser; S1 remains unresolved. |
| 2026-10-28 | Fresh WP3 typecheck | Ran the current checkout after restoring dependencies from the lockfile. | `npm run typecheck` — exit 0; `tsc --noEmit` reported no diagnostics. |
| 2026-10-28 | Fresh dependency restore | Reinstalled the existing npm lockfile dependencies; no dependency declarations were changed. | `npm ci` — exit 0; 125 packages added. npm reported 4 vulnerabilities (2 moderate, 2 high). |
| 2026-10-28 | WP3 continuation start | Owner supplied the WP3 checklist and authorized continuing WP3. Reset counted completion to 0/156 pending fresh verification. | WP3 is IN PROGRESS at 0/22. Historical evidence is retained but not credited; S1 still blocks runtime enforcement. |
| 2026-10-28 | Tracker reset and WP3 continuation authorized | Owner reiterated that prior completion claims are invalid and authorized continuation of WP3. All prior checklist marks are reset to 0/156; history is retained but not credited. | WP3 remains staged; fresh source inspection and verification required. S1 continues to gate runtime enforcement. |
| 2026-10-28 | WP3 fresh source assessment | Re-inspected current planning, DNR, reconcile, recording, navigation, and alarm modules. | Existing pure/staged modules remain in place; attention sampling, keyword-match persistence, and planning-boundary/report/midnight alarm scheduling need implementation. The v1 bridge remains active. |
| 2026-10-27 | Tracker reset | Owner clarified that prior completion claims were inaccurate. Reset all work-package and final-gate progress to NOT STARTED / unchecked; retained the planned work for later completion. | No app code or tests changed as part of this reset. Previous completion claims are not credited; re-check current files and record fresh evidence after authorization. |
| 2026-10-27 | WP0 started | Owner authorized WP0. Set WP0 to IN PROGRESS before inspection. | Repo inspection and verification pending. |
| 2026-10-27 | WP0.1–WP0.5 current-state audit | Verified the package manifest, repo hygiene, support files, baseline typecheck, Vitest smoke test, and changelog against the current checkout. | WP0.1–WP0.5 marked verified based on observed files/commands; no implementation files required edits. |
| 2026-10-27 | WP0 test gate | `npm ci` and `npm run typecheck` passed; `npm test` ran but had one failure in an existing session test. | 123 packages installed; typecheck exit 0; test suite 14/15 passed. WP0.AC remains open and WP0 is blocked at its boundary. |
| 2026-10-27 | Session failure investigation authorized | Owner authorized investigation of the failing session recovery test. | Scope is read-only until any behavior change is separately authorized. |
| 2026-10-27 | Session failure diagnosis | Recovery records an interrupted work phase, but the current transition still starts a configured break; the test expects the interrupted session to end idle. | Inspected `tests/shared/session.test.ts`, `src/shared/session.ts`, `src/shared/defaults.ts`, and plan §6 WP2 / §8.3. No code or test changes made; behavior choice is pending owner direction. |
| 2026-10-27 | Narrow session-recovery exception authorized | Owner directed “do the best practice” after the recovery behavior question; end an interrupted work phase immediately rather than starting a break. | One transition fix and focused verification are authorized; do not start other WP2 work or mark WP2 complete. |
| 2026-10-27 | Focused rerun after recovery fix | The original interrupted-work assertion passes; the prior catch-up test now stops at the interrupted work phase rather than reaching ten transitions. | `npm test -- tests/shared/session.test.ts` — 4/5 passed, 1 failure in the obsolete catch-up expectation. Update only that test expectation before rerunning. |
| 2026-10-27 | Recovery expectation updated | Changed `tests/shared/session.test.ts` to expect immediate idle after a recovered work phase is interrupted. | Test edit follows the owner's best-practice direction; focused rerun pending. |
| 2026-10-27 | Focused recovery tests passed | Session transition suite passes after the narrow interruption behavior and expectation update. | `npm test -- tests/shared/session.test.ts` — 5/5 passed. Full-suite/typecheck checks remain required for WP0.AC. |
| 2026-10-27 | Post-fix typecheck passed | Production TypeScript typecheck passed after the recovery code/test update. | `npm run typecheck` — exit 0. |
