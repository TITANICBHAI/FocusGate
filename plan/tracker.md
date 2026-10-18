# FocusGate implementation tracker

**Specification:** [`focusgate-extension-implementation-plan.md`](focusgate-extension-implementation-plan.md)  
**Project instructions:** [`../replit.md`](../replit.md)  
**Authorization state:** **READ-ONLY — implementation has not been authorized.**  
**Initial status:** Planning package setup is being recorded below; all extension implementation work packages remain not started.

## How to maintain this tracker

- Before an implementation batch, add a batch note marked **In progress**. Update the note after each meaningful change rather than waiting for the package to finish.
- A task checkbox means that task is complete and verified. An acceptance checkbox means the specified acceptance result passed. An attempted, partial, or failed check must stay unchecked.
- Record evidence for each completed batch: changed files, exact commands or manual checks performed, result, and any report/log path. Record decisions, failures, blockers, and deferred work too.
- Never erase failed attempts or blockers. Add the successful fix and rerun as a new note; tick the checkbox only after that successful verification.
- Keep WP task checkboxes and WP acceptance checkboxes separate. A WP is complete only when all its applicable work and acceptance checks are verified.
- Overall implementation progress is the fraction of implementation task and acceptance checkboxes checked. Planning-package setup checks do not count toward implementation progress.
- Detailed QA matrices in §8 of the specification must have row-level results recorded in an evidence report; aggregate QA checkboxes below may be checked only when every required row has a passing result.
- If implementation is not authorized, do not edit source files or this tracker. The pre-agent must remain read-only and wait.

## Progress summary

| Area | Status | Progress | Notes |
|---|---|---:|---|
| Plan package setup | Complete | 4/4 checks | This documentation batch only; no extension implementation was authorized or started |
| Extension implementation | Not started | 0% | All WP task and acceptance boxes below are intentionally unchecked |
| Current implementation batch | None | — | Read-only until explicit owner authorization |

## Implementation order and gates

Follow this sequence: **WP0 → WP1 → WP1b → WP2 → WP3 → WP4 → WP5 → WP6 → WP7 Tier A → WP8 → WP9 → WP10**. WP1b's four spikes must be completed before WP2 and WP3. Do not start WP7 before the plan's M1 gate is green. WP7 Tier B comes after Tier A; Tier C is backlog and requires an explicit owner request.

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

- [ ] Update package name/version and scripts; remove the specified server-only dependencies.
- [ ] Remove the one-off patch script; update ignore rules and untrack build output as specified.
- [ ] Check the GitHub repository for the plan's missing referenced files before recreating any; retain existing files.
- [ ] Run and record the baseline typecheck errors.
- [ ] Add Vitest, a smoke test, and the changelog.

### Acceptance

- [ ] `npm ci`, `npm run typecheck`, and `npm test` run and their results are recorded; expected legacy type errors are noted if applicable.
- [ ] `dist/` is untracked, the one-off script is gone, and server dependencies are removed as specified.

**Evidence / batch-note links:** —

## WP1 — Foundation, shared core, storage, migration

Plan reference: §6, WP1.

### Work

- [ ] Create shared pure modules and tests; enable strict TypeScript for new code as specified.
- [ ] Move background/content entry points to the planned source structure and implement the build pipeline/manifest updates.
- [ ] Implement typed storage helpers and single-writer update behavior.
- [ ] Implement migration/readiness logic and fixture-based migration test.
- [ ] Keep old background/content scripts working until their replacements are ready; remove only at the planned point.

### Acceptance

- [ ] Build output loads in Chrome and Firefox with the existing UI still working.
- [ ] Unit tests pass and the v1 migration fixture passes.
- [ ] Concurrent calls to `ready()` are idempotent (10-way check).

**Evidence / batch-note links:** —

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
