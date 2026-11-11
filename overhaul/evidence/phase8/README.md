# Phase 8 evidence

What is in this folder, and what it does and does not show.

| Path | What it is |
|---|---|
| `screens/looks-before-*.png`, `screens/looks-after-*.png` | Every main screen before and after the colour pass (task P8.8), in the light and the dark theme: panel (Focus idle, session running, Rules, You, first run), dashboard (Overview, Rules, Reports, Settings), block page and setup page. "Before" was taken at the start of the colour pass, "after" from the final build. |
| `screens/block-page-light-and-dark.png` | The block page, light and dark, side by side. |
| `screens/strict-*.png` | The Strict start question (P8.5): no PIN saved, generated PIN, typed PIN, saved PIN, new PIN. Light theme. |
| `screens/settings-pin-*.png` | The Settings PIN card (P8.4, P8.6): none, generated, set. Light theme. |
| `screens/nudge-*.png` | The "No PIN yet" note on the Rules tab, in the panel and the dashboard (P8.6). Light theme. |
| `screens/setup-*.png` | The setup offer card in the panel, its failure message, the You tab "Run setup" row, and the last setup screen with a generated PIN (P8.7). Light theme. |
| `logs/*-log.txt` | One line per check from the Chromium scripts. `strict`, `settings-pin`, `nudge` and `setup-offer`, each in the light and the dark theme. |
| `logs/stand-in-full-run.txt` | The whole test suite in my stand-in runner at the end of the phase: 107 files, 783 passed, 2 failed. The 2 are cases in `tests/shared/storage.test.ts`, which is unchanged since Phase 7 and fails the same way on the Phase 7 tree in my runner. |
| `colour-report.mjs`, `colour-report-log.txt` | Contrast of every text and accent colour on every new tint, read from the real stylesheet, in both themes. Run it with `node overhaul/evidence/phase8/colour-report.mjs`. |
| `harness/` | The scripts that took the screenshots and wrote the logs, kept as a record. They point at my scratch folder, so they will not run as they are. |

## How the screens were made

The real pages (`src/ui`) were bundled with esbuild and opened in headless Chromium from a local web server on 127.0.0.1. Three things stand in for the real thing:

- the background worker is replaced by a recorder that logs each message and answers it, so the screens and clicks are real but the guard and the storage are not exercised (they are unit tested);
- the Lucide icons are a small stub;
- Tailwind is not installed in this sandbox, so a short reset stands in for its base styles. Colours, spacing and type come from the repo's own stylesheet, but the real build may differ by a pixel or two.

## What this is not

It is not a run of the loaded extension. Chrome's own side panel, the install-time setup tab, the real background worker, forced-colours mode and any browser other than Chromium are not covered. The owner-run checks in `overhaul/TRACKER.md` list what to look at in a real Chrome.
