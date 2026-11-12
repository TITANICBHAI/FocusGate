# Phase 11 evidence: Firefox readiness and the release script

Nothing here ran in a real Firefox, real Vitest or against real GitHub. This sandbox has no Firefox, no `node_modules` and no network.

| File | What it shows |
|---|---|
| `logs/stand-in-per-file-run.txt` | Every test file run on its own in the stand-in runner: see the log (the same one storage case) (`tests/shared/storage.test.ts`, the one-call `getState()` case). |
| `logs/stand-in-full-run.txt` | The whole suite in one process: 121 files, 940 passed, 2 failed (the same file). The runner's `vi.resetModules()` does nothing, so the cached storage module skips its first read. Vitest's does reset; the owner's CI passed these cases at Phase 7. |
| `logs/main-tsc-list.txt` | Sorted `tsc --noEmit` error list for the main config: 83 lines, identical to the baseline (missing-package errors only). The strict UI type check printed nothing. |

New tests: `tests/background/firefoxFallbacks.test.ts` (11), `tests/ui/firefoxSettingsCopy.test.tsx` (9), `tests/scripts/firefoxManifest.test.ts` (11), `tests/scripts/githubRelease.test.ts` (12). Each was seen failing first (missing module or export).

Not checked, see the TRACKER "Owner-run checks": loading the zip in Firefox desktop and Android, the toolbar click, DNR blocking in Firefox, `npm run release:github` against GitHub.
