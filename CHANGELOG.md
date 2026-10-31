# Changelog

Notable changes to FocusGate are documented here.

## [1.1.0] - 2026-10-31

The 1.1.0 release replaces the original (v1) runtime with the v2
implementation. On first run after updating, existing v1 settings and history
are migrated automatically and a rollback copy (`backup_v1`) is stored before
any legacy key is removed.

### Added

- **Block rules:** Always-blocked list (24/7 blocking separate from focus
  rules), alias groups (x.com/twitter.com/t.co share one entry), URL
  exceptions with boundary matching, editable schedules with overnight and
  24:00 windows, and a Check-a-URL verdict tool in Rules.
- **Block now (standalone):** a timed block with its own site list, an
  absolute 5-minute-to-30-day expiry, live countdown, extend/add-only while
  active, and no early-stop path.
- **Allowances:** daily limits in three modes (minutes per day, page opens per
  day, minutes per interval) with an attention-based ledger, per-entry
  "also allow during blocks" switch, usage display, and heads-up/exhaustion
  notifications.
- **Tasks:** date/time windows, priorities, tags, recurrence (daily/weekdays/
  weekly), per-task allow-only mode, pre-start/at-start/mid-session/end
  reminders with a Start-now action, and task-linked sessions.
- **Statistics:** dashboard with Today/Week/Month ranges, KPI cards, an
  inline SVG focus chart, daily goal and focus score, streaks, insights, top
  blocked domains, and protection gaps; popup mini stats; weekly reports
  stored for the last eight weeks.
- **Motivation:** achievements, daily mood/note reflection, and habit
  check-ins with per-habit streaks on the dashboard.
- **Block page:** real verdict and reason, countdown only where a session or
  standalone block applies, live block counter, and working close/open-tab
  actions.
- **Security and data:** PBKDF2-SHA256 password with legacy-hash upgrade,
  protection status card (incognito, host access, notifications, heartbeat,
  rule count, gaps), backup export/import with merge policy, and reset
  refused during locks.
- **Shortcuts:** Alt+Shift+F toggles a focus session; Alt+Shift+B blocks the
  current site.

### Changed

- **Runtime:** the v2 service worker, UI pages, and content script replaced
  the v1 popup, worker, and content script; the storage schema migrated to
  v2 (durations in milliseconds, local date keys) with a rollback backup.
- **Lock levels:** Strict uses a password (or the "I GIVE UP" phrase with a
  15-second wait) enforced in the background; Commitment has no early stop.
  The fullscreen-style claim from v1 was removed.
- **Allowances:** the v1 "Wait"/cooldown behavior was replaced by the three
  ledger modes above; per-day budgets reset at local midnight.
- **Keyword rules:** split into Block/Hide/Both modes with an "during blocks
  vs always" scope, whole-word matching, and a match log.
- **Permissions:** added `idle` (attention sampling) to the previous set; no
  network-call or analytics APIs were added.
- **Password policy:** custom passwords of 8–64 characters (v1 required
  20–28), with a generated 20–28-character option.

### Removed

- The v1 popup, worker, and content script; the v1 "No limit" standalone
  option (use the Always-blocked list for permanent blocking); the v1
  cooldown/"Wait" allowance mode; and the fullscreen-enforcement claim.

### Fixed

- Blocked-page URL preservation across typed URLs, links, redirects, and
  history restores; duplicate block-attempt logging; worker-restart alarm
  handling; and clock-jump session recovery (forward jumps record gaps,
  backward jumps extend the phase and flag the record).
