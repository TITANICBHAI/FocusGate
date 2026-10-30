# FocusGate — Manual Browser Test Guide (WP9.1)

This guide turns the plan's manual matrix (§8.2), the browser-only edge cases
(§8.5), and every open browser-dependent acceptance criterion into a single
step-by-step checklist you can run in Chrome, Edge, and Firefox.

**How to record results:** tick the checkbox and write the actual observed
result next to it (one line is enough, e.g. `✅ blocked, URL preserved`). Paste
the whole section back to the assistant afterwards — the tracker will record
each row as verified.

**Where things stand before you start:** all code through WP8 is implemented
and CI-verified (327+ deterministic tests green). The extension still runs the
**v1 runtime** (v1 popup/worker) until the Phase 1 cutover below, so some
checks can only be done after that phase. Everything else can run on the
current build.

**Browsers:** repeat every phase in Chrome and Edge (same engine, so one pass
usually transfers — still confirm install + block page once in Edge), and in
Firefox as a temporary add-on.

---

## Phase 0 — Build and install

1. Build the extension where Node.js is available (Replit, or `npm ci &&
   npm run build` if you enable Node locally):
   - Input: `dist/` is produced with `popup = index.html`, v1 worker, and
     staged v2 assets (`content-v2.js`, staged UI pages) — the cutover flips
     these later.
2. **Chrome/Edge:** `chrome://extensions` → enable *Developer mode* →
   *Load unpacked* → select `dist/`.
3. **Firefox:** `about:debugging#/runtime/this-firefox` → *Load Temporary
   Add-on* → select `dist/manifest.json`. Note: temporary add-ons reset on
   browser close.
4. Pin the toolbar icon; open the popup once.

- [ ] Chrome loads with no console errors on `chrome://extensions`
- [ ] Edge loads with no console errors
- [ ] Firefox loads as a temporary add-on
- [ ] The popup opens and shows the v1 timer UI (expected until Phase 1)

---

## Phase 1 — WP1b spikes (browser checks that unblock the cutover)

These four checks answer the questions the headless environment could not.
They use the current (v1) build — that is enough, because they test the
*browser's* behaviour, not FocusGate's.

### S1 — DNR redirect URL preservation (the critical one)

The v1 worker redirects blocked sites to the popup. To test URL preservation
independently, load the tiny throwaway extension from the WP1b notes
(`docs/spikes.md` has it) or temporarily add a site you control to the v1
blocker. For each navigation path below, visit the blocked site and record
**exactly what URL the redirect landed on**:

- [ ] Typed URL in the address bar → `__`
- [ ] Link click from another page → `__`
- [ ] `window.open(..., "_self")` from the console → `__`
- [ ] HTTP 302 redirect chain (e.g. a short-link) → `__`
- [ ] With `web_accessible_resources` declared → `__`
- [ ] Without `web_accessible_resources` → `__`

Record: does the blocked page receive the original URL (fragment intact,
`&`/`?` preserved)? Chrome result `__`, Edge `__`, Firefox `__`.

**Pass rule:** if the original URL survives all six paths in Chrome, Plan A
(redirect + fragment) is confirmed and the cutover may proceed. If any path
loses the URL, stop and report — the fallback design must change first.

### S2 — Attention sampling reality check

Only verifiable with the cutover build; skip now and repeat in Phase 3.
*(Expected: focus time accrues only while the FocusGate extension's window is
focused, the tab is active, and you are not idle; background audio counts
only if the setting is enabled.)*

### S3 — Alarm stability across browser restart

1. Load the current build, start a 25-minute session, then close and reopen
   the browser (not the session).
2. In the worker console (`chrome://extensions` → service worker → Inspect):
   `chrome.alarms.get('weekly_report')` before and after the restart.

- [ ] `scheduledTime` identical before/after restart (Chrome `__`, Firefox `__`)

### S4 — Firefox specifics

- [ ] `background.scripts` (non-worker) keeps the extension working after reload
- [ ] DNR redirect works in Firefox the same as Chrome (or note the difference)
- [ ] Notification without buttons shows correctly

**Gate rule:** when S1 passes in Chrome (+ Edge/Firefox noted), tell the
assistant — the Phase 2 cutover will be prepared and pushed, and the remaining
phases run on the v2 build.

---

## Phase 2 — The WP5 atomic cutover (prepared by the assistant on request)

This is a code change (manifest routes → v2 popup/worker/content, storage
migration activation). It is gated on Phase 1 S1 passing. After the assistant
pushes it:

1. Load the rebuilt `dist/` **with your old v1 data present** (sites you added
   in Phase 0). Migration should convert everything and write `backup_v1`.
2. Snapshot-check: Rules show your v1 sites; a running v1 session (if any)
   carried over; a v1 "no limit" standalone block became Always-blocked sites.

- [ ] Migration kept all v1 rules and history; `backup_v1` written
- [ ] Popup now shows the v2 UI (Focus/Tasks/Rules/Stats/Settings tabs)
- [ ] Rollback available: the pre-cutover `dist/` zip still loads

---

## Phase 3 — The manual matrix (plan §8.2) on the v2 build

Run each row on Chrome, Edge, and Firefox. Expected results come from the
plan; `EC##` tags map to the edge-case catalogue.

### Install and upgrade

- [ ] Fresh install opens onboarding (protection check lists incognito, site
      access, notifications) — Chrome `__` Edge `__` Firefox `__`
- [ ] Upgrade from a v1 profile keeps sites/schedules/allowances/tasks/
      password/history (EC39) — `__`
- [ ] Extension update during a v2 lock keeps the state and re-arms alarms
      (EC40) — `__`

### Sessions

- [ ] Start/stop/extend with the popup closed: end notification fires, badge
      changes to break, sites unblock during break, history records one
      completed session (EC02/EC03) — `__`
- [ ] Stop the worker mid-session (`chrome://extensions` → service worker →
      Stop): remaining time is correct on wake; the session ends on time — `__`
- [ ] Close the browser mid-session, reopen before the end: session resumes
      with correct remaining time; a >3 min gap is recorded (EC03) — `__`
- [ ] Commitment: no stop button; shortcut reports locked; ends by itself — `__`
- [ ] Strict with password: wrong password rejected in the background; correct
      password + 15 s wait stops; shortcut cannot bypass — `__`
- [ ] Extend by 15 min at every lock level; ring, badge, alarm update — `__`
- [ ] Extend beyond 24 h refused (EC11) — `__`
- [ ] Session crossing local midnight attributes focus to the start date
      (EC01) — `__`
- [ ] Clock moved forward: ends at the next tick, gap recorded, no focus
      credit if gaps cover > half the phase (EC04) — `__`
- [ ] Clock moved backward: `phaseEndsAt` extends by the difference, record
      flagged (EC05) — `__`
- [ ] Auto-start does not catch up while the browser was closed (EC12) — `__`
- [ ] Two popups open during a session: no double decrement (EC14) — `__`

### Blocking

- [ ] Typed URL, link click, new tab, back/forward, SPA route → all land on
      `blocked.html` with the original URL and no flash (EC16/EC18) — `__`
- [ ] `notexample.com`, `example.com.au`, `example.community` unblocked;
      `www.example.com` and `a.b.example.com` blocked — `__`
- [ ] Exception `youtube.com/watch?v=abc` allows only that video (also with
      `&t=5`), not `v=abcd` or the root (EC19/EC20) — `__`
- [ ] `https://u@site.com:8443/` matched by host (EC19); Unicode/punycode
      domain blocked (EC20); `localhost`/IP exact match only (EC21) — `__`
- [ ] 500 sites + 200 exceptions + 50 keywords install; `health.ruleCount`
      shows the count (EC22) — `__`
- [ ] One garbage/non-ASCII entry is skipped and reported; the rest install
      (EC23) — `__`
- [ ] `chrome://`, `about:`, `view-source:`, extension pages never redirect
      (EC26) — `__`
- [ ] An already-open background tab is replaced once when blocking starts,
      and the start confirmation says how many tabs will be replaced
      (EC15) — `__`
- [ ] The same domain blocked by session and schedule shows one reason with
      the longest end time (EC30) — `__`

### Schedules

- [ ] 09:00–17:00 weekday schedule starts/stops without any interaction — `__`
- [ ] Overnight (22:00–06:00), `24:00` end, and the previous-day rule work — `__`
- [ ] Schedule end removes its domains from the rules without a storage
      change (EC31–EC34 unaffected) — `__`

### Allowances

- [ ] Time budget, count, and interval modes enforce their examples;
      unfocused/idle time does not count; remaining budget visible — `__`
- [ ] Two windows: only the focused window's active tab counts (EC31);
      audible background tab counts only with the setting on (EC32) — `__`
- [ ] `duringBlocks` on: no flash when the budget allows; exhausted → redirect
      at the next tick (EC33) — `__`
- [ ] Editing an allowance: same mode keeps usage; mode change resets it
      (EC37); interval windows ignore midnight (EC38); both alias hosts share
      one budget (EC36) — `__`
- [ ] Heads-up notification at 5 min/10% left, exhaustion alert, optional
      badge while on the site; session badge wins — `__`

### Keywords and content filters

- [ ] `q`, `query`, `search_query`, `text`, `wd` match; comma input splits;
      whole-word works; YouTube in-page search blocked — `__`
- [ ] Fragment-only keyword ignored (EC51); `%20`/`+` decoded (EC52);
      non-Latin whole-word works (EC53) — `__`
- [ ] Toggles on/off live and reversible without reload; off during breaks;
      no console errors on 20 cold loads (EC54) — `__`

### Block now (standalone) and block page

- [ ] Start with confirmation; extend; add site; no stop anywhere; every
      locked action explains itself — `__`
- [ ] Block page: real verdict, reason, countdown only for session/standalone,
      "Open {host}" only for http(s) URLs that are not blocked now (EC28) — `__`
- [ ] Block ends while the page is open → "Block ended" + Open {host}
      (EC29); midnight passes → budget reset offered (EC34) — `__`

### Security and data

- [ ] Password set/verify/remove; legacy hash upgrades; generator; gated
      actions — `__`
- [ ] Password forgotten: no recovery, copy says so (EC44); Strict dialog
      reopened restarts the 15 s wait (EC45) — `__`
- [ ] Backup export → reset → import restores on an empty state except the
      password (EC47); merge into a working state only adds and lists skips
      (EC46); corrupt/oversized/future-version file rejected with the state
      untouched (EC48) — `__`
- [ ] DevTools weakening edit during a lock is accepted and documented
      (EC43 — watchdog not built) — `__`
- [ ] Storage wiped during a lock: fresh unlocked state; Protection status
      states the limit (EC42) — `__`
- [ ] Disable → re-enable during a lock: rules rebuilt, heartbeat gap shown
      as a protection gap (EC41) — `__`
- [ ] Two dashboards edit the same list: last write wins, nothing lost
      (EC49) — `__`
- [ ] Worker killed mid-transition: next wake sees the old or the new phase,
      never a mix (EC50) — `__`

### UI, themes, and accessibility

- [ ] Every tab at 380×580: no overflow, all controls reachable — `__`
- [ ] Light/dark themes and 200% zoom — `__`
- [ ] Keyboard-only: modal focus trap, Esc closes, visible focus — `__`
- [ ] Notifications denied: badge/block page/history still work; Protection
      status shows "Notifications off" (EC13) — `__`
- [ ] Downloads on a blocked domain are replaced by the block page (EC27,
      documented in About) — `__`
- [ ] Iframes/subresources of blocked sites are NOT blocked; the Sites copy
      says so (EC17) — `__`

### WP7 feature acceptance (browser AC)

- [ ] Reminders fire at the right minute after a browser restart: a 14:00
      task shows 13:50 / 13:55 / 13:59 pre-start, at-start, and "Start now"
      — `__`
- [ ] Recurring tasks generate exactly one instance per day — `__`
- [ ] Presets never apply without confirmation — `__`
- [ ] C01/C13/C14 pass (§8.4 claims) — `__`

### WP8 acceptance

- [ ] Stats show a UI-started session immediately when it ends (WP8.AC1) — `__`
- [ ] Dashboard ranges, SVG chart, score, streaks render on real data — `__`
- [ ] Weekly report appears in Dashboard › Reports after a Monday 09:00 — `__`

---

## When you are done

Bring the filled checklist back (paste it or a summary). Each ✅ becomes a
ticked tracker row with your observed result as evidence; each ❌ becomes a
WP9.5 fix. The gate items (Phase 1 S1 especially) decide whether the cutover
proceeds — nothing is activated until you confirm those results.
