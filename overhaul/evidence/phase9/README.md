# Phase 9 evidence

What is in this folder, and what it does and does not show.

Phase 9 is the owner's second feedback round (message of 2026-11-10): call the secret a password again, make a generated one at least 20 characters, and let a person type 8 to 28.

| Path | What it is |
|---|---|
| `screens/light-strict-*.png`, `screens/dark-strict-*.png` | The Strict start question: no password saved, a generated password, a typed one, a saved one, a new one (P9.3). The generated password is 20 to 28 characters on one line, in a monospace type. |
| `screens/*-longpw-{400,320,200}.png` | The longest password FocusGate can make, 28 characters, in the Strict sheet at three widths: 400 px (the usual panel), 320 px and 200 px (a 400 px panel at 200% zoom). One line at 400 px, two at 320 px and three at 200 px; it stays inside its box and the page never scrolls sideways. The text is a stand-in string of 28 `W`, put into the real element, because the real one is random. Light and dark. |
| `screens/*-settings-password-*.png` | The Settings password card: none, generated, set. Light and dark. |
| `screens/*-nudge-*.png` | The "No password yet" note on the Rules tab, in the panel and the dashboard. Light and dark. |
| `screens/*-setup-*.png` | The setup offer card in the panel, its failure message, the You tab "Run setup" row, and the last setup screen with a generated password. Light and dark. |
| `logs/{strict,settings-password,nudge,setup-offer}-{light,dark}-log.txt` | One line per check from the Chromium scripts: strict 36, settings 9, nudge 8, setup offer 30. All pass, in both themes. |
| `logs/longpw-{light,dark}-log.txt` | The 28-character check above, as numbers: lines used, width, and that nothing overflows. 12 checks, all pass, in both themes. |
| `logs/stand-in-red-run.txt` | The red run, taken with the new and renamed tests in place and the source still as it was at the end of Phase 8. Each test file in its own process: 108 files, 100 ran (677 passed, 33 failed) and 8 could not load, because they import a file or a constant that did not exist yet. One of the 33 is the `storage` case below. |
| `logs/stand-in-per-file-run.txt` | The green run at the end of the phase, each test file in its own process: 108 files, 792 passed, 1 failed, 0 did not run. |
| `logs/stand-in-full-run.txt` | The green run with the whole suite in one process, the way Phase 8 was recorded: 108 files, 791 passed, 2 failed. The failures are two cases in `tests/shared/storage.test.ts` (the shared migration promise and the one-call `getState()`). That file is unchanged since Phase 7 and fails the same way on the Phase 7 tree in my runner, so I count them as a limit of the stand-in, not of the code. Only a real Vitest run (an owner-run check) can confirm that. |
| `logs/uicheck-log.txt` | The strict type check over `src/ui`, `src/shared` and `src/lib`: exit 0, no output. |
| `logs/main-tsc-diff.txt`, `logs/main-tsc-list.txt` | The main `tsc` list against the 83-line baseline kept since Phase 7: nothing new, nothing gone. The 83 lines come from this sandbox having no `node_modules`. |
| `logs/contrast-check-log.txt`, `logs/colour-report-log.txt` | `overhaul/tools/contrast-check.mjs` and `overhaul/evidence/phase8/colour-report.mjs`. All pairs meet their target. Phase 9 added no colour; the run shows the renamed classes did not disturb the existing ones. |
| `harness/` | The scripts that took the screenshots and wrote the logs, plus `each.sh` (the per-file runner) and `rename_pin.py` (the scripted rename, run once as a dry run and then applied, with each file reviewed). Kept as a record: they point at my scratch folder, so they will not run as they are. `settings-password.cjs` is `settings-pin.cjs` from Phase 8. |

## What changed in the behaviour

| | Phase 8 | Phase 9 |
|---|---|---|
| Name on screen | PIN | password |
| A password you type | 4 to 64 characters | 8 to 28 characters |
| A generated one | six digits | 20 to 28 characters from `ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789` (no 0, 1, I, O, i, l, o), drawn with `crypto.getRandomValues` |
| Checking a saved one | any length | any length (so a longer password saved before still unlocks) |

## How the screens were made

The real pages (`src/ui`) were bundled with esbuild and opened in headless Chromium from a local web server on 127.0.0.1. Three things stand in for the real thing:

- the background worker is replaced by a recorder that logs each message and answers it, so the screens and clicks are real but the guard, the hashing and the storage are not exercised in the browser (they are unit tested);
- the Lucide icons are a small stub;
- Tailwind is not installed in this sandbox, so a short reset stands in for its base styles. Colours, spacing and type come from the repo's own stylesheet, but the real build may differ by a pixel or two.

The generated passwords in the screens come from the real `generatePassword()` running in the page, so every run shows different ones. The scripts check the shape of what is shown (20 to 28 letters and digits, without 0, 1, I, O or l), that "Copy password" puts exactly that text on the clipboard and that "I have saved it" sends exactly that text. Their pattern is looser than the real alphabet, which also leaves out i and o; the exact alphabet is pinned by `tests/shared/password.test.ts`, which draws 100 passwords and checks every character.

## What this is not

It is not a run of the loaded extension. Chrome's own side panel, the install-time setup tab, the real background worker, forced-colours mode, a screen reader and any browser other than Chromium are not covered. The owner-run checks in `overhaul/TRACKER.md` list what to look at in a real Chrome. In particular, the 20 to 28 character password was never typed into a real field by a person; the screens only show it.
