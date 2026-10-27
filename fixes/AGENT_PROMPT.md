# FocusGate — Implementing Agent Pre-Prompt

Read this prompt before working on the FocusGate implementation plan. It sets the authorization, scope, and progress rules for the implementing agent.

## Read first

Read these files in full and in this order:

1. `fixes/AGENT_PROMPT.md`
2. `fixes/plan.md` — the implementation contract
3. `fixes/TRACKER.md` — the only progress record
4. Then inspect the current project instructions, working tree, and relevant source files before any authorized implementation.

Confirm current APIs and behavior rather than assuming the plan's code snapshot is still current. Preserve unrelated user changes and user data. The separate root `plan/` folder is not the active plan; do not overwrite or reorganize it. The active planning documents are in `fixes/`.

## Authorization and pause

- Reading, inspecting, and maintaining the three planning documents is allowed.
- Do not edit app code, tests, build files, settings, or other project behavior until the owner explicitly says to start implementation. The plan, tracker, or a previous task assignment is not authorization.
- If the owner has only asked you to read, organize, audit, or prepare, do only that documentation/status work.
- If scope or authorization is unclear, stop before changing app behavior and ask.
- After reading the documents, if there is no explicit start instruction, briefly report that the plan and tracker are reviewed and wait for authorization.
- Once authorized, work on one work package at a time in the plan's order. At each phase boundary, stop and report; do not begin the next phase until the current phase's completion conditions and required checks pass. Respect the dependency gates, including WP1b before WP2/WP3 and M1 before WP7.
- Do not silently widen scope or change the plan's contract. If a current-code conflict or unclear product decision blocks safe progress, record it in the tracker and ask the owner.

## Required work rules

- Work alone. Do not create, invoke, or delegate to sub-agents.
- Before editing, inspect the relevant current code, project instructions, and working tree. Preserve unrelated changes and user data.
- Respect the plan's no-touch list unless the owner explicitly changes the scope. Do not hand-edit `dist/`, blindly recreate files missing from the upload, or port anything on the plan's “Do not port” list, including telemetry or the Discord webhook. Do not overwrite the separate root `plan/` folder.
- Treat task replacement and any other deletion of user data as destructive. Keep replacement disabled by default, preserve explicit confirmation and safety guards, and do not perform destructive actions without owner authorization.
- For this browser-extension repository, run relevant checks on Replit using its existing workflows or scripts; use the applicable npm checks (`npm run typecheck`, `npm test`, `npm run build`). Do not run Android tests or build APKs here. If APK-building verification is explicitly requested, use GitHub Actions only when the owner asks; otherwise state clearly which checks were not run.
- Do not push to GitHub or start, poll, or monitor GitHub Actions unless the owner explicitly asks.
- Do not expose, copy into files, or print secrets or credentials.
- Use behavior tests with fake clocks and event sources. Do not add tests that read Kotlin source files as text. Logic under test must not call the system wall clock directly.

## Tracker discipline

Follow the rules at the top of `fixes/TRACKER.md`:

- At the start of a phase, mark it IN PROGRESS and add a dated start note before doing its work.
- After each meaningful change, update the relevant notes, status, progress, evidence, and history.
- As soon as a checklist item or individual check completes or fails, update its status and record the exact command/reproduction and observed result before starting the next item or check.
- Mark work complete only after it is finished and verified. Record changed files and evidence; leave partial, attempted, failed, or unverified work unchecked.
- Preserve failures, blockers, decisions, and deferred work; append outcomes instead of erasing history.
- Before finishing, reconcile the tracker with current code and observed evidence. Explain why any item remains incomplete.

The owner reset the tracker after confirming prior completion claims were inaccurate. Treat the tracker as 0/156 complete; do not rely on prior completion or pass claims. Reinspect the current code and record fresh evidence for each item after authorization.

## Final report

Report completed and open work packages, verified progress, changed files, exact evidence, decisions, failures, blockers, deferred work, and checks not run. Never claim an unobserved result passed.
