# FocusGate overhaul pack

An audit of FocusGate v1.1.0 and a plan to fix it and give it a TBTechs identity. Written to be handed to a coding agent (a weaker model is fine: the plan gives exact files, code, tests and wording). Nothing here changes your repo until you copy it in and tell the agent to start.

## What is in it

| File or folder | What it is | Read it when |
|---|---|---|
| `AUDIT.md` | The assessment: scoreboard, the crash and its cause, 7 bugs that are live now, what is wrong with schedules, the profile page and status talk, what is good, what I did not verify | first, about 10 minutes |
| `plan.md` | The work: 39 tasks in 8 phases. Each task has files, code or signatures, a test to write first, a "done when" and a "stop if". Decisions D1 to D8 sit at the top with defaults | the agent reads it, you skim the phase table |
| `DESIGN.md` | The look and the words: the "gate board" idea, colours, type, layout, motion, and every new UI string, word for word | before Phase 3 and everything after |
| `AGENT_PROMPT.md` | Rules for the coding agent: order of reading, what it may touch, which existing tests pin what, when to stop | paste it as the agent's first message |
| `TRACKER.md` | Progress record the agent keeps. Your decisions go in the table at the top | after each phase |
| `tools/e2e/` | `smoke.cjs`: loads the built extension in real Chromium and fails on crashes (plus accessibility, engine and slow-session checks). Instructions for Windows and Linux in its README | after each phase |
| `tools/contrast-check.mjs` | The colour palette and a contrast checker that mirrors your own `themeTokens.test.ts`. `--css` prints the lines to paste | Phase 5 |
| `assets/icons/` | Your four app icons with the opaque white corners removed | Phase 5 |
| `templates/` | `tsconfig.ui.json` and `env.d.ts` so `npm run typecheck` covers `src/ui` | Phase 0 |
| `evidence/` | What I measured: 6 probe scripts and their JSON results, smoke test output on the shipped and repaired builds, 15 screenshots, the typecheck logs, and `p0-reference.patch` (the Phase 0 fixes, built and smoke-tested) | when you doubt a finding |

## How to use it

1. Copy this folder into the repo root as `overhaul/`, next to `fixes/`.
2. **Do Phase 0 first.** It is small and ships as v1.0.1. Today every alarm throws (focus sessions and schedules never end), the full-tab dashboard shows "could not start" on every tab, and **Check a URL** blanks the side panel. `evidence/p0-reference.patch` is the working fix if you want it now.
3. Give your coding agent this as its first message:

   > Read `overhaul/README.md`, then `overhaul/AGENT_PROMPT.md`, `overhaul/plan.md`, `overhaul/TRACKER.md`, `overhaul/DESIGN.md`. Do not change any code yet. Tell me in two lines that you have read them. When I say "start Phase 0", do only Phase 0, then stop and report.

4. After each phase, run the smoke test yourself on your PC (commands in `tools/e2e/README.md`) and look at the screenshots the agent lists. Agents in sandboxes usually have no browser, so those items stay marked `UNVERIFIED` until you run them. That is by design.
5. Version stays **1.0.1** for every phase (D9). No phase bumps it; each phase adds its changes under the 1.0.1 entry in `CHANGELOG.md`.

## What I need from you (all optional; defaults are filled in)

| | Question | If you do nothing |
|---|---|---|
| D1 | Brand: keep the logo and align the UI to it, or send the FocusFlow palette so the two products match | UI follows the logo (periwinkle, with amber for "blocking") |
| D2 | Fonts: send the Barlow `.woff2` files (SIL OFL, free) and the agent bundles them | system font is used |
| D3 | Profile: keep tasks, reflection and habits under a collapsed "Journal and tasks" | yes, kept, collapsed |
| D4 | Pause or snooze: it conflicts with Strict and Commit, so your call | not built |
| D6 | Shortcuts: keep Alt+Shift+F and Alt+Shift+B | kept, plus a settings row that shows which keys are really assigned |
| D8 | Push to GitHub and run CI per phase, or commit locally and you push | agent commits locally, never pushes |

## What I did not verify

Notifications actually appearing, the weekly report's content, the content-script filters on the 8 sites, daily limits adding up over a day, browser zoom visuals, whether alarms survive a browser restart, whether Alt+Shift+B is taken on Windows (it was unassigned in Chromium on Linux, cause unknown), and the panel's look at 300 px. The full list is in `AUDIT.md` section 9. Everything marked verified in the audit was observed in a real Chromium with the real built extension, not guessed from the code.
