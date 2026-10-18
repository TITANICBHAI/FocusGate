# FocusGate plan package

This folder contains the implementation specification, its working tracker, and the read-only pre-agent prompt.

## Files

- [`focusgate-extension-implementation-plan.md`](focusgate-extension-implementation-plan.md) — the supplied FocusGate plan, copied into this folder and supplemented with this workspace's execution gate. Its work packages and acceptance criteria define implementation scope.
- [`tracker.md`](tracker.md) — checklists, progress, batch notes, evidence, decisions, failures, blockers, and deferred work. Update it as work proceeds; never mark an unverified item complete.
- [`agent-pre-prompt.md`](agent-pre-prompt.md) — copy this prompt when giving a new agent context. It requires read-only preparation until you explicitly authorize editing.

The uploaded source remains unchanged under `attached_assets/`. The implementation plan starts in a **read-only / not authorized** state. Supplying the pre-agent prompt does not authorize edits; only the owner can start implementation.

## Working agreement

- Do not edit project files or settings until the owner explicitly tells the agent to start editing.
- Once authorized, work alone and follow the plan's WP order and tracker. Do not widen scope or silently change requirements.
- Before editing, inspect the relevant current code, project instructions, and working tree; preserve unrelated changes and user data.
- Respect the source plan's no-touch rules. In particular, do not hand-edit `dist/`, do not add network calls or telemetry, and do not port OS-level enforcement features.
- Keep replacement and destructive data operations disabled by default. Do not delete or replace user data without the owner's authorization and the plan's safety controls.
- At the start of each batch, mark it in progress in the tracker. Update notes after meaningful changes. Tick checkboxes only after verification.
- Every completed batch needs an evidence record: changed files, exact checks run, and results. Keep failures and blockers in the history; document a fix and successful rerun before checking an item.
- Do not create or use sub-agents. Do not push to GitHub or start, poll, or monitor GitHub Actions unless explicitly asked.
- Run relevant Gradle/Android checks on Replit using an existing workflow or scripts under `scripts/`. Use GitHub Actions for APK-build verification only if explicitly requested; otherwise say those checks were not run.
- Never expose, copy into files, or print secrets or credentials.

## Sequence

Follow the implementation plan's order: WP0 → WP1 → WP1b (before WP2/WP3) → WP2 → WP3 → WP4 → WP5 → WP6 → WP7 Tier A → WP8 → WP9 → WP10. WP7 Tier B follows Tier A; Tier C is backlog and requires the owner's request. Do not begin WP7 until the plan's M1 gate is green.

## Tracker discipline

The tracker distinguishes work-package tasks from acceptance checks. A task checkbox records completed, verified work; an acceptance checkbox records a passing acceptance result. A work package is not complete until its required work and acceptance checks are verified. Record detailed row-level QA results in evidence notes or a test report and link that report from the tracker.
