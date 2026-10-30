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
- Once authorized, work on one work package at a time in the active plan/tracker order. At each phase boundary, stop and report; do not begin the next phase until the current phase's completion conditions and required checks pass. Owner-authorized gate deferrals must be recorded in `fixes/plan.md` and `fixes/TRACKER.md`; continue code/unit work where safe, but keep affected runtime activation and acceptance gates closed until evidence exists. Current exception: WP1b is deferred and does not block WP2/WP3 module or unit work; complete it before the WP5 cutover and M1 green.
- Do not silently widen scope or change the plan's contract. If a current-code conflict or unclear product decision blocks safe progress, record it in the tracker and ask the owner.

## Required work rules

- Work alone. Do not create, invoke, or delegate to sub-agents.
- Before editing, inspect the relevant current code, project instructions, and working tree. Preserve unrelated changes and user data.
- Scope preservation: do not delete, revert, replace, or clean up files or work outside the currently owner-authorized work package/batch, including work from another agent or an earlier batch. A removal must be explicitly required by the active authorized scope and its plan gates; otherwise leave it untouched and ask the owner if it blocks progress.
- Respect the plan's no-touch list unless the owner explicitly changes the scope. Do not hand-edit `dist/`, blindly recreate files missing from the upload, or port anything on the plan's “Do not port” list, including telemetry or the Discord webhook. Do not overwrite the separate root `plan/` folder.
- Treat task replacement and any other deletion of user data as destructive. Keep replacement disabled by default, preserve explicit confirmation and safety guards, and do not perform destructive actions without owner authorization.
- **Owner machine / resource constraint:** Assume the owner's everyday machine is an approximately 10-year-old Windows PC and may not have Node.js or npm installed. Do not ask the owner to install Node.js/npm. Do not install or configure them on that PC. Keep all Node/npm-dependent execution in the existing Replit cloud workspace.
- **No local execution:** Never run `npm`, `npx`, `node`, `vite`, Vitest, TypeScript, package scripts, dependency installation, builds, packaging, browser automation, emulators, or app/dev servers on the owner's local PC. This prohibition applies even if a local executable happens to be present. Do not use PowerShell, CMD, WSL, Docker, or another local shell as a workaround. Lightweight source inspection and Git metadata/diff operations are allowed; do not confuse those with executed validation.
- **Cloud-only validation:** When the Replit cloud workspace is actually available, run the relevant existing checks there, using its already-provisioned Node.js 20 environment and dependencies. After each coherent code-change batch, use the project's existing cloud scripts as applicable (`npm run typecheck`, `npm test`, and `npm run build`). Do not run these commands in a shell unless you have confirmed that the shell belongs to the Replit cloud workspace; when the execution location is uncertain, treat it as local and do not execute.
- **No automatic setup or preview startup:** Do not run `npm ci`, `npm install`, dependency upgrades, or other dependency/setup commands by default. If cloud dependencies are missing, stop and ask before installing or restoring them. Do not start the `.replit` `Project` workflow as a routine check: it starts both the docs and extension preview servers. Start only the specific cloud preview needed for an explicitly authorized browser/runtime check, and stop/report it according to the available Replit controls. Do not start GitHub Sync, packaging, deployment, or release workflows unless explicitly authorized.
- **Unavailable cloud environment:** If Replit cloud execution is unavailable, continue only with safe authorized source work and lightweight inspection. Mark automated checks as NOT RUN / unverified, keep affected acceptance gates open, and report the limitation. Never fall back to running tests or builds on the owner's PC. Do not claim that static inspection passed an automated check.
- Do not run Android tests or build APKs in this browser-extension repository. If APK-building verification is explicitly requested, use GitHub Actions only when the owner explicitly asks; otherwise state clearly which checks were not run.
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

The owner later clarified that the reset must not erase verified non-browser work. Use the current checkmarks and progress in `fixes/TRACKER.md`; never blanket-reset progress. Reconcile each item against current source and evidence, and keep browser/runtime gates open until their behavior is directly observed.

## Final report

Report completed and open work packages, verified progress, changed files, exact evidence, decisions, failures, blockers, deferred work, and checks not run. Never claim an unobserved result passed.
