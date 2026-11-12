# Phase 10 evidence

What is in this folder, and what it does and does not show.

Phase 10 is the owner's third feedback round (messages of 2026-11-11): minutes from a stopped session should not count toward the goal; say so before a person stops; make the end of a session feel rewarding (a done card, a goal moment, a soft chime on by default); then, mid-phase, make the "Nothing is blocking right now" card dismissable and give the panel's settings button an icon that says "full screen".

| Path | What it is |
|---|---|
| `screens/{light,dark}-done-plain-400.png` | The done card after a 25 min session with a 5 min break running: "25 min, done", "35 min from today's goal.", the ring at 42%, the break tip. |
| `screens/{light,dark}-done-goal-400.png`, `...-goal-320.png` | A session that takes the day to the 60 min goal: ring at 100%, the mint "Daily goal reached" pill, "Unlocked: Iron Session". At 400 px and 320 px. |
| `screens/*-goal-*-mid.png` | The same card half a second after it appears, with the dots still rising (the frame is a moment in a 1.4 s animation, so the dots differ run to run). |
| `screens/*-done-goal-reduced-motion.png` | The same card with the operating system set to reduced motion: a full ring, the pill, no dots. |
| `screens/*-done-stopped-400.png` | A session stopped after 12 minutes: a plain card ("You focused for 12 minutes. Pick it up whenever you're ready."), no ring, no pill, no dots. |
| `screens/*-panel-{400,320}-{idle,hidden}.png` | The panel with the idle status card and its X, and after hiding it (no gap left). The header's settings button is the box-with-an-arrow icon. |
| `screens/*-dashboard-{idle,hidden}.png` | The same card on the full-screen dashboard, shown and hidden. |
| `logs/done-card-{light,dark}-log.txt` | One line per check from Chromium: 57 checks, all pass, in both themes. Covers the card text, the goal line, the pill, the ring's spoken value, that the dots and the ring animate only when motion is allowed and the dots run once, that reduced motion shows no dots, the chime (one audio context and three sine notes, none again after a reload, none for a stopped session, none with the setting off), dismissing and staying dismissed after a reload, no sideways scroll, no page errors. |
| `logs/idle-strip-{light,dark}-log.txt` | Chromium checks for the hide button and the settings icon: 28 checks, all pass, in both themes. The settings button opens `dashboard.html#settings`. |
| `logs/show-hidden-{light,dark}-log.txt`, `screens/*-settings-hidden-messages.png` | Chromium checks for the Settings button that brings back hidden messages: 9 checks, all pass, in both themes. The card comes back on the same page without a reload. |
| `logs/done-card-contrast-log.txt` | Contrast of the new colour pairs (pill text on mint, ring stroke, ring percent, muted line), from the repo's own tokens. All meet their target. |
| `logs/stand-in-per-file-run.txt` | The end-of-phase run, each test file in its own process: 118 files, 900 passed, 1 failed, 0 did not run. |
| `logs/stand-in-full-run.txt` | The whole suite in one process: 118 files, 899 passed, 2 failed. The failures are the same two cases in `tests/shared/storage.test.ts` as in Phase 9 (the shared migration promise and the one-call `getState()`). That file is unchanged and fails the same way on earlier trees in my runner, so I count them as a limit of the stand-in. Only a real Vitest run can confirm that. |
| `logs/uicheck-log.txt` | The strict type check over `src/ui`, `src/shared` and `src/lib`: exit 0, no output. |
| `logs/main-tsc-list.txt` | The main `tsc` list (83 lines, all from this sandbox having no `node_modules`). It is identical to the baseline kept since Phase 7, so the background changes add no type error. |
| `logs/contrast-check-log.txt`, `logs/colour-report-log.txt` | `overhaul/tools/contrast-check.mjs` and `overhaul/evidence/phase8/colour-report.mjs`: all pairs meet their target. |
| `harness/` | The scripts that took the screenshots and wrote the logs, plus the build and per-file runner. Kept as a record: they point at my scratch folder, so they will not run as they are. |

I did not keep a separate red-run log this phase. Each new test was run before its code existed and failed (the module could not load, or the assertion failed); the tracker rows say which. One test of mine (`chimeToggle`) first errored for a reason unrelated to the feature (my test lacked a `ToastProvider`), and I fixed that before counting it.

## What changed in the behaviour

| | Before | Now |
|---|---|---|
| Minutes from a session stopped early | Counted toward the goal, the ring, the focus score and Quiet Win | Shown in Focused today, with the line "N min stopped early, not counted toward your goal."; not counted toward any of those. The streak already used finished sessions only. |
| The stop dialog | No mention | First line: "Minutes before you stop show as focused time, but they don't count toward today's goal or your streak." |
| End of a session | A notification only | A card on the Focus tab: real minutes, one true line, achievements, break tip; a goal ring; a mint "Daily goal reached" with dots rising once; a soft chime (on by default) |
| A stopped session's end | Nothing | A plain card: "You focused for N minutes. Pick it up whenever you're ready." |
| The notification | "25 min done — nice work." | "Nice. 25 min done. Take 5." (the break part only when a break starts) |
| "Nothing is blocking right now" | Always there | Has an X; hidden in this browser (panel and dashboard), and only that message can be hidden. Settings has a "Show hidden messages" button that brings back it and every other hidden tip |
| Panel settings button | A sliders icon, "Open settings" | A box with an arrow leaving the top right, "Open settings in full screen" |
| Backup | | `stoppedMs` and `notifications.chime` are accepted; older backups without them still import |

## How the screens were made

The real pages (`src/ui`) were bundled with esbuild and opened in headless Chromium from a local web server on 127.0.0.1. Four things stand in for the real thing:

- the background worker is replaced by a recorder, and the saved state is put straight into storage, so the screens and clicks are real but the guard, the hashing and the extension storage are not exercised in the browser (they are unit tested);
- Web Audio is replaced by a recorder that counts the contexts and notes asked for, so the checks show the chime was requested once with three quiet sine notes; they do not show that anything was audible;
- the Lucide icons are a small stub, so the real settings icon (`ExternalLink`) may differ by a pixel;
- Tailwind is not installed in this sandbox, so a short reset stands in for its base styles.

## What this is not

It is not a run of the loaded extension. Chrome's own side panel, the real background worker (which decides when a session ends and writes the record the card reads), whether Chrome lets the chime play, forced-colours mode, a screen reader and any browser other than Chromium are not covered. The owner-run checks in `overhaul/TRACKER.md` list what to look at in a real Chrome. In particular, nobody has yet heard the chime in a real panel.
