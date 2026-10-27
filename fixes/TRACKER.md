# FocusGate Extension — Implementation Tracker

Companion to [`plan.md`](plan.md) in this folder — the implementation contract — and [`AGENT_PROMPT.md`](AGENT_PROMPT.md) — the pre-prompt given to the implementing agent.
Initialized **2026-10-25**. Progress and verification notes are recorded below. Some implementation work is marked complete or in progress; verify the current files and evidence before relying on those entries. Existing “delegated testing” notes are historical plans, not verification results.

**Status legend:** ☐ NOT STARTED · ◐ IN PROGRESS · ☑ COMPLETE (done **and** verified) · ⛔ BLOCKED · ⏭ DEFERRED (owner decision required)

---

## 1. Tracker rules (mandatory for every agent)

1. At the start of a phase (work package), set it to IN PROGRESS and record a dated start note in its notes **before** doing its work.
2. After each meaningful change, update the relevant phase notes, status, progress, evidence, and history; do not wait until the phase is complete.
3. As soon as any checklist item or individual verification step (including each test, lint, or build check) completes or fails, update its checkbox/status and record the exact command and observed result in `fixes/TRACKER.md` **before** starting the next item or check.
4. Tick a checkbox only after its work is complete and verified. Never mark attempted, partial, or unverified work complete.
5. For every completed item, record changed files, the exact verification performed, and its observed result.
6. If a check fails, leave the affected item unchecked and record the observed failure. Preserve it in the tracker; append the fix and successful rerun when available.
7. Record decisions, blockers, and deferred work. Do not erase old evidence or failure history — append the outcome so another agent can follow the history.
8. Before finishing, reconcile `fixes/TRACKER.md` with the actual code and test evidence. Leave incomplete items unchecked and explain why.

---

## 2. Operating rules (binding — mirrored in `plan.md` and `AGENT_PROMPT.md`)

1. **Authorization and pause.** The plan is the implementation contract, not authorization by itself. Reading, inspecting, and maintaining these planning documents is allowed before implementation begins. Do not edit app code, tests, build files, settings, or other behavior until the owner explicitly authorizes implementation. If scope or authorization is unclear, stop and ask.
2. **Work alone.** Do not create, invoke, or delegate to sub-agents.
3. **Follow the plan and tracker.** Work in plan order, use this tracker as the only progress record, and do not silently widen scope or change the plan's contract.
4. **Inspect before editing.** Before any authorized implementation, inspect the relevant current code, project instructions, and working tree. Confirm current APIs and behavior instead of assuming the plan's code snapshot is current. Preserve unrelated user changes and user data.
5. **Respect the no-touch list.** Unless the owner explicitly changes scope, do not hand-edit `dist/` (plan §2.11), blindly recreate files missing from the upload (plan §1.2), or port the "Do not port" features (plan §6 WP7), including the Discord webhook and any telemetry. Do not overwrite the separate root `plan/` folder; the active documents are in `fixes/`.
6. **Destructive actions.** Treat task replacement and any other deletion of user data as destructive. Keep replacement disabled by default, preserve explicit confirmation and required safety guards, and do not perform destructive actions without the owner's authorization.
7. **Testing environment.** Run relevant checks on Replit using this project's existing workflows or scripts. For this browser extension, use the applicable npm scripts (`npm run typecheck`, `npm test`, `npm run build`); do not run Android tests or build APKs in this repository. If Android/APK verification is explicitly in scope, test only the production flavor, never build APKs on Replit, and use GitHub Actions for APK-building verification only when the owner explicitly asks. State plainly whenever a check was not run.
8. **GitHub.** Do not push to GitHub or start, poll, or monitor GitHub Actions unless the owner explicitly asks.
9. **Secrets.** Do not expose, copy into files, or print secrets or credentials.
10. **Test style.** Use behavior tests with fake clocks and event sources. Do not add tests that read Kotlin source files as text. Logic under test must not call the system wall clock directly.
11. **Tracker discipline.** Follow the tracker rules in §1 at all times.
12. **Phase checkpoints.** Work on one work package at a time. At each phase boundary, stop and report; do not begin the next phase until the current phase's completion conditions and required checks pass. Respect all dependency gates in the plan.

---

## 3. Verification constraints (what counts as evidence)

- Run applicable checks on Replit using this project's existing workflow or scripts. For the browser extension, use `npm run typecheck`, `npm test`, and `npm run build` as required by the plan.
- This repository does not need Android tests or APK builds. If Android/APK verification is explicitly in scope, test only the production flavor, do not build APKs on Replit, and use GitHub Actions for APK-building verification only when the owner explicitly requests it.
- Record plainly when a check was **not run**; never imply an unobserved check passed.
- Unit/behavior tests use fake clocks and injected event sources; logic under test must not call the system wall clock; no tests that read source files as text.
- Manual browser checks (Chrome / Edge / Firefox temporary add-on) are recorded per browser with the exact repro steps and observed result.
- The plan's shell examples are POSIX; on the owner's Windows machine, adapt commands or run them on Replit.

---

## 4. Progress overview

Implementation order is fixed: **WP0 → WP1 → WP1b → WP2 → WP3 → WP4 → WP5 → WP6 → WP7 (Tier A → Tier B) → WP8 → WP9 → WP10.**
Guards: WP1b spikes must finish before WP2/WP3. Do not start WP7 before milestone **M1 (WP0–WP3) is green** (plan §6).

| Phase | Title (plan §) | Status | Tasks | ACs | Blocked by |
|---|---|---|---|---|---|
| WP0 | Repo hygiene and tooling (§6 WP0) | ◐ | 4/5 | 0/1 | WP0.4 + AC are NOT RUN; re-check the current environment before verification |
| WP1 | Foundation: shared core, build, storage, migration (§6 WP1) | ◐ | 0/5 (prior tracker says code-complete; verify current files) | 0/1 | command-based verification remains NOT RUN |
| WP1b | De-risking spikes (§6 WP1b) | ☐ | 0/4 | 0/1 | WP1 |
| WP2 | Session engine owned by background (§6 WP2) | ☐ | 0/4 | 0/10 | WP1b |
| WP3 | Blocking engine (§6 WP3) | ☐ | 0/12 | 0/10 | WP1b |
| WP4 | Content script (§6 WP4) | ☐ | 0/8 | 0/7 | WP3 |
| WP5 | UI foundation and screen fixes (§6 WP5) | ☐ | 0/13 | 0/5 | WP4 |
| WP6 | Security, standalone, protection, backup (§6 WP6) | ☐ | 0/8 | 0/9 | WP5 |
| WP7 | Feature ports — Tier A (A1–A12), Tier B (B1–B7) (§6 WP7) | ☐ | 0/19 | 0/1 | M1 green |
| WP8 | Stats, insights, reports (§6 WP8) | ☐ | 0/4 | 0/4 | WP7 Tier A |
| WP9 | QA hardening (§6 WP9) | ☐ | 0/5 | 0/1 | WP8 |
| WP10 | Release (§6 WP10) | ☐ | 0/5 | 0/4 | WP9 |

### Milestones (plan §9)

| Milestone | Contains | Exit criteria | Status |
|---|---|---|---|
| M1 — Correct core | WP0–WP3 incl. WP1b (+ WP4 deletes old scripts) | WP1–WP3 AC green; old `public/background.js` removed; plan §8.3 lifecycle tests 1–4 pass | ☐ |
| M2 — Trustworthy UI | WP4–WP6 | WP4–WP6 AC green; their §4.7 rows pass in §8.4 | ☐ |
| M3 — Features | WP7 Tier A, WP8 | Tier A and WP8 AC green | ☐ |
| M4 — Release | WP9, WP10 | §8.2–§8.4 fully green; upgrade test passes | ☐ |

### Global definition of done (plan §9)

- [ ] `npm run typecheck`, `npm test`, `npm run build` all clean
- [ ] No `alert(` anywhere in `src/`
- [ ] No `localStorage` outside the Vite-dev fallback
- [ ] No module-level *authoritative* state in `src/background` (harmless ephemeral caches allowed)
- [ ] No per-second storage writes during a running session
- [ ] Every new string passes the banned-word check (plan C.6)
- [ ] Manifest permissions match the justification table (plan WP10)
- [ ] `CHANGELOG.md` updated

---

## 5. Work packages

> Each WP below has the same layout: **Status / start note → Tasks → Acceptance criteria → Evidence table → Notes (append-only)**.
> Tick an AC only with recorded evidence. Update the Status line and notes as you work, not afterwards.

### WP0 — Repo hygiene and tooling (plan §6 WP0; fixes R01–R03, R05)

Status: ◐ IN PROGRESS — file work complete 2026-10-26; typecheck baseline and acceptance check remain NOT RUN · Progress: 4/5 tasks, 0/1 AC

**Tasks**
- [x] WP0.1 `package.json`: name `focusgate`, version `1.1.0-dev`; remove `express`, `@types/express`, `dotenv`, `tsx`; `clean` → `rm -rf dist build`; add `typecheck` (`tsc --noEmit`), `test` (`vitest run`), `build` (`node scripts/build-extension.mjs`) — found already at target state from a prior session; verified by inspection 2026-10-26
- [x] WP0.2 Delete `patch_req.cjs`; add `.gitignore` (`node_modules`, `dist`, `build`, `*.log`); untrack `dist/` — `patch_req.cjs` absent, `.gitignore` covers node_modules/dist/build/coverage/*.log/.env*, `dist/` absent; `git rm` step N/A (folder is not a git repository)
- [x] WP0.3 Check the GitHub repo for files missing from the upload (plan §1.2) — moot: `LICENSE` (MIT, © 2026 TBTechs), `STORE_LISTING.md`, `STORE_PUBLISHING.md`, `AFTER_PUBLISHING.md`, `docs/` (incl. `privacy-policy.html`), `store-assets/`, `.github/` all exist locally; left untouched
- [ ] WP0.4 Run `npm run typecheck`; record the baseline error list (expect the L1197 comparison and prop-type hacks) — **NOT RUN 2026-10-26: the prior session recorded that node/npm was unavailable; no command result is present. Re-check the current environment before verification.**
- [x] WP0.5 Add `vitest` and an empty `tests/` folder with one smoke test; add `CHANGELOG.md` — vitest ^4.1.11 in devDependencies, `tests/manifest.smoke.test.js` present, `CHANGELOG.md` has a 1.1.0-dev entry; verified by inspection

**Acceptance criteria**
- [ ] WP0.AC `npm ci && npm run typecheck && npm test` run (typecheck may still list legacy errors until WP5 deletes `App.tsx`); `dist/` untracked; `patch_req.cjs` gone; `package.json` has no server dependencies — **NOT RUN 2026-10-26: the prior session recorded that node/npm was unavailable; no command result is present. Re-check the current environment before verification.**

**Evidence**

| Date | Item | Changed files | Verification (exact command / repro) | Result |
|---|---|---|---|---|
| 2026-10-26 | WP0.1 | `package.json` (pre-existing at target state) | Static inspection: name/version/removed server deps/scripts confirmed by reading the file | PASS (inspection) |
| 2026-10-26 | WP0.2 | `.gitignore` (pre-existing, read); `patch_req.cjs`, `dist/` confirmed absent | Static inspection + `dir` checks | PASS (inspection) |
| 2026-10-26 | WP0.3 | none needed | `dir` of repo root + `docs/`: all §1.2 files present; left untouched | PASS (inspection) |
| 2026-10-26 | WP0.4 | — | NOT RUN — prior session recorded node/npm unavailable; no exact command result is present | NOT RUN |
| 2026-10-26 | WP0.5 | `package.json` devDeps (vitest ^4.1.11, @types/chrome ^0.2.5), `tests/manifest.smoke.test.js`, `CHANGELOG.md` | Static inspection of the three files | PASS (inspection) |

**Notes · decisions · blockers · history** (append-only; never delete entries)
- 2026-10-26 — A prior session had already landed most WP0 file work (package.json, .gitignore, LICENSE, CHANGELOG, smoke test, patch_req.cjs deleted, dist/ removed). Verified by inspection and ticked above; nothing was redone.
- 2026-10-26 — `clean` script is `rm -rf dist build` (POSIX, per plan). Works on Replit/bash; would need a shim under Windows cmd — left as-is per plan, recorded here.
- 2026-10-26 — `package-lock.json` / `bun.lock` consistency with `package.json` NOT verified (no local npm in that session). Re-check the current environment and verify in an authorized implementation session.

---

### WP1 — Foundation: shared core, build pipeline, storage layer, migration (plan §6 WP1; fixes B02 part, R04, R06)

Status: ◐ IN PROGRESS — prior tracker records code and tests written 2026-10-26; none executed in the recorded evidence · Progress: 0/5 tasks ticked (verify claimed code completion against current files), 10/10 §8.1 test files recorded (0 executed), 0/1 AC

**Tasks** — previously recorded as code-complete; verify against current files. Tick only after the implementing agent observes the required work and verification.
- [ ] WP1.1 Create `src/shared/*` as listed in plan §5.1; `tsconfig` `"strict": true` for new code (legacy files may be excluded until WP5) — code complete: all 14 modules exist, tsconfig strict with shared/background/content includes
- [ ] WP1.2 Convert `public/background.js` + `public/content.js` into `src/background/*` + `src/content/*` as **empty shells importing shared**; write `scripts/build-extension.mjs` (plan §5.1 pipeline); update `manifest.json` — code complete: bridge shells keep v1 behaviour until WP2/WP4; build script pre-existing (vite → esbuild, §5.1 pipeline); manifest got `+idle`, `+minimum_chrome_version: "110"` (background `type: "module"` was already set); popup/WAR/options_ui/content-matches deferred to WP3/WP4/WP5 — see notes
- [ ] WP1.3 `shared/storage.ts`: typed `getState()` (one `storage.local.get` of all known keys with defaults), `patch(partial)`, `update(key, fn)`, `onStateChanged(cb)` — code complete (single-writer queue, testable with a fake chrome area)
- [ ] WP1.4 `shared/migrate.ts` + `ready()` per plan §5.2 (runs in `onInstalled` **and** lazily in `ready()`; one shared promise; `backup_v1` first); write the fixture test first — code complete (ready() lives in storage.ts with a shared promise; fixture + expected snapshot exist)
- [x] WP1.5 Delete the old `public/background.js` / `public/content.js` **only** when WP3/WP4 replace them — verified 2026-10-26 by inspection: both files still present and bundled through the bridge shells

**Unit tests required (plan §8.1 — each required before its matching WP is done)**
**Status 2026-10-26:** the prior tracker records ten test files (`tests/shared/{time,domains,keywords,plan,allowance,dnr,migrate,password,gating,stats}.test.ts`; migrate/storage/session tests pre-existing). **None has an observed execution result here** — verify current files, then record each check as it is run.
- [ ] `time.ts` — normal/overnight windows, `24:00`, start=end, end-exclusive, previous-day rule, `nextScheduleBoundary` across week end, local-date key around midnight, DST with fixed dates
- [ ] `domains.ts` — valid/invalid inputs, alias groups, subdomain vs look-alike, exception table incl. `& ? #` boundaries
- [ ] `keywords.ts` — comma/newline split, hashtags, whole-word vs substring, per-host param extraction, `p` ignored on non-Yahoo
- [ ] `plan.ts` — precedence/reasons, break phase, standalone future start, schedule boundaries, allowance exemption vs cap, always-blocked beats allowance, exceptions override, allow-only
- [ ] `allowance.ts` — three modes, midnight rollover, interval window expiry, 90 s delta cap, visit-gap for `count`
- [ ] `dnr.ts` — one redirect rule + stable IDs, ASCII guard, `regexSubstitution`, exception regex escaping, allow-only rule, rule-count limits
- [ ] `migrate.ts` — v1 fixture → v2 snapshot (stuck session, overnight schedule, numeric allowance, legacy password, seconds→ms history)
- [ ] `password.ts` — PBKDF2 round trip, legacy verify + upgrade, generator length/alphabet/source
- [ ] `gating.ts` — `guard()` over every action × state in Appendix E.4 (password set and unset)
- [ ] `stats.ts` — streak, focus score, insights, weekly totals, h/min formatting

**Acceptance criteria**
- [ ] WP1.AC `npm run build` produces a `dist/` that loads in Chrome (unpacked) and Firefox (temporary add-on) with the existing UI still working; `npm test` green; migration test passes on the v1 fixture; `ready()` idempotent when called concurrently 10× — **NOT RUN 2026-10-26: the prior session recorded node/npm unavailable; no command or browser result is present. Re-check the current environment before verification.**

**Evidence**

| Date | Item | Changed files | Verification (exact command / repro) | Result |
|---|---|---|---|---|
| 2026-10-26 | WP1.1 | NEW: `src/shared/time.ts`, `domains.ts`, `keywords.ts`, `allowance.ts`, `dnr.ts`, `plan.ts`, `gating.ts`, `password.ts`, `stats.ts`, `presets.ts` (10 modules; types/defaults/storage/migrate/session pre-existing); `types.ts` +`UsageRecord.visitStartMs?`, +`Task.allowOnlyDomains?` | Static inspection against plan §5.1/§5.2/A.1–A.7/E.3–E.4; no suite execution result is recorded | WRITTEN, NOT RUN |
| 2026-10-26 | WP1.1 dedup | `migrate.ts`, `session.ts` now import `normalizeDomain`/`normalizeException` (domains.ts) and `localDateKey` (time.ts); private copies removed | Static inspection; behaviour pinned by existing migrate/session tests | WRITTEN, NOT RUN |
| 2026-10-26 | WP1.2 | `public/manifest.json` (+`idle` permission, +`minimum_chrome_version: "110"`); shells + `scripts/build-extension.mjs` pre-existing (inspected, match §5.1) | Static inspection; `npm run build` and browser load have no observed result | WRITTEN, NOT RUN |
| 2026-10-26 | WP1 tests | NEW: 9 test files in `tests/shared/` (time, domains, keywords, allowance, dnr, password, gating, stats); fixtures from prior session kept | `npm test` has no observed result | WRITTEN, NOT RUN |
| 2026-10-26 | WP1 bugfix | `gating.ts` — guard() checked the lock source before the weakening set, which would have locked strengthening actions (extend/add/import) under a lock; reordered so strengthening is always allowed (E.4) | Caught while writing the E.4 table-driven test; fixed 2026-10-26 | FIXED (pending run) |

**Notes · decisions · blockers · history** (append-only)
- 2026-10-26 — Prior session had already written `types/defaults/storage/migrate/session`, the bridge shells, `build-extension.mjs`, the v1→v2 fixtures and 3 test files. Inventory taken before writing anything; new code matches its conventions (`.ts` import extensions, fake `chrome` injection in tests, fixed `now` parameters).
- 2026-10-26 — See §7 Decisions D1–D6 (bridge shells, incremental §5.1 manifest scope, helper dedup, schema additions, G.1-vs-A.3 resolution, verification status) and §7 Deferred (migration notice, DST delta check, session clock-skew, block-page default copy).

---

### WP1b — De-risking spikes (plan §6 WP1b — must run BEFORE WP2 and WP3)

Status: ☐ NOT STARTED · Start note: _none yet_ · Progress: 0/4 spikes, 0/1 AC

**Spikes** (throw-away branch, bare-bones extension; record browser versions, pass/fail, chosen design; put the chosen option in the commit message; **if a spike fails, edit `plan.md` so the next agent does not rely on the failed assumption**)
- [ ] S1 — Redirect that keeps the original URL (DNR `requestDomains` + `regexSubstitution` → `blocked.html#<url>`; typed URL, link click, `window.open`, redirect chain, `&`/`?`/`#` URLs; with and without `web_accessible_resources`; Chrome, Edge, Firefox). Fallback designs: Plan B `storage.session` per tab; Plan C DNR block + `tabs.update`
- [ ] S2 — Attention sampling (`windows.getLastFocused`, active tab, `idle.queryState(60)`, `tab.audible` every 5 s while switching/minimising/locking/video/second monitor). Never credit unfocused/minimised; do credit audible
- [ ] S3 — Alarms and worker lifecycle (`alarms.getAll()` before/after worker stop and browser restart; confirm re-creating resets an alarm; minimum period; `ensureAlarms()` idempotent; alarm fires with popup closed)
- [ ] S4 — Firefox MV3 (`background.scripts` + `type:"module"`; DNR `regexSubstitution` to `moz-extension://`; host-permission opt-in; `idle`; notifications without buttons; `storage.session`)

**Acceptance criteria**
- [ ] WP1b.AC `docs/spikes.md` exists with a pass/fail line per spike, the redirect design chosen (A, B or C), and any plan assumption that changed

**Evidence**

| Date | Item | Changed files | Verification (exact command / repro) | Result |
|---|---|---|---|---|

**Notes · decisions · blockers · history** (append-only)
- —

---

### WP2 — Session engine owned by the background (plan §6 WP2; fixes B01, B05, B06, B07, B13 standalone alarm, H02, H13, H14)

Status: ☐ NOT STARTED · Start note: _none yet_ · Progress: 0/4 tasks, 0/10 AC

**Tasks**
- [ ] WP2.1 `shared/plan.ts` `isBlockingActive` + session helpers; `background/session.ts`; `background/alarms.ts` (`ensureAlarms`); `background/notify.ts` (badge + notifications); `background/messages.ts` handlers for `session/*` (plan §5.3)
- [ ] WP2.2 Replace the UI's timer logic: read `session`, render `max(0, endsAt − now)` with a 1 s `setInterval` that only sets local React state; send messages for start/stop/extend; **no `setIsActive`/`setTimeLeft`/… storage writes remain**; remove fullscreen logic (H02)
- [ ] WP2.3 Write `sessionHistory` and `dayStats` at phase end (`SessionRecord`, `DayStats`); cap history at 500; history never written at start
- [ ] WP2.4 Replace the keyboard command handler (idle → start default duration lock `none` + notification; running+`none` → stop; locked → "This session is locked", no action)

**Acceptance criteria**
- [ ] WP2.AC1 2-min session with popup closed: notification at 2:00, badge → break, sites unblock during break, idle after break; `sessionHistory` has one `completed` record with `elapsedMs ≈ 120 000`
- [ ] WP2.AC2 Service worker stopped mid-session from `chrome://extensions` → remaining time still correct on next wake; session ends on time
- [ ] WP2.AC3 Browser closed mid-session, reopened after end → session finalised (completed/interrupted per gap rule); nothing stuck; badge clear
- [ ] WP2.AC4 `commitment`: no stop button; `session/stop` → `LOCKED`; shortcut shows "locked" and does nothing; session ends by itself
- [ ] WP2.AC5 `strict`: wrong password rejected **by the background**; shortcut cannot stop it; with no password set, phrase `I GIVE UP` required
- [ ] WP2.AC6 Extend +15 works in all lock levels and moves ring, badge and alarm
- [ ] WP2.AC7 Popup open/close 20× mid-session (with and without linked task): the session never changes (B07)
- [ ] WP2.AC8 Two popups/tabs open: no double-decrement; storage writes during a session ≤ 1/min (measured in worker console)
- [ ] WP2.AC9 `autoStartNext` with 2 cycles alternates work/break correctly; long break at the Nth cycle
- [ ] WP2.AC10 Stats › Session History shows UI-started sessions (B05); claims C06–C11 pass in plan §8.4

**Evidence**

| Date | Item | Changed files | Verification (exact command / repro) | Result |
|---|---|---|---|---|

**Notes · decisions · blockers · history** (append-only)
- —

---

### WP3 — Blocking engine (plan §6 WP3; fixes B02–B04, B08–B12, B15, B18, B19, B23 engine part, B26, B27, B30; H05, H06, H10)

Status: ☐ NOT STARTED · Start note: _none yet_ · Progress: 0/12 tasks, 0/10 AC

**Tasks**
- [ ] WP3.1 One pure decision function `computeBlockPlan(state, now)` + `explainBlock(url, state, now)` (plan A.3 precedence; one function shared by worker, fallback listeners, block page, Check-a-URL)
- [ ] WP3.2 One installer `reconcile(reason)` in `background/reconcile.ts`: serialised, `try/catch`, writes `health.lastReconcileAt/Error/ruleCount`, **one** `updateDynamicRules` call, arms single `boundary` alarm at `nextBoundaryAt`, audits open tabs only for newly blocked domains (+ 1-min `tick` safety re-check while blocking is active)
- [ ] WP3.3 DNR design: single redirect rule `requestDomains` + `regexFilter '^(https?://.+)$'` + `regexSubstitution` to `blocked.html#…`; exceptions = `allow` rules priority 2 (plan A.6)
- [ ] WP3.4 Inputs normalised and validated at entry (`normalizeDomain` via `new URL('http://' + input).hostname`, punycode, reject spaces/commas/unparseable); UI inline error; engine skips invalid stored entries and records them in `health` (B26)
- [ ] WP3.5 Aliases (B30): `ALIASES` groups (`x.com`/`twitter.com`/`t.co`, `youtube.com`/`youtu.be`/…); adding one blocks the group; UI shows group chips
- [ ] WP3.6 Schedules (B04, B15): new shape with name/own lists/`useGlobalLists`; `isScheduleActiveAt` per plan A.1 (overnight, `24:00`, end-exclusive, previous-day rule); `nextBoundaryAt` includes schedules, standalone, allowance windows, next local midnight
- [ ] WP3.7 Allowances (B08, B09, B27, H05): three modes (`time_budget`, `count`, `interval`) + ledger (plan A.2) fed by attention tracking (`idle` permission; focused window + active tab + not idle, or audible); every entry a cap; `duringBlocks` switch = metered exemption; `alwaysBlockedSites` always win
- [ ] WP3.8 Exceptions (B10): `normalizeException`/`matchException` per plan A.4 (boundary-checked prefix); DNR allow rule from the same entry; exceptions override everything
- [ ] WP3.9 Keywords (B19): `settings.keywords.scope`/`match`; host param table (`yahoo p`, `yandex text`, `baidu wd`, `youtube search_query`, `amazon k`) + generic `q`/`query` only — **never generic `p`**; `keywordMatches` ring (last 50); schedule keywords count as `both`
- [ ] WP3.10 Fallback listeners `webNavigation.onCommitted`/`onHistoryStateUpdated` filtered to http(s) calling `explainBlock` → `recordBlock` + `tabs.update` to block page; **delete** the `tabs.onUpdated` fallback and the audit-inside-every-update loop
- [ ] WP3.11 `recordBlock` (B12): 3 s dedupe per `(tabId, domain)`; appends `recentBlocks` (cap 200); increments `dayStats[today].blocks` + `blocksByDomain` + `session.blockedAttempts`
- [ ] WP3.12 Alarms `tick`, `boundary`, `session_phase_end`, `weekly_report`, `midnight` — all via `ensureAlarms()`

**Acceptance criteria**
- [ ] WP3.AC1 Block `example.com` + session: typed URL, link click, new tab, SPA route change all end on `blocked.html` with original URL and real reason; **no flash**; survives worker stop/restart
- [ ] WP3.AC2 `notexample.com`, `example.com.au`, `example.community` NOT blocked; `www.example.com` and `a.b.example.com` are
- [ ] WP3.AC3 Exception `youtube.com/watch?v=abc` allows `…/watch?v=abc&t=5` but not `…?v=abcd` or `youtube.com/`; `youtube.com.evil.test` unaffected
- [ ] WP3.AC4 Schedule 09:00–17:00 Mon–Fri: 08:59 free, 09:00 blocked with **no user action**, 17:00 free again; overnight previous-day rule correct; `24:00` works; own-list vs `useGlobalLists` correct; global-list edits apply immediately
- [ ] WP3.AC5 Allowances: `time_budget 2 min` blocks after ≈2 min of focused/active viewing until local midnight; background tab/unfocused/idle does NOT count; `count 2` blocks the 3rd visit; `interval 1/5` blocks after 1 min, free 5 min after window start; remaining budget visible; `duringBlocks` on → no flash (B27), off → stays blocked
- [ ] WP3.AC6 Keywords: `q`, `query`, `search_query`, `text`, `wd` matched; comma input splits (B25); whole-word lets "essex" through for "sex"; YouTube in-page search blocked
- [ ] WP3.AC7 Garbage/IDN entry injected into storage: remaining rules still install; Protection status shows the error (B26)
- [ ] WP3.AC8 10 sites added in quick succession: one consistent rule set, no duplicate-ID errors (B18)
- [ ] WP3.AC9 One block = one `recentBlocks` entry and one `dayStats` increment regardless of firing paths (B12)
- [ ] WP3.AC10 After a schedule/standalone ends, `getDynamicRules()` no longer contains its domains **without any storage change** (B04); rules survive a browser restart

**Evidence**

| Date | Item | Changed files | Verification (exact command / repro) | Result |
|---|---|---|---|---|

**Notes · decisions · blockers · history** (append-only)
- —

---

### WP4 — Content script (plan §6 WP4; fixes B14, B23; H04)

Status: ☐ NOT STARTED · Start note: _none yet_ · Progress: 0/8 tasks, 0/7 AC

**Tasks**
- [ ] WP4.1 `src/content/sites.ts` data table (plan Appendix B); `src/content/index.ts` loads `session`, `standalone`, `schedules`, `settings.contentFilters`, hide-keywords; computes filtering with the **same** `isFilteringActive` as the worker; subscribes to `storage.onChanged`; re-evaluates at schedule boundaries and `visibilitychange`
- [ ] WP4.2 CSS-first: one `<style id="focusgate-filters">` for all enabled filters; keyword hiding via `data-fg-hidden="1"` + `[data-fg-hidden]{display:none!important}`; restore = remove attribute
- [ ] WP4.3 `MutationObserver` on `document.documentElement` (never `document.body`), 200 ms debounce, attached only when filtering active **and** keywords exist; no early assignment before a successful `observe`
- [ ] WP4.4 Host matching = exact host or `.suffix` (never `includes`)
- [ ] WP4.5 `manifest.content_scripts[0].matches` generated from the table (no more `<all_urls>`); unit test keeps manifest and table equal
- [ ] WP4.6 YouTube SPA: re-run on `yt-navigate-finish`
- [ ] WP4.7 Replace hard-coded Shorts/Reels/TikTok hiding with `settings.contentFilters` toggles; **defaults for existing users ON** for the three previously unconditional filters
- [ ] WP4.8 Delete old `public/content.js` and old `public/background.js` (WP3 + WP4 complete)

**Acceptance criteria**
- [ ] WP4.AC1 Each toggle works and is reversible without a reload
- [ ] WP4.AC2 No console errors on a cold `document_start` load (repeat 20×)
- [ ] WP4.AC3 Filters off during breaks and outside blocking contexts; on during schedules (B23)
- [ ] WP4.AC4 Removing a keyword un-hides items
- [ ] WP4.AC5 No content script injected on unsupported sites
- [ ] WP4.AC6 A processing pass costs < 5 ms per mutation batch on a YouTube home feed (Performance panel)
- [ ] WP4.AC7 Claim C23 passes (plan §8.4)

**Evidence**

| Date | Item | Changed files | Verification (exact command / repro) | Result |
|---|---|---|---|---|

**Notes · decisions · blockers · history** (append-only)
- —

---

### WP5 — UI foundation and screen fixes (plan §6 WP5; fixes B16, B17, B22, B25, B28, B29, U01–U14, H09/H10/H16 UI part; most ❌ UI rows in §4.7)

Status: ☐ NOT STARTED · Start note: _none yet_ · Progress: 0/13 tasks, 0/5 AC

**Tasks**
- [ ] WP5.1 Split pages: `popup.html` (fixed **380 × 580** via CSS on `html, body`), `blocked.html` (full viewport), `onboarding.html` (full tab, max 480 px column), `dashboard.html` (full tab); delete `?blocked`/`?onboarding` role flags and `sm:w-[400px]`; block page + onboarding render final screen on first paint
- [ ] WP5.2 `useStorage` hook + `<StorageGate>`: one module-level store per page via `useSyncExternalStore`; `{ value, ready, set }` with latest-value updaters; skeleton until every key `ready` (no default-value flicker, no half-hydrated effects); `localStorage` fallback only when `chrome.storage` undefined (Vite dev); nothing re-renders every second except the timer text
- [ ] WP5.3 Design tokens + components (plan Appendix C): Button, IconButton (always visible, `aria-label`), Card, Toggle, Field, Modal (focus trap/Esc/restore), Toast, ConfirmDialog, Tabs/Segmented, Chip, EmptyState, ProgressRing, PasswordField; theme system/dark/light (U11); `prefers-reduced-motion` (U14); min 12 px text, contrast ≥ 4.5:1 (U04); remove `pb-safe`, `relative` nav buttons (U05)
- [ ] WP5.4 Replace every `alert()` with Toast/ConfirmDialog (U06); disabled actions show **why** (U12)
- [ ] WP5.5 Information architecture (U07, U08): header status chip + protection dot; popup tabs **Focus / Tasks / Rules / Stats / Settings**; Focus has mode switch **Focus timer | Block now** (standalone leaves Settings); Rules segments **Sites · Exceptions · Keywords · Schedules · Limits**; Settings sections Security / Timer & breaks / Notifications / Block page / Content filters / Protection / Data / About
- [ ] WP5.6 Focus view: preset chips (15/25/45/60/90) + string-state field committing on blur/Enter (B22); 3-way lock segmented control with one-line description **and** the Appendix E.5 "what this prevents" summary; big ring + `max(0, endsAt − now)`; Start/Extend/Stop/Skip per lock rules; inline hint "Add sites in Rules first" when nothing is blocked
- [ ] WP5.7 Tasks view: B16 (lock only while that task's session runs); restart completed tasks; show date/time; remove the scratch comment in `toggleTask`
- [ ] WP5.8 Rules view: per-site *when* chips (Focus · Always · Schedule) + live "blocked now" dot; **Check a URL** field on top; inline domain validation accepting pasted URLs (B26); keyword input splits on commas/newlines, trims, lower-cases, dedupes (B25) with Block/Hide/Both + Always switch (Appendix G); always-visible delete buttons (U09); schedules get name, edit, own lists / "also block global lists", "End of day (24:00)"; Limits segment = Appendix F screen (usage bars, three modes, presets + custom, `duringBlocks` switch, in-place editing)
- [ ] WP5.9 Block page: reads URL from `location.hash`; reason from `explainBlock`; countdown **only** for session/standalone reasons (B28); today's block count from `dayStats` (C38); quote/message; **Close tab** via `chrome.tabs.getCurrent` → `remove` (B17) + **Open new tab**; no promotional footer; untrusted fragment rendered as text only (invariant 13); "Block ended" + "Open {host}" flow for http(s) URLs no longer blocked; renders without the popup bundle
- [ ] WP5.10 Onboarding (B29): Welcome + goal → presets/sites → password (optional, honest trade-offs) → **Protection check** → **Open FocusGate** (closes tab / popup guidance; never lands on Settings)
- [ ] WP5.11 Copy pass: apply the replacement-copy table (plan §6 WP5) and re-read every string for banned words (*completely, instantly, cannot, always, guaranteed*)
- [ ] WP5.12 A11y pass (U13): labels everywhere, `:focus-visible` ring, modal focus traps, no colour-only status, tab order = visual order, keyboard-only walkthrough
- [ ] WP5.13 Delete `src/App.tsx` and `src/hooks/useChromeStorage.ts` when every view has moved; `npm run typecheck` clean with `strict`

**Acceptance criteria**
- [ ] WP5.AC1 Popup exactly 380 × 580 on every tab, no size jump; block page + onboarding show final UI on first paint (screen capture at 4× CPU throttle)
- [ ] WP5.AC2 `grep -R "alert(" src` returns nothing; no `window.close()` for tab closing
- [ ] WP5.AC3 Light and dark themes pass contrast check; keyboard-only operable end to end; modals trap and restore focus; Lighthouse accessibility ≥ 95 per built page
- [ ] WP5.AC4 Typing "25" works naturally; `funny shorts, #gaming` creates two keywords; pasting `https://www.Reddit.com/r/all` stores `reddit.com`
- [ ] WP5.AC5 All ❌/⚠️ UI rows assigned to WP5 in plan §4.7 pass in §8.4 (C05, C12, C14, C15, C22, C34, C36–C40, …)

**Evidence**

| Date | Item | Changed files | Verification (exact command / repro) | Result |
|---|---|---|---|---|

**Notes · decisions · blockers · history** (append-only)
- —

---

### WP6 — Security, standalone, protection status, backup (plan §6 WP6; fixes B20, B21, B24; H07, H11, H12)

Status: ☐ NOT STARTED · Start note: _none yet_ · Progress: 0/8 tasks, 0/9 AC

**Tasks**
- [ ] WP6.1 `shared/password.ts`: PBKDF2-SHA256, 600 000 iterations, 16-byte salt (Web Crypto); verify accepts legacy `sha256-legacy` and **upgrades on first successful verify**; generator via `crypto.getRandomValues`, ambiguity-free alphabet, 20–28 chars
- [ ] WP6.2 Policy: custom password **8–64 chars** with strength hint + "Generate (recommended)" (plan §10 Q5)
- [ ] WP6.3 `PasswordField`: show/hide toggle, **visible by default**; setup allows copy/paste; unlock blocks paste (typing friction), autofill allowed; disable until ≥ 8 chars, let verification decide
- [ ] WP6.4 One guard function `guard(action, state)` in `shared/gating.ts` returning `allow`/`confirm`/`password`/`phrase`/`locked` exactly per Appendix E; UI uses it to disable+explain, `messages.ts` enforces; table-driven test over every action × state (closes B24, F06, F13)
- [ ] WP6.5 Standalone Block v2 (B21, H07, F01–F07): implement **Appendix D in full** (own list, absolute expiry 5 min–30 days, append-only while active, extend/add only, live countdown, confirmation dialog, no "No limit"); delete the Settings › Standalone card, `standaloneUnlimited`, `startStandalone`, every "No limit" path; `standalone` is one storage key, atomically written; **no stop path exists anywhere**
- [ ] WP6.6 Protection status card (Settings › Protection + header dot): incognito access, host permission (with `permissions.request` on user gesture — mainly Firefox), notifications, heartbeat age, last reconcile + error, DNR rule count, protection gaps last 7 days, "Open extension settings" link (feature-detected); copy states the §3 limits
- [ ] WP6.7 Backup / Restore that **can never weaken**: export JSON (never password record or runtime keys); import validates, rejects unknown/future `schemaVersion`, 2 MB cap, preview counts; working state → **merge-only** (union of sites/keywords/schedules/tasks, stricter allowances, never exceptions/password/stats/settings; report of skipped items; allowed during a lock); empty state → free restore (still never the password); **no "Replace" button** — reset via password + typed confirmation, refused during a lock
- [ ] WP6.8 Theme (dark/light/system) + font scale (0.9–1.2) in Settings

**Acceptance criteria**
- [ ] WP6.AC1 Wrong password rejected by the **background** (not just the UI)
- [ ] WP6.AC2 Removing an allowance/exception/site asks for the password when one is set (C29–C31)
- [ ] WP6.AC3 Legacy hashes still unlock and are silently upgraded (fixture test)
- [ ] WP6.AC4 A running standalone block cannot be ended early by any UI, shortcut or message; can be extended and added to (also with popup closed); every refused weakening action explains itself (Appendix D.7, E.7)
- [ ] WP6.AC5 Export → reset → import restores everything on an empty state
- [ ] WP6.AC6 Importing into a working state only adds; the merge report lists what was skipped and why; works during a lock
- [ ] WP6.AC7 Reset is refused during a lock
- [ ] WP6.AC8 Protection card shows red when incognito access is off and when host permission is missing (tested in Firefox)
- [ ] WP6.AC9 `guard()` matrix (Appendix E.4) fully covered by a table-driven unit test

**Evidence**

| Date | Item | Changed files | Verification (exact command / repro) | Result |
|---|---|---|---|---|

**Notes · decisions · blockers · history** (append-only)
- —

---

### WP7 — Feature ports from the Android and PC apps (plan §6 WP7) — **only after M1 is green**

Status: ☐ NOT STARTED · Start note: _none yet_ · Progress: 0/12 Tier A, 0/7 Tier B, 0/1 AC
Tier C is backlog — **implement only if the owner asks** (plan §6 WP7). Do **not** port the "Do not port" list (VPN/network/hosts/firewall/process-killing/AccessibilityService/launcher/uninstall protection/telemetry/Discord webhook).

**Tier A (ship in this release)**
- [ ] A1 — Quick block ("Block this site"): header button + `block-current-site` (Alt+Shift+B) + optional context menu; adds normalised domain + alias group to *Sites* or *Always* (choice remembered); toast; disabled with reason on non-http(s) tabs
- [ ] A2 — Always-blocked list: second list enforced 24/7; Rules › Sites two segments (*During focus* / *Always*); removal password-gated; precedence per A.3
- [ ] A3 — Presets + onboarding goal: preset picker (Social/Video/News/Shopping/Gaming/Messaging/Deep focus with the plan's starting domain lists), custom presets (CRUD), onboarding question pre-selects; **never apply silently**
- [ ] A4 — Break / Pomodoro settings UI: short/long break, cycles before long, auto-start next (defaults 5/15/4/off), default session length
- [ ] A5 — Extend session: +10/15/20/30/45/60 chips, all lock levels, "Extended by 15 min" in history
- [ ] A6 — Tasks upgrade + reminders: full fields (description/date/time/priority/tags/recurrence/lock), edit in place, restart completed; idempotent `generateRecurringForToday()` (templateId+date) at start-up + `midnight`; reminder chain (pre-start 10/5/1, at-start, mid 15/30 if ≥ 10 min remain, almost done) via `chrome.alarms` (next ≤ 50) with `reconcileTaskAlarms()`; "Start now" notification action where supported; optional `autoStartTasks` (default off)
- [ ] A7 — Block-page message and quotes: custom message, quote list rotating daily, toggle, optional WebAudio tone on the block page only (off by default)
- [ ] A8 — Content-filter toggles: one switch per filter in Appendix B (Settings › Content filters)
- [ ] A9 — Notification settings: switches for session end, break end, task reminders, weekly report, achievements; editable offsets; lazy permission request
- [ ] A10 — Alias chips: when adding `x.com` show "Also blocks twitter.com, t.co"; individual aliases removable (per-entry exclusions survive edits)
- [ ] A11 — Check a URL: paste URL → Blocked/Allowed + reason from `explainBlock` + when it next changes; "Why?" link on every blocked-site row; same function as engine and block page
- [ ] A12 — Up next / Today (tasks as time windows): task = date + start + duration; Focus tab top card (running/next task, or "Nothing scheduled"); Tasks tab opens on *Today* grouped Overdue/Now/Up next/Later/No time with day navigation; start-from-task uses remaining window or duration; end-of-task notification (default on); "will be blocked" line under the timer ("6 sites · 3 keywords · 1 schedule")

**Tier B (after Tier A is green)**
- [ ] B1 — Session debrief (card + notification text after a work phase)
- [ ] B2 — Achievements subset (IRON_SESSION, QUIET_WIN, RESISTANCE_10, THREE_WEEKS, PRESENCE_7, BACK_AGAIN; evaluated by background)
- [ ] B3 — Keyword match log (last 50: keyword, domain, where, time; Clear)
- [ ] B4 — Allow-only mode (block everything except allowlist during work; three-way per task, never coerced; needs ≥ 1 allowed domain; extension pages and non-http(s) never affected; `excludedRequestDomains` rule — never emitted with an empty list)
- [ ] B5 — Daily reflection (mood 1–5 + note per day; optional end-of-day notification, off by default)
- [ ] B6 — Habits (list + emoji, daily check-in, per-habit streak, dashboard card)
- [ ] B7 — Allowance heads-up (notification at 5 min / 10 % remaining and at exhaustion; optional badge with remaining minutes while active tab is an allowance site; session badge wins)

**Acceptance criteria (Tier A)**
- [ ] WP7.AC Each Tier A item works end-to-end in Chrome and Edge, and in Firefox where the API exists (notification buttons are the known exception); reminders fire at the right minute after a browser restart; a 14:00 task shows 13:50/13:55/13:59 pre-start + at-start notifications; recurring tasks generate exactly one instance per day; presets never apply without confirmation; C01 and C13/C14 pass in §8.4

**Evidence**

| Date | Item | Changed files | Verification (exact command / repro) | Result |
|---|---|---|---|---|

**Notes · decisions · blockers · history** (append-only)
- —

---

### WP8 — Stats, insights, reports (plan §6 WP8; fixes H03, H08; C26–C28)

Status: ☐ NOT STARTED · Start note: _none yet_ · Progress: 0/4 tasks, 0/4 AC

**Tasks**
- [ ] WP8.1 Dashboard › Stats: range switch (Today/Week/Month); KPI cards from **actual** `elapsedMs`; per-day focus-minutes bar chart as inline SVG (no chart library); daily-goal ring (default 120) + focus score formula; streak + best streak; insights (best hour/weekday, average session, completion rate, totals, top blocked domains, allowance usage, protection gaps, achievements)
- [ ] WP8.2 Popup › Stats (mini): today's focus, streak, goal ring, last 5 sessions
- [ ] WP8.3 Weekly report: `weekly_report` alarm created **once** by `ensureAlarms()` for next local Monday 09:00; last-7-days totals from `dayStats`; notification text in hours **and** minutes (never floored); saved in `lastWeeklyReport` + last 8 in `weeklyReports`; viewable in Dashboard › Reports
- [ ] WP8.4 Data hygiene: caps — `sessionHistory` 500, `dayStats` 400 days, `recentBlocks` 200 — pruned in the `midnight` alarm

**Acceptance criteria**
- [ ] WP8.AC1 Stats show UI-started sessions immediately
- [ ] WP8.AC2 Numbers match a hand calculation for a seeded fixture (fixture generator + aggregate tests)
- [ ] WP8.AC3 Weekly alarm survives ≥ 20 worker restarts (`alarms.get('weekly_report').scheduledTime` unchanged)
- [ ] WP8.AC4 Streak and score match the formulas; no chart dependency added

**Evidence**

| Date | Item | Changed files | Verification (exact command / repro) | Result |
|---|---|---|---|---|

**Notes · decisions · blockers · history** (append-only)
- —

---

### WP9 — QA hardening (plan §6 WP9)

Status: ☐ NOT STARTED · Start note: _none yet_ · Progress: 0/5 items, 0/1 AC

**Items**
- [ ] WP9.1 Full manual matrix (plan §8.2) on Chrome, Edge, Firefox (temporary add-on) — failures noted per browser
- [ ] WP9.2 MV3 lifecycle tests (plan §8.3): worker stop, mid-session stop, browser restart, suspend/resume across session end and schedule boundary, clock back 10 min, 20 worker restarts with alarm times stable, 10 000-event burst (no duplicate-ID errors; `recentBlocks` ≤ 200)
- [ ] WP9.3 Performance: worker CPU idle ≈ 0; content script < 5 ms/batch; popup opens < 150 ms; storage < 1 MB after 90 days of seeded data
- [ ] WP9.4 Edge-case catalogue (plan §8.5, EC01–EC54): every row covered by a test or a manual check
- [ ] WP9.5 Fix everything found — **no new features**

**Acceptance criteria**
- [ ] WP9.AC §8.2 and §8.3 pass; §8.4 claims regression fully green

**Evidence**

| Date | Item | Changed files | Verification (exact command / repro) | Result |
|---|---|---|---|---|

**Notes · decisions · blockers · history** (append-only)
- —

---

### WP10 — Release (plan §6 WP10)

Status: ☐ NOT STARTED · Start note: _none yet_ · Progress: 0/5 tasks, 0/4 AC

**Tasks**
- [ ] WP10.1 Bump version to `1.1.0` (manifest + `package.json`); update `CHANGELOG.md` (migration note + behaviour changes: Always-blocked list, allowance semantics, exceptions matching, keyword splitting, no more fullscreen lock)
- [ ] WP10.2 Make `STORE_LISTING.md` truthful (claims policy §4.7) with a permission justification table; publish `docs/privacy-policy.html` (no network calls, data stays local)
- [ ] WP10.3 Re-capture store screenshots (popup, onboarding, block page) from the new UI
- [ ] WP10.4 Run `npm run package:all`; load all three packages and run the smoke test (start session → hit blocked site → see block page → end session)
- [ ] WP10.5 Upgrade test with a real v1 profile: install old build, create sites/schedules/allowances/tasks/password/history, upgrade in place, verify migration (§5.2) — nothing lost

**Acceptance criteria**
- [ ] WP10.AC1 The three ZIPs install
- [ ] WP10.AC2 The upgrade test passes
- [ ] WP10.AC3 Every row of plan §4.7 is ✅ or its copy has been changed (see §6 below)
- [ ] WP10.AC4 No `alert(`, no `<all_urls>` content script, no network calls (grep bundles for `fetch(`, `XMLHttpRequest`, `WebSocket`)

**Evidence**

| Date | Item | Changed files | Verification (exact command / repro) | Result |
|---|---|---|---|---|

**Notes · decisions · blockers · history** (append-only)
- —

---

## 6. Claims regression C01–C40 (plan §8.4 — final gate; a row passes only if the final on-screen copy is true)

- [ ] C01 — Presets exist; store/manifest description matches what the UI offers
- [ ] C02 — Bundles contain no `fetch(`/`XMLHttpRequest`/`WebSocket`; content script injects only on supported hosts; privacy policy exists and matches
- [ ] C03 — Popup-started session adds a history entry and updates today's focus time
- [ ] C04 — Every file README/scripts mention exists, or the text is removed
- [ ] C05 — Popup is 380 × 580 on every tab
- [ ] C06 — Session still ends on time with the popup closed
- [ ] C07 — Strict copy matches behaviour: no fullscreen claim; wrong password rejected; shortcut cannot stop it
- [ ] C08 — Commit: no UI/shortcut/message can stop it; ends by itself
- [ ] C09 — Break advances without the popup; content filters off during break
- [ ] C10 — Task-linked session completes the task with the popup closed; popup open/close never ends it
- [ ] C11 — Shortcut starts with default duration + notification; refuses to stop a locked session
- [ ] C12 — Typing a duration works naturally
- [ ] C13 — Task with a time triggers reminders + at-start notification
- [ ] C14 — Tasks empty-state copy accurate; dated/recurring tasks behave as described
- [ ] C15 — Commitment task deletable when its session is not running
- [ ] C16 — Sites copy matches behaviour (pages blocked; no flash; block page shown)
- [ ] C17 — `x.com` and `twitter.com` blocked together; placeholder current
- [ ] C18 — Always-blocked list works with no session; HowTo wording matches
- [ ] C19 — Exception `youtube.com/watch?v=abc` allows exactly that video
- [ ] C20 — Adding an exception during a standalone block explains the refusal
- [ ] C21 — Keyword behaviour matches the on-screen description
- [ ] C22 — `funny shorts, #gaming` creates two keywords
- [ ] C23 — Hiding works on supported sites, reverses without reload, off in breaks, on in schedules
- [ ] C24 — Schedules start and end with no user action
- [ ] C25 — A schedule blocks exactly the lists it says
- [ ] C26 — Stats show today's focus time, completed/abandoned correctly
- [ ] C27 — One blocked navigation = one counted block
- [ ] C28 — Session history lists UI-started sessions
- [ ] C29 — Password copy lists exactly the gated actions, and each one prompts
- [ ] C30 — HowTo password text matches (lock `none` described as unprotected)
- [ ] C31 — Generated passwords from `crypto.getRandomValues`; legacy hash upgrades
- [ ] C32 — Standalone copy matches: own list, absolute expiry, extend/add only, no early stop, no "no limit"
- [ ] C33 — Allowance copy matches the three modes; usage visible; removal prompts
- [ ] C34 — Onboarding's last button does what it says
- [ ] C35 — Onboarding offers presets and a protection check
- [ ] C36 — Block-page headline matches the real reason
- [ ] C37 — Countdown shown only for session/standalone and equals `endsAt − now` / `until − now`
- [ ] C38 — "Blocks today" equals the real count
- [ ] C39 — Close tab closes the tab
- [ ] C40 — Promo link is in About, not on the block page

---

## 7. Project-level logs (append-only — never erase entries)

### Decisions
| Date | WP | Decision | Rationale / source |
|---|---|---|---|
| 2026-10-26 | WP0/WP1 | WP1 "shells" are bridges: `src/background/index.ts` and `src/content/index.ts` import the old `public/background.js`/`content.js` (plus the shared storage layer), so v1 behaviour keeps working until WP2/WP4 replace it | Plan WP1.5 "keep the old ones working until then so M1 is incremental"; pattern found pre-existing from a prior session, kept |
| 2026-10-26 | WP1 | §5.1 manifest changes applied incrementally: WP1 adds only `idle` + `minimum_chrome_version: "110"` (background `type: "module"` pre-existing); `default_popup: popup.html`, `web_accessible_resources`, `options_ui` and the narrowed content-script `matches` move to WP3/WP4/WP5 when `blocked.html`/`dashboard.html`/`sites.ts` exist | Referencing pages/tables that don't exist yet would break the manifest smoke test and ship dead keys |
| 2026-10-26 | WP1 | Deduplicated shared helpers: `normalizeDomain`/`normalizeException`/`matchException`/`escapeRegex` live in `domains.ts`, `localDateKey`/`startOfNextLocalDay` in `time.ts`; `migrate.ts` and `session.ts` import them instead of private copies | Plan §5.1 file ownership + R04 (duplicated logic); migration fixture test pins the behaviour |
| 2026-10-26 | WP1 | Additive schema changes to §5.2: `UsageRecord.visitStartMs?` (enforces F.3's 30-minute visit cap / VISIT_MAX_MS) and `Task.allowOnlyDomains?` (B4's three-way allow-only) — both optional | Required by plan Appendices A.2/F.3 and WP7-B4; optional so v1 migration and existing fixtures are unaffected |
| 2026-10-26 | WP1 | G.1 vs A.3 step 5 conflict (do global "During blocks" keywords apply while a *schedule* window is active?) resolved per G.1: yes — blocks context = session work OR active standalone block OR any active schedule | G.1 is the feature spec ("During blocks (default; only while a focus session, standalone block or schedule applies)"); A.3 step 5 lists the same contexts minus schedules |
| 2026-10-26 | WP0/WP1 | Verification was planned for the owner's testing agent because node/npm was unavailable in that session; no test result is recorded. Superseded by the 2026-10-27 no-delegation rule below. | Owner directive of 2026-10-25/26; tracker rules §1.4/§3 |
| 2026-10-27 | — | Verification must be performed by the implementing agent; no sub-agents or delegated testing. The 2026-10-26 delegation notes above are historical plans only. No check is complete without an exact command/repro and an observed result recorded in this tracker. | Owner's current operating rules; plan §Operating rules |

### Blockers and failures
| Date | WP | What happened | Exact command / repro | Outcome (append when resolved) |
|---|---|---|---|---|

### Deferred work
| Date | WP | Item | Why deferred | Owner decision needed |
|---|---|---|---|---|
| 2026-10-26 | WP1 | v1 "No limit" standalone migration does not yet emit the one-time user notice (plan §5.2/Q14/D.5: "Your 'No limit' block is now an Always-blocked list…") — migrate.ts already produces the correct `alwaysBlockedSites` | Needs a pending-notices surface in the schema; the background owns notifications (WP2) | No — plan Q14 default applies; flagged so WP2/WP6 pick it up |
| 2026-10-26 | WP1 | DST wall-clock *delta* checks (§8.1: 23 h / 25 h day lengths) are covered in tests only as TZ-independent calendar assertions; asserting the exact delta requires a machine whose zone observes that transition | Replit's TZ is unknown; §8.3 lifecycle tests cover clock behaviour on device | No |
| 2026-10-26 | WP1 | `shared/session.ts` (pre-existing) lacks the clock-skew rule of EC05 (system clock moved back ⇒ extend `phaseEndsAt`); recovery/gap logic otherwise present | The session engine and its alarms belong to WP2; recorded so WP2 implements it | No |
| 2026-10-26 | WP1 | `defaults.ts` still carries the v1 block-page copy "You are supposed to be focusing right now." as the default message | Replacement copy is specified for WP5 (copy pass) / WP7-A7 default | No |
| 2026-10-26 | — | Root `plan/` folder (agent-pre-prompt.md, tracker.md, …) is a leftover from an earlier session; the live documents are `fixes/plan.md`, `fixes/TRACKER.md`, `fixes/AGENT_PROMPT.md` | Not touched — deletion is destructive and out of this batch's scope | Yes — owner may delete it |

### Open questions answered (plan §10)
| Date | Q# | Owner answer (default used if blank) |
|---|---|---|

---

*End of tracker. Update §4 and the relevant WP section as you work — not at the end.*
