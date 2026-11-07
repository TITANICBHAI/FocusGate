# Smoke test for the built extension

`smoke.cjs` loads the real `dist/` folder in Chromium (not jsdom) and fails when something crashes. It exists because every bug in `AUDIT.md` section 3 passed `npm test`, `npm run typecheck` and `npm run build`, and only shows up in a real browser.

## Run it

Playwright and axe-core are installed **outside** the repo, because the project rule is "no new dependencies".

**Linux or Replit-like shell (no display):**

```bash
mkdir /tmp/fg-e2e && cd /tmp/fg-e2e && npm i playwright axe-core && npx playwright install chromium
export NODE_PATH=/tmp/fg-e2e/node_modules
cd <repo> && npm run build
xvfb-run -a node tools/e2e/smoke.cjs dist
```

**Windows (PowerShell), on your own PC:**

```powershell
mkdir $env:TEMP\fg-e2e; cd $env:TEMP\fg-e2e; npm i playwright axe-core; npx playwright install chromium
$env:NODE_PATH = "$env:TEMP\fg-e2e\node_modules"
cd <repo>; npm run build
node tools/e2e/smoke.cjs dist
```

A browser window opens and closes by itself (about 40 seconds). Do not use the machine's mouse while it runs.

## Flags

| Flag | Adds | Extra time |
|---|---|---|
| (none) | alarms fire without errors; panel (all tabs and Rules sub-tabs, including **Check a URL**), dashboard (5 tabs and a 640 px width), block page, onboarding all render without errors or a crash screen | about 40 s |
| `--a11y` | axe-core on every page; fails on critical or serious violations | +20 s |
| `--slow` | a 1-minute strict session must finish, be recorded, and release its lock | +75 s |
| `--engine` | UI edits must reach the network blocker within 1 s (added site, removed site, schedule on now, deleted schedule). **Red until T1.1 and T1.2 are done.** | +10 s |

## Reading the result

The last lines are `PASS <n>  FAIL <m>` and one `FAIL` line per problem. Exit code 0 means no failures, 1 means failures, 2 means the script itself crashed (usually "Cannot find module 'playwright'": set `NODE_PATH` as above).

## What it printed when I ran it

| Build | Result |
|---|---|
| shipped v1.1.0 (`evidence/results/smoke-v1.1.0-unfixed.txt`) | `PASS 14  FAIL 17`, exit code 1. Failures: alarms throw `name.startsWith is not a function`; **Check a URL** gives `assessUrl is not defined` and a blank panel; all 5 dashboard tabs and the 640 px dashboard show "could not start" (`useState is not defined`). |
| with T0.1 and T0.3 applied (my scratch copy) | `PASS 31  FAIL 0` |
| same, plus `--engine` (`evidence/results/smoke-fixed-with-engine.txt`) | `PASS 31  FAIL 4`: the four engine checks, red until T1.1 and T1.2 |

Observed in Chromium on Linux with Playwright. Not run on Windows.

## Notes

- The commands line it prints (`commands: toggle-focus=…, block-current-site=…`) shows which keyboard shortcuts Chromium actually assigned. On Linux `block-current-site` showed `UNASSIGNED`. Whether Windows does the same is not known; see T6.2.
- If you change the crash screen's wording (T0.4), the script already looks for both `could not start` and `hit a problem`.
