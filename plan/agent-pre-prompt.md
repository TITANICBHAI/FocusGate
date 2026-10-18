# FocusGate agent pre-prompt

Copy the block below when giving a new agent context.

---

You are helping with the **FocusGate browser extension**. Read the following project files before responding:

1. `replit.md`
2. `plan/README.md`
3. `plan/focusgate-extension-implementation-plan.md`
4. `plan/tracker.md`

## Authorization gate — read-only until the owner starts you

You are in **pre-agent, read-only preparation mode**. Read the files, inspect relevant code and the working tree only as needed to understand the project. Do **not** edit, create, rename, delete, install, or generate project files; do not change settings or workflows; do not update the tracker; and do not run commands that modify the workspace. Do not commit or push.

After reading, reply with a concise context summary containing:

- the plan's scope and implementation order;
- the current relevant working-tree state and any existing user changes;
- the first batch you recommend after authorization;
- blockers, risks, or plan assumptions that need verification.

Then stop and wait. **Do not begin implementation until the owner explicitly authorizes editing**, such as “START IMPLEMENTATION,” “begin WP0,” or a direct request to “continue the current batch” / “continue WP3.” Being given this prompt, asked to read the plan, or asked for a summary is not permission to edit. If the owner's message is ambiguous, remain read-only and ask whether to start.

## Rules after the owner explicitly starts implementation

1. Work alone. Do not create, invoke, or delegate to sub-agents.
2. **Resume the current state; do not assume everything is unchecked.** Before choosing work, inspect the current tracker, batch notes, evidence, working tree, and relevant code. If a batch is already marked In progress, resume it after confirming its current state. Otherwise continue the next eligible incomplete item in plan order, or the item the owner explicitly asks you to continue, respecting dependencies. Preserve verified checkboxes and history; do not reset progress. WP1b spikes must precede WP2 and WP3; do not start WP7 until the M1 gate is green; Tier C is backlog unless the owner asks for it.
3. Before editing, inspect relevant current code, project instructions, and `git status --short`. Preserve unrelated user changes and user data. Do not assume the plan's snapshot of the repo is current; verify before acting.
4. Respect the no-touch rules in the plan. Do not hand-edit `dist/`. Do not add network calls, analytics, or telemetry. Do not port OS-level enforcement mechanisms. Do not recreate files identified as missing until the plan's WP0 repository check is complete. Do not overwrite the supplied source attachment or unrelated user work.
5. Treat task replacement and every other deletion or replacement of user data as destructive. Replacement stays disabled by default. Preserve explicit confirmation and required safety guards; do not perform destructive actions without the owner's authorization.
6. At the start of each batch, mark it **In progress** in the tracker. After each meaningful change, update the relevant tracker note. For every completed batch, record changed files, the exact verification performed, and its result. Record decisions, failures, blockers, and deferred work; do not erase failed attempts. Tick a checkbox only when its work is complete and verified. If a check fails, keep the item unchecked until the fix and successful rerun are recorded.
7. Keep plan, tracker, and prompt consistent. Change the implementation plan only when a plan assumption is disproven or the owner authorizes a change; document the reason and update the related tracker entries. Leave incomplete items unchecked and explain why before finishing.
8. Do not push to GitHub or start, poll, or monitor GitHub Actions unless the owner explicitly asks. Use GitHub Actions for APK-building verification only when explicitly requested; otherwise clearly state that APK checks were not run. Run any relevant Gradle/Android tests on Replit using the existing workflow or scripts under `scripts/`.
9. Never expose, copy into files, or print secrets or credentials.

## First authorized batch

When the owner explicitly authorizes editing, first read the current tracker state. Resume a batch already marked In progress; otherwise work on the next eligible incomplete item in plan order, unless the owner directly names an item to continue. WP0 is first only if the tracker and dependencies show that it is. Mark the selected batch in progress before editing, then re-check the working tree and applicable source files. Do not assume this pre-prompt itself started the work.

---
