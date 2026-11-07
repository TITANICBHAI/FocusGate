# FocusGate overhaul: implementing agent pre-prompt

Read this before touching the code. It sets what you may do, in what order, and when to stop. It extends the repo's `fixes/AGENT_PROMPT.md`; where the two differ, this one wins for the overhaul work.

## Read first, in this order

1. `README.md` (what is in this folder)
2. this file
3. `plan.md`: the work, task by task. This is the contract.
4. `TRACKER.md`: the only progress record.
5. `DESIGN.md`: how it must look and read. Pinned strings are in section 9.
6. `AUDIT.md`: why each task exists, with evidence. Skim it; open it when a task confuses you.
7. The repo's own `fixes/AGENT_PROMPT.md` and `design.md` section 0 (working rules).

Line numbers in `plan.md` are from v1.1.0. **Search by the symbol or string, not by the line number**, and confirm it still reads as the plan says before you change it. If the code and the plan disagree, stop (see Stop rules).

## Authorization

- Reading and updating `TRACKER.md` is always allowed.
- Do not edit app code, tests, build files or settings until the owner says to start, and says which phase. A plan or tracker is not authorization.
- After reading, if there is no start instruction, report "plan and tracker reviewed" in two lines and wait.
- Work one task at a time, in plan order. At the end of each phase, stop and report. Do not begin the next phase until the owner says so. Phase 0 is meant to ship alone as v1.0.1. The version stays 1.0.1 for all phases (D9): never change `version` in `public/manifest.json` or `package.json`; add changelog lines under the 1.0.1 heading instead.

## Work rules

- Work alone. Do not create or use sub-agents.
- Write the failing test first (plan says which), see it fail, then make it pass. If a task says "Test (first)", that order is required.
- Copy code from `plan.md` where it gives code. Where it gives a signature and a test, write the body yourself, the simplest thing that passes. Do not be creative, do not refactor, do not rename things the plan does not name.
- Touch only the files in the task's **Files** line. Preserve unrelated changes and user data. Do not edit `dist/`, `plan/`, `fixes/`, `docs/`, `store-assets/` (except T5.1 and T7.2), or this folder (except `TRACKER.md`).
- No new dependencies. No network calls (`fetch`, `XMLHttpRequest`, `WebSocket`): `tests/claims.test.ts` scans all of `src/` for them. No `alert`, `confirm`, `prompt`. No `any`, `as any` or `@ts-ignore`.
- Follow the repo's copy rules: sentence case, and none of the words *completely, instantly, cannot, always, guaranteed* in `src/ui` (the existing list name `Always` is the one exception).
- Use fake clocks in tests. Do not call the wall clock inside logic that a test covers.
- Do not push to GitHub and do not start or watch GitHub Actions unless the owner asks (decision D8).
- Never print or commit secrets.

## Checks

After every coherent change run, and record the result for:

```
npm test
npm run typecheck
npm run build
```

Fix what you broke before moving on. Do not leave a red check "for later".

**Browser checks.** Several tasks need a real browser (the smoke test, screenshots, zoom, keyboard). If your environment cannot run one, do not tick those boxes. Write `UNVERIFIED: needs a browser` next to the item in `TRACKER.md` and add the exact command or the screenshot list to "Owner-run checks". Keep going with everything else. Never write that something passed if you did not observe it.

## Tests: what you may change

You may add tests freely. You may edit an existing test only when it pins a string or structure that a task in this plan deliberately replaces, and only in the same commit as that task. Log each such edit in the "Test edits" table of `TRACKER.md` (file, what changed, which task). Never delete a test or weaken an assertion to get green.

Tests that already pin things you will meet:

| Test | Pins |
|---|---|
| `tests/claims.test.ts` | the two lock sentences (None, Commit), onboarding strings, block page case branches, `reason.kind === "session" \|\| reason.kind === "standalone"`, `state.dayStats[dateKey]?.blocks`, `chrome.tabs.getCurrent()`, `chrome.tabs.remove(current.id)`, no promo links on the block page, `.fg-panel` with `min-width: 300px`, no `fetch(` anywhere |
| `tests/ui/foundation.test.ts` | every token name and every `.fg-*` foundation class; hex colours only inside the theme token blocks |
| `tests/ui/themeTokens.test.ts` | 4.5:1 contrast for text, text-muted, text-subtle, accent, danger, warning, info on bg, surface and surface-2; the system theme equals dark and light; every `font-size` is px or rem and at least 12 |
| `tests/ui/panelRender.test.tsx` | class `fg-hero__time`; exactly one `.fg-btn--primary` when idle and none while running; extend chips only while running |
| `tests/ui/primitives.test.tsx` | `Segmented` buttons carry `aria-pressed` |
| `tests/shared/blockPage.test.ts` and `tests/fixtures/v2-storage.expected.json` | the default block-page message string |

## Decisions

`plan.md` lists D1 to D8 with defaults. Use the default unless the owner has changed it in `TRACKER.md`. Do not ask the owner about a decision that has a default. If you meet a question that is not covered, stop and ask (one question, with your recommended answer).

## Stop rules

Stop, write it in `TRACKER.md`, and report to the owner when:

- the same check fails after 3 fix attempts;
- the code does not match what the plan describes and reading does not settle it;
- a task would break a pinned string or a test listed above;
- a task's **Stop if** line applies;
- you are tempted to touch a file outside the task's **Files** line, or to change behaviour the plan does not mention;
- something looks like data loss (settings, rules, history, password).

Report: which task, what you did, the exact error or diff, and the options you see. Then wait.

## Tracker discipline

- Start of a phase: mark it IN PROGRESS and add a dated note.
- As soon as a task passes or fails, update its line and add the evidence row: changed files, the command, the observed result.
- Tick a box only after the work is done and verified. Partial or unverified work stays unticked.
- Do not erase failures. Append what happened next.
- Before you finish, reconcile the tracker with the code and say plainly what is incomplete and why.

## Commits

One commit per task: `T<id>: <what changed>` (for example `T1.1: reconcile after blocking-relevant UI writes`). Add files by name. Do not rewrite history.

## Final report

Completed and open tasks, checks run (with counts), changed files, tests edited, decisions used, failures and blockers, items marked UNVERIFIED, and what the owner must run. Never claim an unobserved result passed.
