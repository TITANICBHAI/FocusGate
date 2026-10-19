# FocusGate implementation tracker

**Specification:** [`focusgate-extension-implementation-plan.md`](focusgate-extension-implementation-plan.md)  
**Project instructions:** [`../replit.md`](../replit.md)  
**Authorization state:** **WP0 authorized by the owner; this batch is in progress.** Other work packages remain gated by the plan and tracker.  
**Creation-time snapshot:** Planning package setup is complete; extension implementation had not started when this tracker was created. This is a historical starting state, not a rule that work must always be unchecked.

## How to maintain this tracker

- Before an implementation batch, add a batch note marked **In progress**. Update the note after each meaningful change rather than waiting for the package to finish.
- A task checkbox means that task is complete and verified. An acceptance checkbox means the specified acceptance result passed. An attempted, partial, or failed check must stay unchecked.
- Record evidence for each completed batch: changed files, exact commands or manual checks performed, result, and any report/log path. Record decisions, failures, blockers, and deferred work too.
- Never erase failed attempts or blockers. Add the successful fix and rerun as a new note; tick the checkbox only after that successful verification.
- Keep WP task checkboxes and WP acceptance checkboxes separate. A WP is complete only when all its applicable work and acceptance checks are verified.
- Preserve the actual state. Never reset a checked item, active batch, or existing progress when a new agent arrives. Reconcile the tracker with current code and evidence before resuming; mark discrepancies as notes instead of silently clearing history.
- Overall implementation progress is the fraction of implementation task and acceptance checkboxes checked. Planning-package setup checks do not count toward implementation progress.
- Detailed QA matrices in §8 of the specification must have row-level results recorded in an evidence report; aggregate QA checkboxes below may be checked only when every required row has a passing result.
- If implementation is not authorized, do not edit source files or this tracker. The pre-agent must remain read-only and wait.

## Progress summary

| Area | Status | Progress | Notes |
|---|---|---:|---|
| Plan package setup | Complete | 4/4 checks | This documentation batch only; no extension implementation was authorized or started |
| Extension implementation | In progress — WP1b | WP0 and WP1 implementation verified; WP1 Firefox check and WP1b spikes pending | Recalculate from checked tasks/acceptance items and evidence as work is verified |
| Current implementation batch | WP1b — De-risking spikes | In progress | Authorized scope is WP1b only |

## Implementation order and gates

Follow this sequence: **WP0 → WP1 → WP1b → WP2 → WP3 → WP4 → WP5 → WP6 → WP7 Tier A → WP8 → WP9 → WP10**. WP1b's four spikes must be completed before WP2 and WP3. Do not start WP7 before the plan's M1 gate is green. WP7 Tier B comes after Tier A; Tier C is backlog and requires an explicit owner request.

## Continuation and resume rule

The checkboxes and batch log show the real project state; they are not required to remain unchecked. On arrival, inspect the current tracker, batch notes, evidence, working tree, and relevant code. If a batch is already **In progress**, resume that batch after confirming its current state. Otherwise continue with the next eligible incomplete item in plan order; do not default to WP0 if progress already exists. If the owner names a specific item to continue, resume it while respecting the plan's dependencies and gates. Preserve completed checkboxes and history; only correct one if current code/evidence demonstrates it is inaccurate, and record why.

## Planning-package setup

This is the only work recorded in the current session. It does not count as extension implementation.

- [x] Supplied implementation plan copied into `plan/` under a descriptive name; uploaded source remains unchanged.
- [x] Workspace execution gate added to the copied plan.
- [x] Tracker and progress/evidence protocol created.
- [x] Read-only pre-agent prompt created and cross-file references verified.

### Batch P0 — Plan package setup

**Status:** Complete  
**Started:** 2026-10-18  
**Changed files:** `plan/focusgate-extension-implementation-plan.md`, `plan/README.md`, `plan/tracker.md`, `plan/agent-pre-prompt.md`.
**Verification:** Compared the copied plan to `attached_assets/plan_1792346052030.md` after removing only the workspace addendum and restoring the source's original blank line; checked the README/tracker/prompt references and required prompt rules; counted WP checkboxes; compared the two uploaded plan attachments.
**Result:** All checks passed. The copied plan matches the supplied source outside the added execution section; uploaded source attachments remain unchanged and identical; all implementation tasks and acceptance checks remain unchecked.
**Failures and fixes / reruns:** (1) Initial source-equivalence check reported a mismatch because its normalization removed one original blank line; inspected the opening with `sed -n l`, corrected the check to restore that line, and reran successfully. (2) Initial cross-reference assertion incorrectly required the tracker to link to itself; corrected the assertion to check each file's actual links, then reran successfully.
**Result / blockers / decisions:** Documentation only. Extension implementation has not started. The pre-agent must wait for the owner's explicit start instruction.

## WP0 — Repo hygiene and tooling

Plan reference: §6, WP0.

### Work

- [x] Update package name/version and scripts; remove the specified server-only dependencies.
- [x] Remove the one-off patch script; update ignore rules and untrack build output as specified.
- [x] Check the GitHub repository for the plan's missing referenced files before recreating any; retain existing files.
- [x] Run and record the baseline typecheck errors.
- [x] Add Vitest, a smoke test, and the changelog.

### Acceptance

- [x] `npm ci`, `npm run typecheck`, and `npm test` run and their results are recorded; expected legacy type errors are noted if applicable (none remain).
- [x] `dist/` is untracked, the one-off script is gone, and server dependencies are removed as specified.

**Evidence / batch-note links:** Batch WP0 below; unauthenticated GitHub API checks returned HTTP 200 for every path named by §1.2, so no referenced files need to be recreated.

## WP1 — Foundation, shared core, storage, migration

Plan reference: §6, WP1.

### Work

- [x] Create WP1 shared foundation modules (`types`, `defaults`, `storage`, `migrate`) and tests; enable strict TypeScript for new extension source.
- [x] Add source background/content entrypoints and the Vite-to-esbuild pipeline; preserve legacy behavior through transition imports and update the module-worker manifest metadata.
- [x] Implement typed storage helpers and single-writer update behavior.
- [x] Implement migration/readiness logic and fixture-based migration test.
- [x] Keep old background/content scripts working until their replacements are ready; remove only at the planned point.

**Scope note:** Feature-specific shared modules and their full §8.1 test matrices (`time`, `domains`, `keywords`, `plan`, `allowance`, `dnr`, `password`, `gating`, `presets`, `stats`) remain with their matching feature WPs so WP1 does not pull later enforcement, security, or reporting behavior forward.

### Acceptance

- [ ] Build output loads in Chrome and Firefox with the existing UI still working. Chrome 152 headless extension load and preview UI are verified; Firefox packaging is validated, but no Firefox browser binary is available for temporary-add-on loading.
- [x] Unit tests pass and the v1 migration fixture passes.
- [x] Concurrent calls to `ready()` are idempotent (10-way check).

**Evidence / batch-note links:** Batch WP1 below; final build/typecheck/test and Chromium checks are recorded there.

## WP1b — De-risking spikes

Plan reference: §6, WP1b. Complete before WP2 and WP3.

- [ ] S1: Redirect preserves the original URL; record browser versions, cases, result, and selected design.
- [ ] S2: Attention sampling handles focused/minimized/idle/audible states; record OS/browser differences and decision.
- [ ] S3: Alarm persistence, idempotency, and minimum period verified.
- [ ] S4: Firefox MV3 APIs/permissions tested; limitations recorded.
- [ ] `docs/spikes.md` records pass/fail for all four, chosen redirect design, and any changed plan assumption.

**Evidence / batch-note links:** —

## WP2 — Background-owned session engine

Plan reference: §6, WP2.

### Work

- [ ] Implement session/state helpers, alarms, notifications/badge, and background message handlers.
- [ ] Replace popup-owned timer state with timestamp rendering and background messages.
- [ ] Write session history/day stats at phase end and enforce the history cap.
- [ ] Replace the keyboard shortcut handler with the planned lock-aware behavior.

### Acceptance

- [ ] Popup-closed session reaches phase end, notification/badge/break behavior is correct, and one completed history row is written.
- [ ] Worker stop/restart preserves correct remaining time and session completion.
- [ ] Browser close/reopen recovery finalizes the session according to the documented gap rule.
- [ ] Commitment stop is refused in UI, message handler, and shortcut; session ends by itself.
- [ ] Strict password/typed-confirmation behavior is enforced in the background; shortcut cannot bypass it.
- [ ] Extension works in every lock level and reschedules its alarm and displayed time.
- [ ] Repeated popup open/close and linked-task cases never mutate the running session.
- [ ] Concurrent popup/dashboard views do not double-decrement; storage writes stay within the planned rate.
- [ ] Auto-start cycles and long-break sequence match the configured cycle count.
- [ ] UI-started sessions appear in history; applicable claims C06–C11 pass.

**Evidence / batch-note links:** —

## WP3 — Blocking engine

Plan reference: §6, WP3.

### Work

- [ ] Implement the pure block-plan/verdict functions.
- [ ] Implement serialized reconciliation, health reporting, boundary alarm, and transition-only tab audit.
- [ ] Implement DNR redirect and exception rule design; preserve original URL.
- [ ] Normalize and validate domains at input and storage boundaries; report invalid stored values.
- [ ] Implement alias groups and alias-aware display.
- [ ] Implement schedule evaluation and next-boundary calculation.
- [ ] Implement the three allowance modes with attention tracking and planned exemption semantics.
- [ ] Implement normalized, boundary-safe exceptions.
- [ ] Implement keyword modes/scopes/matching and the recent-match ring.
- [ ] Implement the planned fallback listeners and remove obsolete update polling.
- [ ] Implement deduplicated block logging and daily statistics.
- [ ] Ensure required alarms are managed centrally and idempotently.

### Acceptance

- [ ] Typed URLs, links, new tabs, and SPA routes land on the correct block page without a target-page flash; behavior survives worker stop.
- [ ] Domain and subdomain matching is correct; look-alike domains remain unblocked.
- [ ] Exception path matching accepts only the specified URL path/query boundary cases.
- [ ] Schedules start/end without user action and handle overnight, `24:00`, owned/global lists, and edits.
- [ ] Allowances track focused use, count visits/windows correctly, expose remaining budget, and do not flash through blocks.
- [ ] Search parameter and whole-word keyword cases pass, including YouTube in-page search.
- [ ] Invalid stored entries are skipped while valid rules still apply; Protection status explains the invalid entry.
- [ ] Rapid rule updates leave a consistent DNR set without duplicate IDs.
- [ ] A blocked navigation is counted once across all event paths.
- [ ] Rules expire at schedule/standalone boundaries without requiring a storage change and survive restart.

**Evidence / batch-note links:** —

## WP4 — Content script

Plan reference: §6, WP4.

### Work

- [ ] Add site/filter data and shared active-context evaluation.
- [ ] Inject reversible CSS filters and reversible keyword hiding.
- [ ] Add a safe, debounced observer only while needed.
- [ ] Use exact/subdomain host matching.
- [ ] Keep manifest matches generated from the supported-site table and test they agree.
- [ ] Handle YouTube SPA navigation.
- [ ] Replace unconditional filters with settings and preserve existing-user defaults.
- [ ] Remove old scripts only after the replacement engine/content script is ready.

### Acceptance

- [ ] Every filter toggles and reverses without reload; filters respect breaks and active blocking contexts.
- [ ] Cold `document_start` load has no console errors in 20 repetitions.
- [ ] Keyword removal restores items, unsupported sites receive no content script, and the measured mutation pass is under 5 ms; C23 passes.

**Evidence / batch-note links:** —

## WP5 — UI foundation and screen fixes

Plan reference: §6, WP5.

### Work

- [ ] Split popup, block, onboarding, and dashboard pages; fixed popup dimensions; render final block/onboarding state on first paint.
- [ ] Implement the storage subscription hook/gate and remove hydration flicker/stale updates.
- [ ] Implement design tokens/components, themes, motion preferences, contrast, and popup navigation fixes.
- [ ] Replace browser alerts/confirms/prompts; explain disabled actions.
- [ ] Implement the planned information architecture and navigation.
- [ ] Update focus view, duration input, lock descriptions, timer ring, and empty-block hint.
- [ ] Fix task lock/deletion/restart/date/time behavior.
- [ ] Implement rules screens, validations, keyword splitting, schedules, and limits UI.
- [ ] Implement the reason-aware block page, safe URL rendering, live end state, and tab actions.
- [ ] Implement onboarding and accurate final action/protection check.
- [ ] Rewrite audited copy to be truthful and remove prohibited claims.
- [ ] Complete keyboard and screen-reader accessibility pass.
- [ ] Remove legacy UI/storage-hook files only after all views have moved.

### Acceptance

- [ ] Popup is 380×580 across tabs; block and onboarding render correctly on first paint; screen capture is recorded.
- [ ] No `alert(` remains in `src`; tab close uses the supported tab API, not `window.close()`.
- [ ] Light/dark contrast and keyboard access pass; modal focus behavior and Lighthouse accessibility targets are recorded.
- [ ] Duration input, comma-separated keyword input, and pasted full-URL domain input behave as specified.
- [ ] Every WP5-owned UI claim in §4.7 passes its linked regression check or is rewritten truthfully.

**Evidence / batch-note links:** —

## WP6 — Security, standalone, protection status, backup

Plan reference: §6, WP6.

### Work

- [ ] Implement PBKDF2 password storage, legacy upgrade, generator, and input policy.
- [ ] Implement the single background-enforced guard and full action/state matrix tests.
- [ ] Implement Standalone Block v2; remove the old standalone/no-limit path.
- [ ] Implement truthful Protection status and browser permission guidance.
- [ ] Implement backup validation, safe merge/restore, reset guards, and reports.
- [ ] Implement theme and font-scale settings.

### Acceptance

- [ ] Wrong passwords fail in the background; every weakening action follows the guard matrix.
- [ ] Legacy password verification upgrades correctly; generated passwords use the specified secure source/alphabet.
- [ ] Standalone cannot be ended early via UI, shortcut, or message; extend/add work; refused actions explain why.
- [ ] Export omits secrets/runtime state; empty-state restore and working-state merge follow the non-weakening rules.
- [ ] Reset is refused during a lock; Protection card reports incognito/host permission status correctly.

**Evidence / batch-note links:** —

## WP7 — Feature ports

Plan reference: §6, WP7. Tier C is not in scope without an explicit owner request.

### Tier A

- [ ] A1 Quick block.
- [ ] A2 Always-blocked list.
- [ ] A3 Presets and onboarding goal.
- [ ] A4 Break/Pomodoro settings.
- [ ] A5 Extend session.
- [ ] A6 Tasks upgrade, recurrence, reminders.
- [ ] A7 Block-page message and quotes.
- [ ] A8 Content-filter toggles.
- [ ] A9 Notification settings.
- [ ] A10 Alias chips.
- [ ] A11 Check a URL / explain why.
- [ ] A12 Up next / Today task windows.
- [ ] Tier A cross-browser acceptance passes; reminders survive restart; recurrence is idempotent; presets require confirmation; applicable claims pass.

### Tier B — only after Tier A is green

- [ ] B1 Session debrief.
- [ ] B2 Achievements subset.
- [ ] B3 Keyword match log.
- [ ] B4 Allow-only mode.
- [ ] B5 Daily reflection.
- [ ] B6 Habits.
- [ ] B7 Allowance heads-up.

### Tier C — backlog; owner request required

- [ ] Implement only after explicit owner request; otherwise leave deferred and record that decision.

**Evidence / batch-note links:** —

## WP8 — Stats, insights, reports

Plan reference: §6, WP8.

### Work

- [ ] Build Dashboard Stats ranges, KPIs, inline SVG chart, goal ring, focus score, streak, insights, and supporting summaries.
- [ ] Build popup mini-stats.
- [ ] Implement persistent weekly report scheduling, computation, notifications, and report history.
- [ ] Cap/prune history, daily stats, and recent-block records as specified.

### Acceptance

- [ ] UI-started sessions appear immediately; seeded-fixture aggregates match a hand calculation.
- [ ] Weekly alarm scheduled time survives at least 20 worker restarts.
- [ ] Streak and score match specified formulas; no chart dependency is added.
- [ ] Record caps and pruning behavior pass.

**Evidence / batch-note links:** —

## WP9 — QA hardening

Plan reference: §6, WP9; detailed matrices in §8.

- [ ] Full §8.2 manual matrix passes in Chrome; row-level evidence is linked.
- [ ] Full §8.2 manual matrix passes in Edge; row-level evidence is linked.
- [ ] Full §8.2 manual matrix passes in Firefox temporary add-on; row-level evidence is linked.
- [ ] Required §8.3 MV3 lifecycle cases pass; results are recorded individually.
- [ ] Performance targets are measured and meet the plan.
- [ ] Fix findings without adding features; all §8.4 claim checks pass.
- [ ] Every §8.5 edge case has a linked test or manual result.

**Evidence / batch-note links:** —

## WP10 — Release

Plan reference: §6, WP10.

### Work

- [ ] Bump version and update changelog with migration and behavior changes.
- [ ] Make store listing truthful and include permission justifications.
- [ ] Publish/update privacy policy and capture requested store screenshots.
- [ ] Build and smoke-test Chrome, Edge, and Firefox packages.
- [ ] Upgrade a real v1 profile and verify data migration.

### Acceptance

- [ ] All three packages install and pass the required browser smoke test.
- [ ] Real v1 upgrade test passes without data loss.
- [ ] Every claim in §4.7 passes or has truthful replacement copy; bundles have no forbidden network APIs, no `<all_urls>` content script, and no `alert(`.

**Evidence / batch-note links:** —

## QA matrix roll-up

These aggregate boxes are permitted only when the individual rows have results in a linked evidence report (e.g. `plan/evidence/qa-report.md`).

- [ ] §8.1 unit-test cases: every listed module and case has a passing result.
- [ ] §8.2 manual matrix: every scenario is recorded per supported browser.
- [ ] §8.3 lifecycle tests 1–7: each result and environment is recorded.
- [ ] §8.4 claims regression C01–C40: every claim has a passing behavior check or truthful revised copy.
- [ ] §8.5 edge cases EC01–EC54: every case has a passing test or manual check.
- [ ] Global definition of done in §9 passes.

## Milestones

- [ ] **M1 — Correct core:** WP0–WP3 gates are green; WP4 old-script removal is complete as defined by the plan; required lifecycle cases pass.
- [ ] **M2 — Trustworthy UI:** WP4–WP6 acceptance and assigned claims pass.
- [ ] **M3 — Features:** WP7 Tier A and WP8 acceptance pass.
- [ ] **M4 — Release:** WP9/WP10 and the required QA/upgrade checks pass.

## Batch notes and evidence log

Add a new entry for every batch. Set status to **In progress** before changing implementation files. Add append-only outcome notes; do not erase failed attempts.

```md
### Batch <id> — <work package / scope>
- Status: In progress | Complete | Blocked | Deferred
- Started / completed:
- Changed files:
- Verification performed (exact command or manual steps):
- Result:
- Evidence paths / test rows:
- Decisions:
- Failures and fixes / rerun:
- Blockers / deferred work:
```

### Batch P0 — Plan package setup

- Status: Complete
- Started: 2026-10-18
- Changed files: `plan/focusgate-extension-implementation-plan.md`, `plan/README.md`, `plan/tracker.md`, `plan/agent-pre-prompt.md`.
- Verification performed: Node.js assertion script verified source equivalence outside the addendum, actual cross-file references, prompt authorization/safety rules, all implementation checkboxes unchecked, and unchanged/identical source attachments.
- Result: all final checks passed; planning artifacts are complete; extension implementation remains unauthorized and not started.
- Evidence paths / test rows: verification was run directly against the four files in `plan/` and both uploaded plan attachments; no app tests were run because no application code changed.
- Decisions: preserve the uploaded source attachment; place the workspace-specific execution gate in the copied plan.
- Failures and fixes / rerun: initial whitespace normalization and self-reference assertions both failed due to overly strict verification-script assumptions; corrected both assertions and recorded successful reruns above.
- Blockers / deferred work: implementation is gated on an explicit owner start instruction.

### Batch P1 — Resume-aware tracker instructions

- Status: Complete
- Started: 2026-10-18
- Changed files: `plan/focusgate-extension-implementation-plan.md`, `plan/README.md`, `plan/tracker.md`, `plan/agent-pre-prompt.md`.
- Verification performed: Node.js assertions checked that the supplied plan is unchanged outside its workspace addendum; current-status/resume rules, explicit authorization gates, dependencies, and links are consistent across files; all implementation checkboxes still reflect the actual 0% state.
- Result: all final assertions passed. Future agents are instructed to resume an in-progress or owner-named item and preserve completed work rather than assuming everything is unchecked or defaulting to WP0.
- Evidence paths / test rows: verification checked the four files in `plan/`; no application tests were run because no application code changed.
- Decisions: the current unchecked boxes remain accurate for this snapshot only; future status must be reconciled from actual code, tracker notes, and evidence.
- Failures and fixes / rerun: (1) First assertion expected the literal wording “resume an existing ‘In progress’ batch”; the tracker used equivalent wording (“If a batch is already In progress, resume that batch”). Adjusted the assertion to check the actual rule and reran. (2) Second assertion expected “do not assume every item is unchecked”; the README says “rather than assuming every item is unchecked.” Adjusted the assertion to match the existing phrasing and reran. The final verification passed.
- Blockers / deferred work: extension implementation remains gated on the owner's explicit start or direct continue instruction.

### Batch WP0 — Repo hygiene and tooling

- Status: Complete
- Started: 2026-10-18
- Changed files: `package.json`, `package-lock.json`, `.gitignore`, `tests/manifest.smoke.test.js`, `CHANGELOG.md`, and this tracker; deleted `patch_req.cjs`; removed 11 tracked `dist/` entries while retaining prior build artifacts.
- Verification performed: baseline `npm run lint` initially exited 127 with `sh: 1: tsc: command not found` because `node_modules/` was absent; initial `npm ci` failed with E403 for `proxy-addr@2.0.7` under Replit's package security policy. The package manager successfully removed `express`, `@types/express`, `dotenv`, and `tsx`; its install output reported 1 high-severity audit finding. `npm run typecheck` passes with zero diagnostics against unchanged application source. GitHub API root/path checks were read-only and returned HTTP 200 for all §1.2 referenced paths. After removing Express, `npm ci` succeeded (101 packages); `DANGEROUSLY_ALLOW_GIT=1 git rm --cached -r dist` staged 11 removals and verified `dist/manifest.json` remains on disk. Vitest 4.1.11 callback attempts failed during npm peer resolution; Vitest 3.2.4 was blocked by `tinypool@1.1.1` (critical CVE). Registry metadata confirms Vitest 3 requires `tinypool ^1.1.1`, while current `tinypool` 2.2.0 is a new major; do not force that incompatible override.
- Result: all five WP0 work items and both acceptance checks are complete. Clean install, typecheck, and the manifest smoke test passed.
- Evidence paths / test rows: `npm ci && npm run typecheck && npm test` passed with npm 10.8.2; `npm ci` installed 123 packages, typecheck reported zero diagnostics, and Vitest 4.1.11 passed `tests/manifest.smoke.test.js` (1 test). `git ls-files dist` returned 0; `git check-ignore dist/manifest.json` matched; `patch_req.cjs` was absent; package/lock checks confirmed `express`, `@types/express`, `dotenv`, and `tsx` absent; existing Firefox ZIP and store submission listing remained in `build/`; `git diff --check` passed. The restarted `FocusGate Extension Preview` served `/` and `/manifest.json` with HTTP 200 and showed the popup in the screenshot; the browser's automatic `/favicon.ico` request returned 404 (nonblocking and outside WP0).
- Decisions: inspect before edit; do the WP0 GitHub repository check read-only; do not push or run GitHub Actions. Do not run the new `clean` script: the existing tracked `build/` directory contains a packaged Firefox extension and store submission assets, and WP0 does not ask to delete them.
- Failures and fixes / rerun: baseline attempt first failed before TypeScript ran because dependencies were absent; `npm ci` was blocked by a critical-CVE package policy rejection for `proxy-addr@2.0.7`, which the lockfile showed was required by Express `4.22.2`. Removed the explicitly undesired Express parent via the package manager rather than bypassing the firewall; subsequent `npm ci` and typecheck passed. One one-off inspection helper exited on an `awaitImport` typo after printing the dependency parent; reran tracked-file counts with a corrected helper. Vitest 4.1.11 install callback attempts failed with `Cannot read properties of null (reading 'edgesOut')`; Vitest 3.2.4 required the firewall-blocked `tinypool@1.1.1`, so no incompatible override was used. The Git safeguard first rejected `git rm --cached -r dist`; retried with its explicit opt-in because untracking `dist/` is directly authorized by WP0, and verified all 11 files remain on disk. A tracker update patch failed on stale context and was reapplied using current lines. On resume, Vitest 5's latest release required Node 22; npm 12 also required Node 22. A temporary npm 11.21.1 install resolved Vitest 4.1.11, first timing out on slow package downloads and then succeeding from the warmed cache. The default npm 10.8.2 `npm ci` then succeeded, confirming the lockfile works without peer overrides; typecheck and smoke test passed. Preserve all failed attempts above as history.
- Blockers / deferred work: no remaining WP0 blockers. Install output reported one high-severity audit finding; triage is deferred outside this WP0 scope.
- Resumed: 2026-10-19. At batch start, `patch_req.cjs`, `dist/`, `tests/`, and `CHANGELOG.md` were absent; `build/` remained. Only the supplied prompt attachment was untracked. Continued only the remaining WP0 work.
- Failures during this resume: managed `vitest@latest` resolves to Vitest 5.0.5, which requires Node 22.12+ and the npm 10.8.2 Arborist peer-resolution error occurred before any file changes. The managed installer rejects CLI flags; the documented one-command `vitest@4.1.11 --omit=optional` attempt also failed with the same `edgesOut` error and left package files unchanged. No peer override or firewall bypass was used.
- Further install attempts: npm 12.2.0 requires Node 22.22+, so it is not compatible with this project's Node 20 runtime. Temporary npm 11.21.1 is compatible; its first install timed out after 300 seconds during slow downloads and a retry using the warmed cache succeeded. The subsequent clean npm 10.8.2 install verified the resulting lockfile.
- External sync observation: during this batch, a commit authored as `FocusGate Replit Sync` appeared on `main`/`origin/main` containing `package.json`, `package-lock.json`, and tracker changes. A later read-only log refresh showed the configured GitHub Sync workflow had pushed `main` and its triggered GitHub build failed. I did not start/restart that workflow, run GitHub Actions, or issue a `git push`; no corrective sync was initiated.

### Batch WP1 — Foundation, shared core, storage, migration

- Status: Implementation complete; acceptance check 1 remains partially verified (Firefox runtime unavailable)
- Started: 2026-10-19
- Changed files: `src/shared/{types,defaults,migrate,storage}.ts`, `src/background/index.ts`, `src/content/index.ts`, `scripts/build-extension.mjs`, `public/manifest.json`, `tsconfig.json`, `tests/fixtures/{v1-storage.json,v2-storage.expected.json}`, `tests/shared/{migrate,storage}.test.ts`, and this tracker. `public/background.js` and `public/content.js` are unchanged.
- Verification performed: `npm run typecheck` passed; `npm test` passed (3 files, 10 tests); final `npm run build` passed and emitted `dist/index.html`, `dist/background.js`, and `dist/content.js`. Chromium 152 registered the unpacked extension and rendered the `chrome-extension://…/index.html` popup DOM with FocusGate, Duration, and Lock Level; the CLI stayed open until its timeout because of the extension worker, but no extension/manifest errors were reported. Temporary Chrome and Firefox ZIP staging validated their manifests without touching existing `build/` assets. The restarted extension preview screenshot also shows the existing 25-minute UI.
- Result: added the v2 shared data contract/defaults, typed storage helpers (`getState`, `patch`, serialized `update`, and `onStateChanged`), a pure v1 migration with backup retention, source entrypoints, and the build pipeline. The fixture covers an active timer, overnight schedule, numeric and legacy object allowances, password, blocks, and seconds-to-milliseconds history conversion. The existing v1 popup remains active; `ready()` is implemented and tested but deliberately not called from the bridge until the v1 consumers are replaced.
- Evidence paths / test rows: `tests/shared/migrate.test.ts` (4), `tests/shared/storage.test.ts` (5), and the two migration fixtures. The v1 migration, no-limit standalone conversion, 30-day backup expiry, storage defaults, patching, change subscription, serialized 10-way updates, and concurrent 10-way `ready()` checks pass.
- Decisions: preserve `public/background.js` and `public/content.js` verbatim and continue using their behavior in built bundles until their replacements are ready. Defer activating the v2 migration from the legacy worker until the v2 consumers replace the v1 UI/state paths, to avoid moving stored data out from under the current UI. Keep UI pages and feature-specific manifest changes in their planned later WPs; WP1 applies only the module worker metadata needed by its ESM bundle.
- Failures and fixes / rerun: an initial static verifier incorrectly expected `chrome.runtime` in the legacy content bundle; inspection showed the old script uses `chrome.storage` and `MutationObserver`, and the corrected assertions passed. A cleanup of unused migration symbols briefly removed a still-used `UsageRecord` import; strict typecheck caught it, the import was restored, and typecheck plus all 10 tests passed. The preview also retains the known nonblocking favicon 404.
- Blockers / deferred work: no Firefox binary is installed, so the temporary add-on could not be opened in Firefox; only its staged archive and manifest were validated. The v2 migration is not activated while v1 UI consumers remain. Do not overwrite the existing `build/focusgate-firefox.zip` or store-submission assets during further verification.

### Batch WP1b — De-risking spikes

- Status: In progress
- Started: 2026-10-19
- Changed files at batch start: only `plan/tracker.md`; `docs/spikes.md` does not exist yet.
- Initial environment: Chromium 152 is available; Firefox, Edge, Xvfb, and browser automation packages are not installed. `xdotool` exists, but a display server/windowing session has not yet been established.
- Constraints: use only local test traffic and temporary spike artifacts; do not run GitHub Sync, trigger/poll GitHub Actions, or install browser packages from the network.
- Verification performed: reread §6 WP1b and inspected the manifest, tracker, browser executables, docs directory, and worktree.
- Result: experiments have not started yet; record each spike's exact cases, browser/OS, outcome, and limitation before changing any plan assumption.
- Evidence paths / test rows: pending.
- Failures and fixes / rerun: none yet.
- Blockers / deferred work: cross-browser Firefox/Edge verification may be unavailable in this environment; determine whether any headful test surface is available before finalizing the gate.
