# FocusGate overhaul — plan

Read `README.md`, then `AGENT_PROMPT.md` (your rules). This file is the work. `TRACKER.md` is where you record it. `AUDIT.md` says *why* each task exists. `DESIGN.md` has the look and **every pinned UI string**.

Every task has: **Files** (touch nothing else) · **Do** · **Test** (write it first, see it fail) · **Done when** · **Stop if** (report; don't improvise).
Gates for every task: `npm test`, `npm run typecheck`, `npm run build` all green. One commit per task: `T<id>: <what>`.

## Global constraints (every task)

- No new dependencies. No network calls (`tests/claims.test.ts` scans all of `src/` for `fetch(`). No `any`, `as any`, `@ts-ignore`.
- Copy is sentence case and avoids *completely, instantly, cannot, always, guaranteed* in `src/ui` (the list name `Always` is the one exception). Use the pinned strings in `DESIGN.md` section 9 word for word.
- Existing tests pin things (the list is in `AGENT_PROMPT.md`). The two lock sentences in `FocusScreen.tsx`, the block page's `case` branches and the default block-page message stay exactly as they are.
- Hex colours only inside the four theme token blocks of `src/ui/styles.css`. `font-size` only in px or rem and never under 12. Keep every `.fg-*` foundation class and `.fg-panel { min-width: 300px }`.
- Line numbers below are from v1.1.0. Search by symbol and confirm before editing.
- A browser-only check you cannot run is marked `UNVERIFIED` in `TRACKER.md`. It is not ticked.

| Phase | Ships as | Goal |
|---|---|---|
| 0 | **v1.0.1 — publish at once** | Stop the bleeding + a net so it can't recur |
| 1 | v1.0.1 (no bump) | The blocker tells the truth (UI edits apply now; expired sessions don't linger) |
| 2 | v1.0.1 (no bump) | Schedules that explain themselves |
| 3 | v1.0.1 (no bump) | The extension talks: status line, lock explainer, first run |
| 4 | v1.0.1 (no bump) | A profile that is a profile; the user's own reason on the block page |
| 5 | v1.0.1 (no bump) | Identity: tokens, type, layout, icons, one signature moment |
| 6 | v1.0.1 (no bump) | Accessibility + interaction polish |
| 7 | release | Version, changelog, store screenshots |

## Decisions — defaults apply until the owner edits this table

| ID | Question | Default |
|---|---|---|
| D1 | Brand direction | **A:** keep the logo (blue→violet ring), align the UI to it (periwinkle accent + amber "gate closed" signal). B: keep mint, redo logo. C: owner sends a FocusFlow palette → align tokens to it. |
| D2 | Font | Barlow family, **bundled as woff2 in `public/fonts/` only if the owner supplies the files** (OFL; ship the license text). Until then the token stack `"Barlow", system-ui, …` is declared and nothing is downloaded. |
| D3 | Profile scope | Keep Tasks / Reflection / Habits components unchanged, move them under a collapsed "Journal and tasks" section; Profile + Protection on top. |
| D4 | Pause / snooze | **Not now** (backlog). It conflicts with Strict/Commit; needs the owner's rules. |
| D5 | E2E tooling | `tools/e2e/smoke.cjs` runs Playwright installed **outside** the repo. No `package.json` dependency change. Not wired into CI unless the owner says so. The owner runs it (Windows or Linux, see `tools/e2e/README.md`) unless the agent's environment has a browser. |
| D6 | Shortcuts | Keep `Alt+Shift+F` / `Alt+Shift+B`; add a settings row showing live bindings + a button to Chrome's shortcut page (T6.2). Don't pick new keys. |
| D7 | `package-lock.json` host rewrite | Don't touch. Report only (AUDIT §9). |
| D9 | Version | **Fixed at 1.0.1 for the whole overhaul.** No phase bumps `version` in `public/manifest.json` or `package.json`. Each phase appends its user-visible changes under the `## [1.0.1]` heading of `CHANGELOG.md`. `tests/release.test.ts` pins 1.0.1. |
| D8 | Git and CI | Commit locally per task. Do **not** push and do not run GitHub Actions unless the owner asks. (`design.md` v3 asked for push plus CI per phase; the owner decides whether that still applies.) |

---------------------------------------------------------------------

# PHASE 0 — v1.0.1 hotfix

`evidence/p0-reference.patch` is a **validated** patch of T0.1 + T0.3 (built, then `smoke.cjs` printed `PASS 31 FAIL 0`; the unpatched build fails it). You may `git apply` it, or type the hunks yourself. Either way still do the tests below.

### T0.1 Alarm event adapter
**Files:** `src/background/chrome.ts` · new `tests/background/chromeAdapter.test.ts`
**Do:**
1. Line 67: `onAlarm: ChromeEvent<string>;` → `onAlarm: ChromeEvent<{ name: string; scheduledTime: number }>;`
2. Line 175: `onAlarm: chrome.alarms.onAlarm,` → `onAlarm: adaptEvent(chrome.alarms.onAlarm, (alarm) => alarm.name),`
3. Line 141: `function adaptEvent` → `export function adaptEvent` (so it can be tested).
**Test (first):**
```ts
import { describe, expect, it, vi } from "vitest";
import { adaptEvent } from "../../src/background/chrome.ts";

type Alarm = { name: string; scheduledTime: number };
function fakeEvent() {
  const listeners = new Set<(a: Alarm) => void>();
  return {
    addListener: (fn: (a: Alarm) => void) => listeners.add(fn),
    removeListener: (fn: (a: Alarm) => void) => listeners.delete(fn),
    fire: (a: Alarm) => listeners.forEach((fn) => fn(a)),
    size: () => listeners.size,
  };
}
describe("adaptEvent", () => {
  it("hands the listener the projected value, not the raw object", () => {
    const source = fakeEvent();
    const listener = vi.fn();
    adaptEvent(source, (alarm) => alarm.name).addListener(listener);
    source.fire({ name: "tick", scheduledTime: 1 });
    expect(listener).toHaveBeenCalledWith("tick");
  });
  it("removeListener detaches the exact wrapper it attached", () => {
    const source = fakeEvent();
    const listener = vi.fn();
    const adapted = adaptEvent(source, (alarm) => alarm.name);
    adapted.addListener(listener);
    adapted.removeListener(listener);
    expect(source.size()).toBe(0);
  });
});
```
(If `ChromeEvent` needs more members, add them to the fake.)
**Done when:** the test passes; `npm run typecheck` passes; **and** temporarily putting line 175 back to `chrome.alarms.onAlarm` makes `npm run typecheck` FAIL (that proves the type now guards the bug) — then restore your fix.
**Stop if:** `WorkerEventSource` / `ChromeEvent` types don't line up the way described — report the compiler message.

### T0.2 Stop swallowing errors
**Files:** `src/background/chrome.ts` (the `api` object, ~line 168) · `src/background/worker.ts` (`start()`, ~lines 449–470) · `tests/background/worker.test.ts`
**Do:**
1. In the `api` object add `onError: (effect, error) => { console.error("[FocusGate]", effect, error); },`. (`WorkerBrowserApi.onError?` already exists, `worker.ts:71`; `onError` is read at `worker.ts:170–171`.)
2. In `start()` two listeners are bare `void` calls (`worker.ts:455–460`). `handleInstalled` already catches inside (`:440–446`) and `onMessageListener` already has a `.catch` (`:461–468`), so leave those two alone. Change only:
```ts
const onAlarmListener = (name: string): void => {
  void handleAlarm(name).catch((error) => onError("alarm", error));
};
const onCommandListener = (command: string): void => {
  void handleCommand(command).catch((error) => onError("command", error));
};
```
**Test (first)** in `worker.test.ts`, built the way that file builds its fake api, plus `onError: vi.fn()`:
```ts
it("reports a failing alarm handler through api.onError instead of swallowing it", async () => {
  // fire the registered alarm listener with a NON-string -> name.startsWith throws inside the handler
  fireAlarm({ not: "a string" } as never);
  await flushPromises();
  expect(api.onError).toHaveBeenCalledWith("alarm", expect.any(TypeError));
});
```
**Done when:** test passes. **Stop if:** you cannot find how `worker.test.ts` captures the alarm listener — describe what you found.

### T0.3 The three UI crashes
**Files:** `src/ui/dashboard/DashboardPage.tsx` · `src/ui/dashboard/HabitsCard.tsx` · `src/ui/panel/views/RulesScreen.tsx`
**Do:** exactly the three hunks in `evidence/p0-reference.patch`:
- `DashboardPage.tsx:1` → `import { Component, useEffect, useState } from "react";`
- `HabitsCard.tsx:20` → `const todayKey = localDateKey(new Date());`
- `RulesScreen.tsx:11` → `import { assessUrl, computeBlockPlan } from "../../../shared/plan.ts";`
**Test:** T0.8 (`smoke.cjs`) covers these; there is no cheaper honest test because the bugs only exist in built pages.
**Done when:** `node tools/e2e/smoke.cjs dist` → `PASS 31 FAIL 0` (after T0.8). Until T0.8 exists: open `dist/dashboard.html` as an unpacked extension, visit all 5 tabs, and on the Rules tab press **Check** with `youtube.com`; the panel must show an answer, not go blank.

### T0.4 A crash must never blank a surface
**Files:** new `src/ui/components/ErrorBoundary.tsx` · `src/ui/mount.tsx` · `src/ui/dashboard/DashboardPage.tsx` (remove its private boundary, class at ~line 40) · new `tests/ui/errorBoundary.test.tsx`
**Do:** move the existing `DashboardErrorBoundary` into `ErrorBoundary.tsx` (named export `ErrorBoundary`, prop `children`). Wrap the root in `mount.tsx` so **panel, dashboard, blocked and onboarding** all get it. Fallback (pinned, `DESIGN.md` §9.3): heading **FocusGate hit a problem**, text **This screen crashed. Your rules and data were not changed.**, button **Reload** (`location.reload()`), and a `<details><summary>Technical details</summary>` with `error.message`. Log with `console.error("[FocusGate]", error)`.
**Test (first):** render a child that throws; expect the heading, the text and a button named "Reload"; expect no throw escaping.
**Done when:** test passes; smoke still passes (its crash detector matches both old and new wording).

### T0.5 Type-check the UI
**Files:** new `tsconfig.ui.json` (template: `templates/tsconfig.ui.json`) · new `src/ui/env.d.ts` (template: `templates/env.d.ts`) · `package.json` scripts only
**Do:** copy both templates. Change the script to `"typecheck": "tsc --noEmit && tsc --noEmit -p tsconfig.ui.json"` (keep whatever flags the current script has). The `types` entry must list **both** `"vite/client"` and `"chrome"` — listing only `vite/client` silently drops `@types/chrome` and produces 70 bogus errors.
Expected: after T0.3 there are **27** errors (`evidence/ui-typecheck-remaining-after-config.txt`). Fix them by group, **one commit per group**, never with `any`, `as any`, or `@ts-ignore`:

| Group | Where | Fix |
|---|---|---|
| G1 Chip tones | `AchievementsCard:31` · `OnboardingPage:72,73` · `FocusScreen:410` · `RulesScreen:347,354,662` · `YouScreen:142,361` | `Chip`'s tone union (`components/primitives.tsx`) lacks `"live"` and `"lock"`, but `styles.css:778–779` already styles `.fg-chip--live` / `.fg-chip--lock`. Add both to the union. |
| G2 Segmented | `DashboardStats:118` · `FocusScreen:504` · `RulesScreen:66,301,785,794` | Make `Segmented` generic: `<T extends string>` with `options: ReadonlyArray<{ value: T; label: string }>`, `value: T`, `onChange: (value: T) => void`. |
| G3 storageStore | `hooks/storageStore.ts:222,226,308` | Type the `state/write` reply as `{ ok: true } \| { ok: false; code: string; message: string }`; cast the `sendMessage` result to it. For 308 read the line; narrow instead of casting through `unknown` if you can. |
| G4 permissions | `lib/protectionStatus.ts:37,38` | The helper's query type is looser than `chrome.permissions.Permissions`; pass `query as chrome.permissions.Permissions`. |
| G5 FocusScreen | `FocusScreen.tsx:386,389` · `:673` | `import type { ReactNode } from "react";` · `:673` passes JSX to a prop typed `string` — widen that prop to `ReactNode` in `primitives.tsx` (`Card`'s `title`, probably). |
| G6 YouScreen | `YouScreen.tsx:47,52` · `:203` · `:223` | `localDateKeyOf` takes a number: pass `now.getTime() - 6 * 86_400_000`. `:223` → `changes.note ?? ""`. `:203` read the store updater type and fix the return type. |

**Done when:** `npm run typecheck` exits 0 and `npm test`, `npm run build` are still green.
**Stop if:** a fix would change runtime behaviour. Type-only changes here.

### T0.6 Smoke test the built extension
**Files:** new `tools/e2e/smoke.cjs` and `tools/e2e/README.md` (both copied unchanged from this pack) · `package.json` → `"e2e:smoke": "node tools/e2e/smoke.cjs dist"`
**Do:** copy the two files and add the script. If your environment has Chromium (and a display or `xvfb-run`), install Playwright **outside** the repo as `tools/e2e/README.md` says, build, and run it.
**Done when:** the files and the script exist, **and** someone has run it: `PASS 31 FAIL 0` on the fixed build, and a FAIL on a build without T0.1 and T0.3 (the shipped v1.1.0 gives `PASS 14  FAIL 17`: dashboard "could not start", service-worker `name.startsWith…`, `assessUrl is not defined`).
**If you cannot run a browser** (most agent sandboxes): tick only the "files exist" part, mark the run `UNVERIFIED: needs a browser`, and put the exact commands in the tracker's "Owner-run checks" table. Do not skip this silently and do not claim it passed.

### T0.7 Release 1.0.1
**Files:** `public/manifest.json` (`version`), `package.json` (`version`), `CHANGELOG.md`
**Do:** set the version to 1.0.1 (D9: the version stays 1.0.1 for every phase; later phases add changelog lines under 1.0.1 and never change `version`). Changelog entry (pinned):
> **1.0.1**: Focus sessions and schedules end on time again. The dashboard opens again. "Check a URL" no longer blanks the side panel. A crash now shows a message instead of a blank screen.
**Done when:** gates green + smoke green. The owner publishes; you do not.

---------------------------------------------------------------------

# PHASE 1 — the blocker tells the truth

Prereq: the `--engine` smoke checks are your red tests: `xvfb-run -a node tools/e2e/smoke.cjs dist --engine` currently prints 4 FAILs. They must all pass at the end of T1.2.

### T1.1 Reconcile after blocking-relevant UI writes
**Files:** `src/background/guardedStateWrites.ts` · `src/background/worker.ts` (:366) · `tests/background/guardedStateWrites.test.ts` · `tests/background/worker.test.ts`
**Do:**
1. `GuardedStateWriteDependencies` (~line 18) gains `afterChange?(key: GuardedStateKey): Promise<void>;`
2. In `write()` right after the successful `await dependencies.store.writeState({...})` (~line 179) and before `return { ok: true }`: `await dependencies.afterChange?.(input.key);`
3. `worker.ts:366` becomes:
```ts
const RECONCILE_KEYS: ReadonlySet<string> = new Set([
  "blockedSites", "alwaysBlockedSites", "exceptions", "keywords",
  "schedules", "allowances", "aliasExclusions",
]);
const guardedService = createGuardedStateWriteService({
  store,
  now,
  afterChange: async (key) => {
    if (!RECONCILE_KEYS.has(key)) return;
    try {
      await reconciler("state-write");
    } catch (error) {
      onError("reconcile-after-write", error);
    }
  },
});
```
   `reconciler` takes a plain `string` reason (`reconcile.ts:282–284`), so `"state-write"` and the `"quick-block"` of T1.2 need no type change.
**Test (first):**
- `guardedStateWrites.test.ts`: *calls `afterChange` once with the key after a successful write*; *does not call it when the write is refused (locked)*.
- `worker.test.ts`: *a `state/write` of `alwaysBlockedSites: ["news.test"]` leads to `declarativeNetRequest.updateDynamicRules` receiving a rule whose `requestDomains` contains `news.test`*; *a `state/write` of `settings` does not trigger a reconcile*.
**Done when:** unit tests pass, and `node tools/e2e/smoke.cjs dist --engine` shows the first three engine checks green.

### T1.2 Quick-block reconciles too
**Files:** `src/background/worker.ts` (:391–395) · `tests/background/worker.test.ts`
**Do:** in `addSites`, after `await update(key, …)` add `await reconciler("quick-block");`
**Test (first):** *Alt+Shift+B on a tab leads to a DNR rule for that tab's domain*.
**Done when:** test passes; `--engine` smoke fully green (4/4).

### T1.3 Recover when the browser starts
**Files:** `src/background/worker.ts` · `src/background/chrome.ts` · `tests/background/worker.test.ts`
**Do:** there is no `runtime.onStartup` handler anywhere. Add it in four places, mirroring `onInstalled`:
1. `worker.ts`, `WorkerBrowserApi.runtime` (~line 131): `onStartup?: WorkerEventSource<void>;` (**optional**, so the existing test fakes still compile).
2. `chrome.ts`: the type (~line 126) gets `onStartup: ChromeEvent<void>;` and the adapter (~line 233) gets, exactly like `tabActivated` at ~line 250, `onStartup: adaptEvent(chrome.runtime.onStartup, () => { /* no payload */ }),`
3. `worker.ts`, next to `handleInstalled` (~line 447):
```ts
const startupRecovery = async (): Promise<void> => {
  await ready();
  await session.recover();
  await tasks.reconcile();
  const state = await store.readState();
  const at = now();
  await ensureAlarmsFor(state, computeBlockPlan(state, at), at);
  await reconciler("startup");
};
```
4. In `start()`, bind and unbind it like the others:
```ts
const onStartupListener = (): void => {
  void startupRecovery().catch((error) => onError("startup", error));
};
api.runtime.onStartup?.addListener(onStartupListener);
unbinders.push(() => api.runtime.onStartup?.removeListener(onStartupListener));
```
**Test (first):** *on startup an expired work phase is recorded in history, the alarms exist again, and the network rules are rebuilt.* Build the fake api with an `onStartup` event the test can fire.
**Done when:** the test passes. **Stop if:** `ready`, `tasks` or `ensureAlarmsFor` is not in scope at that point of `worker.ts`: report what you found.

### T1.4 An expired phase is not "live"
**Files:** new `src/shared/sessionClock.ts` · `src/shared/plan.ts` (`computeBlockPlan`) · `src/shared/gating.ts` (`lockSource`) · `tests/shared/plan.test.ts` · `tests/shared/gating.test.ts`
**Do:** `export function isWorkPhaseLive(session: SessionState, now: number): boolean { return session.status === "work" && session.phaseEndsAt > now; }` Use it where those two functions currently test `session.status === "work"`. First `grep -n phaseEndsAt src/background/session.ts` and **match its comparison operator exactly** (`>` vs `>=`).
**Test (first):** state `{ session: { status: "work", lockLevel: "strict", phaseEndsAt: now - 1 } }` → `computeBlockPlan` has no session reasons and `lockSource` reports no lock; same state with `phaseEndsAt: now + 60_000` → blocked + locked.
**Done when:** new tests pass; fix only the existing tests whose fixtures used an elapsed phase without advancing the clock.

### T1.5 (optional — do last) Non-ASCII domains
**Files:** `src/shared/domains.ts` (`normalizeDomain`) · `tests/shared/domains.test.ts`
**Do:** convert through `new URL("http://" + value).hostname` so `bücher.de` becomes `xn--bcher-kva.de` at entry. **Test:** that exact pair. **Stop if** it changes any existing expectation — report instead of editing tests.

---------------------------------------------------------------------

# PHASE 2 — schedules that explain themselves

Prereq: T1.1 (a saved schedule must apply at once). Data model stays exactly as is (`Schedule` in `types.ts:28`). No migration.
Why: AUDIT §4.1. Pinned strings: `DESIGN.md` §9.3 "Schedules".

### T2.1 Pure helpers + tests
**Files:** `src/ui/lib/scheduleStatus.ts` (exists; exports `activeScheduleAt`, which nothing imports yet) + `tests/ui/scheduleStatus.test.ts` (extend it) · new `src/ui/lib/scheduleSummary.ts` + new `tests/ui/scheduleSummary.test.ts`
**Interfaces (exact):** `ScheduleStatus` and `scheduleStatus` go in `scheduleStatus.ts`; everything else goes in `scheduleSummary.ts`, which imports the type.
```ts
import type { AppState, Schedule } from "../../shared/types.ts";
export function summarizeDays(days: readonly number[]): string;
export function formatClock(hhmm: string, locale?: string): string;
export function formatRange(start: string, end: string, locale?: string): string;
export type ScheduleStatus =
  | { kind: "active"; schedule: Schedule; endsAt: number }
  | { kind: "next"; schedule: Schedule; startsAt: number }
  | { kind: "none"; reason: "no-schedules" | "all-off" };
export function scheduleStatus(schedules: readonly Schedule[], nowMs: number): ScheduleStatus;
export function statusLine(status: ScheduleStatus, nowMs: number, locale?: string): string;
export function describeTargets(
  schedule: Schedule,
  state: Pick<AppState, "blockedSites">,
): string;
```
Day index 0 = Sunday (as `WEEKDAYS` in `RulesScreen.tsx`); display order is Monday first.

**`scheduleStatus` algorithm.** Helpers in `src/shared/time.ts`: `isScheduleActiveAt(schedule, now: Date)`, `parseHHMM(value): number` (minutes after midnight; `"24:00"` is 1440), and `nextScheduleBoundary(schedules, now)`, which mixes the starts and ends of all schedules, so **do not** use it for "next start".
1. `active`: if some schedule satisfies `isScheduleActiveAt(s, new Date(nowMs))`, return the first one as `schedule`. For `endsAt` find where the *covered time* ends, not just that schedule's end: set `t = nowMs`; up to 16 times take the earliest end boundary after `t` among the schedules active at `t` (an end boundary is the first local time after `t` whose minutes after midnight equal `parseHHMM(s.end)`; try today, then tomorrow, using `setHours(0,0,0,0)` and `setMinutes(...)`), set `t` to it, and stop when no schedule is active at `new Date(t)`. `endsAt = t`.
2. `next`: for every enabled schedule that has at least one day, where `parseHHMM(start) !== parseHHMM(end)` and `start !== "24:00"`: try day offsets 0 to 7. The candidate is local midnight, plus the offset in days, plus `parseHHMM(start)` minutes. It counts when `s.days.includes(candidate.getDay())` and `candidate.getTime() > nowMs`. The smallest candidate over all schedules wins (`startsAt`).
3. `none`: no schedules at all gives `no-schedules`; otherwise (none enabled, or none can ever start) gives `all-off`.

**Tests for the algorithm** (local dates such as `new Date(2026, 10, 3, 10, 0)`): schedules 09:00 to 12:00 and 11:00 to 14:00 at 11:30 give `endsAt` 14:00. Back-to-back 09:00 to 12:00 and 12:00 to 14:00 at 10:00 give `endsAt` 14:00. Overnight 22:00 to 06:30 at 23:00 ends tomorrow 06:30, and at 05:00 ends today 06:30. A Mon to Fri 09:00 schedule asked on a Saturday gives next start Monday 09:00.
**Tests — these exact expectations** (build dates with `new Date(2026, 10, 3, 10, 0)`, i.e. local, so the tests don't depend on the machine's time zone; pass `"en-US"`):

| Call | Expected |
|---|---|
| `summarizeDays([0,1,2,3,4,5,6])` | `Every day` |
| `summarizeDays([1,2,3,4,5])` | `Weekdays` |
| `summarizeDays([6,0])` | `Weekends` |
| `summarizeDays([5,1,3])` | `Mon, Wed, Fri` |
| `formatClock("09:00","en-US")` | `9:00 AM` |
| `formatClock("24:00","en-US")` | `12:00 AM` |
| `formatRange("09:00","12:00","en-US")` | `9:00 AM – 12:00 PM` |
| `formatRange("22:00","06:30","en-US")` | `10:00 PM – 6:30 AM next day` |
| `describeTargets({useGlobalLists:true,sites:[]}, {blockedSites:[9 items]})` | `Blocks your Focus list (9 sites)` |
| same with 1 item | `Blocks your Focus list (1 site)` |
| same with 0 items | `Blocks nothing yet. Your Focus list is empty.` |
| `{useGlobalLists:false, sites:[]}` | `Blocks nothing yet. Add sites to this schedule.` |
| `{useGlobalLists:false, sites:["a.com","b.com"]}` | `Blocks a.com, b.com` |
| `{useGlobalLists:false, sites:["a.com","b.com","c.com","d.com","e.com"]}` | `Blocks a.com, b.com, c.com and 2 more` |
| `{useGlobalLists:true, sites:["a.com","b.com"]}` (Focus list 9) | `Blocks your Focus list and 2 more sites` |
| `statusLine` active "Study hours" until 12:00 | `On now: Study hours, until 12:00 PM.` |
| `statusLine` next, tomorrow 09:00 | `Next: Study hours, tomorrow 9:00 AM.` |
| `statusLine` next, later this week (Mon) | `Next: Study hours, Mon 9:00 AM.` |
| `statusLine` none/no-schedules | `No schedules yet.` |
| `statusLine` none/all-off | `All schedules are off.` |

Also test: overnight window `22:00–06:30` is `active` at 23:00 and at 05:00 next morning; a disabled schedule is never `active`/`next`.
**Done when:** all pass.

### T2.2 Week strip
**Files:** new `src/ui/lib/weekCoverage.ts` · new `src/ui/components/WeekStrip.tsx` · `src/ui/styles.css` (new `.fg-strip*` rules, tokens only) · tests `tests/ui/weekCoverage.test.ts`
**Interface:**
```ts
export interface Span { startMin: number; endMin: number } // minutes after 00:00, 0 <= start < end <= 1440
export function weekCoverage(schedules: readonly Schedule[]): Span[][]; // index 0..6 = Sun..Sat, sorted, merged
```
**Tests:** weekdays 09:00–12:00 → Mon..Fri each `[{540,720}]`, Sat/Sun `[]` · all days 22:00–06:30 → every day `[{0,390},{1320,1440}]` · `end:"24:00"` → `endMin 1440` · two overlapping schedules merge · disabled schedules ignored.
**Component:** 7 rows (Monday first), each a full-width track with filled spans, tick labels `12a 6a 12p 6p 12a`, a "now" marker on today's row, row label = weekday. Accessibility: container `role="group"` + `aria-label="Your week at a glance"`; every row has `aria-label="Monday: blocking 9:00 AM – 12:00 PM"` (or `"Monday: not blocking"`). Respect `prefers-reduced-motion` (no animation needed anyway).
**Done when:** unit tests pass; visual check at 300, 400 and 1280 px in both themes (screenshots into `evidence/` of your branch).

### T2.3 Schedule list redesign
**Files:** extract `ScheduleSection` (`RulesScreen.tsx:811–1021`) into new `src/ui/panel/views/ScheduleSection.tsx`; `RulesScreen.tsx` imports it. (The dashboard's Rules tab renders the same screen, so both surfaces change at once.)
**Do:**
1. Top of the card: description (pinned) + the `statusLine(...)` + `WeekStrip` (only when ≥1 schedule).
2. Row (stacked, nothing truncates at 300 px): title; meta line `${summarizeDays}, ${formatRange}`; targets line `describeTargets`; right side: switch with a **visually hidden** label (keep `aria-label`), **Edit** button. Delete moves into the Edit sheet.
3. Empty state: pinned copy + three template buttons (**Work hours** Mon–Fri 09:00–17:00 · **Study** Mon–Fri 18:00–21:00 · **Sleep** every day 22:00–07:00) that open the sheet pre-filled.
4. Warning chip on a row when it would block nothing: pinned `This schedule blocks nothing yet.` + button **Fix**, opening its Edit sheet.
**Test:** render with fixtures (empty / 2 schedules / one active now) and assert the pinned strings; assert no visible text equals `Enable <name>`.
**Done when:** tests pass; screenshot at 400 px shows the title untruncated for a 20-character name and the 7-day "Sun–Sat" schedule on ≤ 2 lines.

### T2.4 Add / edit sheet
**Files:** `ScheduleSection.tsx` (+ a small `ScheduleSheet` inside it or in its own file)
**Fields:** name · day presets **Weekdays / Weekends / Every day** + the seven day toggles · start/end (`type="time"`) · **What should it block?** radio group:
- **My Focus list (N sites)** → `useGlobalLists: true, sites: []`
- **Only these sites** → `useGlobalLists: false, sites: [...]`
- **My Focus list and these sites** → `useGlobalLists: true, sites: [...]`
Sites input: one domain per line, each passed through `normalizeDomain` (`shared/domains.ts`).
Remove the helper "24:00 means midnight." (a time input cannot produce it); keep accepting `24:00` from stored data.
Validation strings (pinned): `Enter a name for this schedule.` (existing) · `Choose at least one day.` (existing) · `Add at least one site, or use your Focus list.` (new).
**Lock rules:** when a Strict/Commit lock is active, saving must not weaken. Use the existing classifier — `classifyStateMutation` in `src/shared/guardMutations.ts` (see line ~76 for the schedule rules) — and show the lock reason instead of saving. Do not re-implement.
**After save:** toast `Schedule saved. ` + `statusLine(...)` (pinned form).
**Test:** unit-test the form→`Schedule` mapping for the three radio choices; test that a weakening edit under lock shows the reason and does not call the store.
**Done when:** tests pass; `--engine` smoke green; manual: create a schedule that is active now → the block page appears with 0 requests reaching the site (reuse `evidence/probes/probe6.cjs` steps A–B as a guide).

### T2.5 Block page says which schedule
**Files:** `src/ui/blocked/BlockedPage.tsx`
**Do:** for reason `schedule` show headline `Blocked by schedule: <name>` and `Ends <time>` (pinned). Use `formatClock`-style formatting.
**Done when:** screenshot + a render test.

---------------------------------------------------------------------

# PHASE 3 — the extension talks

### T3.1 `describeNow` (pure)
**Files:** new `src/ui/lib/statusSummary.ts` · new `tests/ui/statusSummary.test.ts`
**Interface:**
```ts
export type StatusTone = "idle" | "focus" | "schedule" | "locked" | "break";
export interface StatusSummary {
  tone: StatusTone;
  headline: string;
  detail: string;
  secondary: string[];            // e.g. allowance notices
  canEdit: "all" | "stricter-only";
  cta?: { label: string; target: "rules" | "schedule" };
}
export function describeNow(state: AppState, nowMs: number, locale?: string): StatusSummary;
```
Use `computeBlockPlan(state, now)` for what is blocking and why, `weakeningLockReason(state)` (`ui/lib/guardState.ts`) for `canEdit`, `scheduleStatus` from T2.1. **Pinned table** (N = number of blocked domains in the current plan; time = `formatClock`):

| Situation | tone | headline | detail |
|---|---|---|---|
| No sites, keywords, schedules or limits at all | idle | `Nothing is blocked yet.` | `Add sites in Rules, then start a focus session.` · cta `Add sites` → rules |
| Idle, Always list has N>0 | idle | `The Always list is blocking N sites.` | `Start a focus session to block your Focus list too.` |
| Idle, nothing active | idle | `Nothing is blocking right now.` | `Start a focus session, or add a schedule to block automatically.` · cta `Add a schedule` → schedule |
| Work phase, lock none | focus | `Focus session is on.` | `Ends 12:48 PM. Blocking N sites. You can edit rules and stop any time.` |
| Work phase, strict | locked | `Strict focus session is on.` | `Ends 12:48 PM. Rules can only get stricter until then.` |
| Work phase, commitment | locked | `Commitment session is on.` | `Ends 12:48 PM. There is no early stop, and rules can only get stricter.` |
| Break | break | `On a break.` | `Focus sites are open until 12:53 PM.` |
| Block now running | locked | `Block now is on.` | `N sites are blocked until 1:15 PM. There is no early stop.` |
| Schedule active, no session | schedule | `Schedule is on: Study hours.` | `Blocking N sites until 12:00 PM.` |
| Any allowance exhausted | (adds to `secondary`) | | `youtube.com reached its daily limit.` |

Singular/plural: `1 site` / `N sites`. **Test:** one test per row with a fixture built from `defaults.ts`.
**Done when:** all pass. **Stop if:** a row's fixture can't be built because a state field is unclear — ask.

### T3.2 Status strip + labelled header pill
**Files:** new `src/ui/components/StatusStrip.tsx` · `src/ui/panel/PanelPage.tsx` (header + under-header slot; `statusFromState` at ~line 30–41) · `src/ui/dashboard/DashboardPage.tsx` (header slot) · `styles.css`
**Do:** the strip shows `headline` (16/600) + `detail` + an optional cta button. The cta is a quiet or secondary button, **never** `fg-btn--primary` (`panelRender.test.tsx` requires exactly one primary button when idle and none while running). The 3 px left bar is coloured by tone: idle `--border`, break `--break`, focus / schedule / locked `--warning`. Replace the unlabeled dot in `AppHeader` with a text pill (DESIGN §5): idle gives `Not blocking`; focus, schedule and locked give `Blocking` (locked adds a lock icon); break gives `Break`. The strip re-renders on state change only (no per-second timer inside it; the timer lives in the Focus tab).
**Test:** render per tone, assert headline text, the pill label, and `role="status"` on the strip.
**Done when:** screenshots at 300/400 px.

### T3.3 Lock explainer
**Files:** `src/ui/panel/views/FocusScreen.tsx` (`LOCK_SUMMARY` near lines 53–57; the strict sentence near lines 509–510) · `tests/ui/panelRender.test.tsx` (add a case). **Do not edit `tests/claims.test.ts`.**
**Do:** the lock sentences are pinned by `tests/claims.test.ts` (C30) and `design.md` §6.2, so **keep them word for word** and add one line to each. Under the Lock selector show three rows, always visible, the selected one emphasised and carrying `aria-current="true"`. Each row is the pinned sentence plus a new sentence (DESIGN §9.3):
- **None:** `You can stop any time with a confirmation.` then `You can add, change or remove rules at any time.`
- **Strict:** the existing strict sentence (the password variant or the "I GIVE UP" variant; move it into a small function `strictStopSummary(hasPassword: boolean): string` called from both places, text unchanged) then `You can add rules, but not remove or relax them until the session ends.`
- **Commit:** `There is no early-stop action. You can still disable or remove the extension.` then `You can add rules, but not remove or relax them until the session ends.`
**Test:** render the Focus screen idle; assert the three rows' text and `aria-current` on the selected one. `npx vitest run tests/claims.test.ts` stays green untouched.

### T3.4 Locked controls explain themselves
**Files:** `src/ui/lib/guardState.ts` · `src/shared/gating.ts` · components that disable on lock (`RulesScreen.tsx` Remove/Delete/Toggle; `grep -n weakeningLockReason src/ui`)
**Do:**
1. Where a control is disabled by a lock, print the reason **visibly once above the group** (`<p id="lock-reason" role="status">`) and point each disabled control at it with `aria-describedby`. Keep `title` only as a bonus.
2. `gating.ts` builds `Locked until ${source.until} by your …` with a raw millisecond value. Format it as a clock time with the same formatter the UI uses (move that formatter into `src/shared/` and import it from both).
**Test:** `gating.test.ts`: with fake time, message equals `Locked until 12:42 AM by your strict session.` (pass the locale into the formatter so the test is stable).
**Done when:** the background `LOCKED` reply no longer contains a 13-digit number.

### T3.5 First run
**Files:** `src/background/worker.ts` (`handleInstalled`, ~lines 436–447) · browser-API type + `chrome.ts` (`tabs.create`) · `src/ui/panel/views/FocusScreen.tsx` (empty state) · tests
**Do:** on `reason === "install"` open `onboarding.html` in a tab. In the Focus tab, when there are no sites at all replace the grey line with the status strip's `Add sites` button (T3.2) — don't disable **Start focus**.
**Test (first):** `handleInstalled({reason:"install"})` → `tabs.create` once with a URL ending `/onboarding.html`; `reason:"update"` → not called.

---------------------------------------------------------------------

# PHASE 4 — a profile that is a profile

### T4.1 Two new settings
**Files:** wherever a full `Settings` object is declared, defaulted, migrated or validated: `src/shared/types.ts` (`Settings`, line ~154), `src/shared/defaults.ts`, the settings normalizer and the backup validator (`grep -rn dailyGoalMin src/shared` finds them), the fixtures under `tests/fixtures/`, and any test that builds a full `Settings` literal. Do **not** add the fields to the onboarding presets (`OnboardingPage.tsx` also has a `dailyGoalMin`, but that is a preset, not `Settings`).
**Fields:** `displayName: string` (trimmed, ≤ 24 chars, default `""`) · `why: string` (trimmed, ≤ 140 chars, default `""`).
**Test (first):** old stored settings without the fields migrate to `""`; over-long values are cut; a backup round-trip keeps them.
**Done when:** the tests pass and `npm run typecheck` is green (a full `Settings` literal that misses a field is a compile error).

### T4.2 Profile screen
**Files:** `src/ui/panel/views/YouScreen.tsx` (keep the file name; the tab label stays **You**) · new small components under `src/ui/panel/views/profile/`
**Order of sections (pinned names in `DESIGN.md` §9.3):**
1. **Header:** a badge with the first letter of the name (a neutral person icon when empty; no emoji) + display name (inline edit; placeholder `Your name`) + `Focusing since <month year>` only if the state already holds an install or first-use date (check `types.ts`; do not add a field for it).
2. **Your reason:** the `why` text (inline edit; placeholder `Why are you doing this?`). One line of help: `Shown on the block page.`
3. **What you're protecting:** rows named exactly as in `DESIGN.md` §9.3 (`Focus list`, `Always list`, `Keywords`, `Schedules` (shows the `statusLine`), `Daily limits`, `Default lock`, `Password`) with their value on the right (`9 sites`, `None`, `Set`, `Not set`). Each row is a button that switches to the matching Rules section, and its accessible name includes the value (`Focus list, 9 sites. Open in Rules.`).
4. **Today and this week:** one compact row (focused / goal / streak) + the 7-day bars (T5.5 component when it exists, the current SVG until then).
5. **Achievements** with the condition text (progress only where the definition exposes a number).
6. **Journal and tasks** (collapsed `<details>`): the existing `TasksView`, `ReflectionCard`, `HabitsCard` unchanged.
**Test:** render with a fixture; assert section order and that editing `why` writes `settings.why` through the guarded path.
**Done when:** screenshots at 300/400 px; no horizontal scroll.

### T4.3 The user's reason on the block page + grammar
**Files:** `src/ui/blocked/BlockedPage.tsx` · `src/shared/defaults.ts` (extract one constant, nothing else) · new render test under `tests/ui/`
**Do:** the stock line is the *default value* of the user-editable block-page message (`blockPage.message`, `src/shared/defaults.ts:76`), and a fixture plus `tests/shared/blockPage.test.ts` pin it. **Do not change the default.** In `defaults.ts` add `export const DEFAULT_BLOCK_MESSAGE = "Stay focused. You've got this.";` and use it for the existing value (the string is unchanged). In `BlockedPage.tsx`: show `settings.why` (when set) in quotes under the detail line with the label `Your reason`; show the configured block-page message **only when it differs from `DEFAULT_BLOCK_MESSAGE`** (the user wrote their own); otherwise show neither. Fix `1 pages blocked today`: `${n} ${n === 1 ? "page" : "pages"} blocked today.` Keep everything the block page pins (list in `AGENT_PROMPT.md`).
**Test:** render with `why` set; with `why` empty and the default message; with a custom message. Assert the quote, the absence of the default line, and the plural for 0, 1 and 2.

---------------------------------------------------------------------

# PHASE 5 — identity (read `DESIGN.md` fully first)

### T5.1 Icons
**Files:** `public/icons/icon-{16,32,48,128}.png` · `store-assets/icon-128.png` · `src/ui/**` wherever the logo `<img>` is used
**Do:** replace with the files in `assets/icons/` (corners are now transparent; verified on a dark surface). Don't redraw the logo (D1-A).
**Done when:** screenshot of the panel header and block page on the dark theme shows no white corner notches.

### T5.2 Tokens
**Files:** `src/ui/styles.css` (the token blocks only, lines 3–109) · `tools/contrast-check.mjs` (copy from this pack) · `tests/ui/themeTokens.test.ts` (additive edit below)
**Do:** the file has **four** copies of the colour tokens: `:root, :root[data-theme="dark"]`, `:root[data-theme="light"]`, `:root[data-theme="system"]`, and the one inside `@media (prefers-color-scheme: light)`. Run `node tools/contrast-check.mjs --css` and replace the matching colour lines (the 15 colour tokens, plus `--shadow-pop` and `--scrim` where a block has them) in all four. Values are tabled in `DESIGN.md` §2. Do not rename tokens and do not add new ones. Change `--radius-card` to `10px` and `--radius-ctl` to `6px` (first block only). No `{` or `}` inside a block.
Then review every use: `grep -n "var(--warning)\|var(--break)\|var(--accent)" src/ui/styles.css`. Amber is for "blocking right now" only (DESIGN §2 and §10). Anything that used the old amber or blue as decoration moves to `--text-muted`, `--border` or `--surface-2`.
**Test:** `npx vitest run tests/ui/foundation.test.ts tests/ui/themeTokens.test.ts` stays green without edits. One additive edit is allowed in `themeTokens.test.ts`: also assert `danger-contrast` on `danger` and `warning-contrast` on `warning` are at least 4.5.
**Done when:** `node tools/contrast-check.mjs` prints `all pairs meet their target`, the two tests pass, and (needs a browser) screenshots of panel and dashboard in both themes exist.

### T5.3 Type
**Files:** `styles.css`
**Do:** add `--font-ui` and `--font-num` (values in `DESIGN.md` §3) to the first token block (non-colour lines are fine there). The body rule (near line 125) and the `Inter` rule (near line 572; write it as the shorthand `font: 400 14px/1.45 var(--font-ui);`) use `--font-ui`. The timer, `.fg-stat__value` and countdowns use `--font-num`. **No `@font-face` yet** (decision D2). Delete every `text-transform: uppercase` and its `letter-spacing` (four places: `grep -n uppercase src/ui/styles.css`) and make those labels 13 px, weight 500, sentence case as written in the component. Add `font-variant-numeric: tabular-nums` to the timer, stat values and every numeric column. Sizes follow the table in `DESIGN.md` §3; the timer keeps 72 px and the existing `--smallest` 48 px rule. `font-size` only in px or rem and at least 12 (`themeTokens.test.ts` checks every declaration).
**Done when:** the two UI tests pass; (needs a browser) screenshots show no all-caps label except real acronyms.

### T5.4 Panel layout: rows, not stacked cards
**Files:** `styles.css` + the panel views
**Do:** follow DESIGN §5. Sections become headed groups separated by space and at most one hairline; a **row** = left status bar (3 px) + title + meta + trailing control. Cards remain only for the timer, dialogs and sheets. **Restyle the `.fg-*` classes; do not delete any class listed in `tests/ui/foundation.test.ts`.** Keep `.fg-panel { display: flex; … min-width: 300px; … }` as the tests expect it.
**Done when:** Sites list shows no chip overlap at 300 px (AUDIT §5: the tiktok.com row) and tasks show full titles.

### T5.5 Dashboard layout and charts
**Files:** `src/ui/dashboard/DashboardPage.tsx`, `DashboardStats.tsx`, new `src/ui/components/WeekBars.tsx`
**Do:** two columns from 1100 px (main | right rail with schedule strip, limits, protection status). Hero shows **today** (focused vs goal) — the weekly figure moves to the chart caption; delete the duplicated stats (completion rate once; total focus time once). Explain or remove **Focus score** (if kept: a `?` popover stating the formula from the code) and rename **Protection gaps** to `Times protection was off` with a one-line explanation. `WeekBars`: full-width, weekday labels, value above the tallest and today's bar, `aria-label` summary, focusable bars with the exact minutes.
**Test:** render tests for hero text (no mixed scopes), `WeekBars` aria summary.

### T5.6 Block page
**Files:** `BlockedPage.tsx`, `styles.css`
**Do:** reason-first layout per `DESIGN.md` §5 (Block page): headline `Blocked by …` (sentence case), big tabular countdown, one detail line, the user's reason (T4.3), actions `Close tab` / `Open new tab`.

### T5.7 One signature moment
**Files:** `FocusScreen.tsx`, `StatusStrip.tsx`, `styles.css`
**Do:** when a session starts, the status strip's left bar sweeps from 0 to full height over 280 ms ("the gate closes"). Only this animation. Wrap in `@media (prefers-reduced-motion: no-preference)`. Remove any entrance fade/slide the sections have (`grep -rn "motion" src/ui`).

### T5.8 About line
**Files:** `DashboardSettings.tsx` (bottom)
**Do:** `FocusGate v<manifest version> by TBTechs` and the existing sentence `Your data stays in browser storage.` Keep the existing FocusFlow links in that card exactly as they are (`tests/claims.test.ts` C40 requires them there and forbids them on the block page). Add no other links.

---------------------------------------------------------------------

# PHASE 6 — accessibility and interaction

### T6.1 ARIA fixes (exact)
Run `xvfb-run -a node tools/e2e/smoke.cjs dist --a11y` before and after; the end state is **0 critical/serious**.

| File:line | Fix | CSS that must change with it |
|---|---|---|
| `primitives.tsx:228` (`Toggle`) | delete `aria-pressed={checked}` (keep `role="switch"` + `aria-checked`) | `styles.css:932–933` `[aria-pressed="true"]` → `[aria-checked="true"]` |
| `primitives.tsx:268` (`Segmented`) | delete `aria-selected` (keep `aria-pressed`; `tests/ui/primitives.test.tsx` asserts it); drop the duplicate `aria-labelledby` or `aria-label` on `:260–261` | `styles.css:894–895` keep only `[aria-pressed="true"]` |
| `PanelPage.tsx:101–109` | wrap the tab buttons in `<div role="tablist" aria-label="Panel sections">` | `styles.css:659` unchanged |
| `PanelPage.tsx:78–83` | `<main>` must not carry `role="tabpanel"`: put `role="tabpanel"` + `aria-labelledby` on an inner `<div>` | — |
| `Progress` (`primitives.tsx`) | require an `label` prop → `aria-label`; pass it at the hero goal and the usage cell | — |
| panel | add a visually hidden `<h1>FocusGate</h1>` | — |
| dashboard cards | `h3` → `h2` where no `h2` precedes | check heading CSS |
| `.fg-hero__time`, `.fg-dashboard__brand` | remove the `aria-label` that differs from the visible text (or include the visible text in it) | — |

`styles.css:1188` (`button.fg-row[aria-pressed="true"]`) — only change if the row gets a different role.
**Done when:** smoke `--a11y` passes.

### T6.2 Shortcuts
**Files:** `DashboardSettings.tsx` (new row), `chrome.ts` untouched
**Do:** a **Keyboard shortcuts** row listing `chrome.commands.getAll()` (name, current key or `Not set`), and a button **Change in Chrome** that opens `chrome://extensions/shortcuts` via `chrome.tabs.create`. Copy: `Not set. Another app or Chrome itself may be using this key.` for an empty binding. (AUDIT §5: `block-current-site` was unassigned in Chromium/Linux.)
**Done when:** with the extension loaded the row shows the live bindings.

### T6.3 Focus, motion, zoom
Visible `:focus-visible` ring on every interactive element (2 px, `--accent`, 2 px offset); every animation behind `prefers-reduced-motion`; check **300 px width** and **200 % browser zoom** on panel and dashboard: no clipped controls, no horizontal scroll. Record screenshots.

---------------------------------------------------------------------

# PHASE 7 — release
- **T7.1** Keep version 1.0.1 (D9) in `public/manifest.json` and `package.json`; add `CHANGELOG.md` lines under the 1.0.1 entry from user-visible changes only (no banned words). Do not bump.
- **T7.2** Refresh `store-assets/screenshot-*.png` from the new UI and the `README.md` images. Needs a browser; otherwise `UNVERIFIED` and the owner does it.
- **T7.3** Final gate: `npm test`, `npm run typecheck`, `npm run build`, and `smoke.cjs --a11y --engine --slow` (owner-run if the agent has no browser).

The owner publishes.

---------------------------------------------------------------------

# Watch list (not covered by a task's tests — look at these by hand)
1. **Overnight and midnight:** a schedule `22:00–06:30` on a Sunday into Monday; the strip and `statusLine` at 23:59 and 00:01; daylight-saving days.
2. **Start focus with an empty list** — must not crash or show a misleading status.
3. **Strict lock + schedule edit** — the sheet must refuse weakening saves and say why; strengthening saves still work.
4. **Very long names / domains** — schedule names of 40 characters, `a-very-long-subdomain.example-domain.co.uk` in chips: wrap, don't overflow.
5. **Service-worker sleep:** after the browser sat idle > 1 minute, a UI edit still lands in the network blocker (T1.1) and the next alarm still fires.

# Backlog (do not start without the owner)
Pause/snooze with cooldown (D4) · bisect-install the consolidated DNR rule so one bad domain can't take down all rules · cache full-state reads in `explainBlock` after measuring them · i18n · Firefox build · per-site daily stats.
