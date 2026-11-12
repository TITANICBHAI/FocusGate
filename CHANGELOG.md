# Changelog

Notable changes to FocusGate are documented here.

## [1.0.1] - 2026-11-06

Focus sessions and schedules end on time again. The dashboard opens again. "Check a URL" no longer blanks the side panel. A crash now shows a message instead of a blank screen.

Changes you make to your site lists, keywords, schedules and daily limits now reach the blocker straight away instead of at the next alarm. The Alt+Shift+B shortcut blocks the site at once. When the browser starts, FocusGate ends sessions that ran out while it was closed and restores its alarms. A focus phase that has already ended no longer blocks sites or locks your rules.

Schedules now explain themselves. The Schedules screen says what is on now or what starts next, shows your whole week as a strip, and describes each schedule in plain words: which days, which hours and which sites it blocks. You can edit a schedule, pick what it blocks, and start from a Work hours, Study or Sleep template. A schedule that blocks nothing yet is flagged with a quick way to fix it. The block page now says which schedule blocked the site and when it ends.

The panel now says what it is doing. A strip under the header says what is on, such as "Strict focus session is on", "On a break" or "Nothing is blocking right now", with the end time and one button for the obvious next step, and the header badge shows a word (Not blocking, Blocking, Break) instead of a dot. The lock you choose is explained in plain words, in a note you can hide. When a lock stops you changing a rule, the message names the time it ends and the controls point to it. A new install opens the setup page. With no sites yet, the Focus tab offers an Add sites button.

The You tab now starts with your name and your own reason for focusing, then what you are protecting (tap a row to open that rule), today and this week, and what each achievement asks for. Tasks, reflection and habits sit in a collapsed Journal. The block page shows your reason in quotes. It no longer repeats the stock message, and it says "1 page blocked today" instead of "1 pages".

FocusGate has a new look. The icon has clean corners, colours are periwinkle with amber only where something is blocking right now, and labels are sentence case with a steadier number font. The side panel uses plain lists with a coloured bar instead of stacked boxes, and long site names and chips no longer overlap on a narrow panel. The dashboard Overview shows today at the top, a full-width week chart, and a side column with your schedules, limits and when protection was off. The block page puts the reason first, left-aligned, with Close tab as the main button. The status bar sweeps once when blocking starts. The About card shows the version.

Screen readers get a cleaner panel. Switches and segmented controls are announced once, in the way each one works, progress bars say what they measure, the tab bar is a proper tab list with the page title above it, and headings no longer skip a level. Settings has a Keyboard shortcuts card that shows the keys Chrome has set for FocusGate, says when one is not set, and has a Change in Chrome button. Every control shows a clear focus ring, including text fields. The side panel now fits narrow windows and 200% zoom without scrolling sideways.

One password now protects your rules. Type your own, 8 to 28 characters, or press Generate a password to get a random one of 20 to 28 characters, shown in a monospace type on one line so you can copy it or write it down. A random password leaves out look-alike characters such as 0, O, 1, I and l. FocusGate keeps only a scrambled copy and will not show the password again. Removing or loosening a site on your Always list, a keyword, a schedule or a daily limit asks for the password, and the Settings card lists everything the password covers. During a Strict or Commit session, or a Block now window, those rules stay locked even with the password. When you start a Strict session, FocusGate asks about the password first: use your saved password with one tap, set a new one, or start without one and stop early with the phrase "I GIVE UP" and a 15-second wait. If you have rules but no password, the Rules tab says so and offers a quick way to set one. A password you saved earlier still works, even a longer one, but a new one can be at most 28 characters.

The status strip now tells the truth about rules that are on all the time. When your Always list, keywords or daily limits are blocking, it says what, such as "Blocking 3 sites and 2 keywords", instead of "Nothing is blocking right now", and it scrolls with the page instead of staying over your content. The schedule form has an info button that explains "Only these sites" and "My Focus list", and the Weekdays, Weekends and Every day buttons are gone. Under Session lock the panel explains only the lock you chose, and an info button brings the note back after you hide it.

The first time you open the side panel, a card offers the full-screen setup, where there is more room. "Not now" hides it, and you can run setup again from the You tab. If setup generated a password for you, its last screen shows it once more so you can write it down. FocusGate also has more colour: lavender for the brand, notes and the options you choose, sand wherever something is blocking, mint on a break and rose for danger, with text kept readable on every tint in both themes.

Stopping a session early no longer counts toward your daily goal. The minutes still show in Focused today, and a line says how many ("20 min stopped early, not counted toward your goal."), but the goal ring, the goal percentage, the focus score and the Quiet Win achievement use only the time you finished. The stop dialog now says this before you confirm. The "Nothing is blocking right now" message can be hidden with its X, in the side panel and on the dashboard (Settings has a "Show hidden messages" button that brings back every tip and note you hid), and the side panel's settings button is now a box-with-an-arrow icon that opens Settings in full screen.

The end of a session now feels like something. A card at the top of the Focus tab says how long you focused ("25 min, done") with one line that is true of that session: you reached your daily goal, you are back after some days, it was your longest yet, you said no to 3 or more distractions, it was your 2nd session today, or how many minutes are left to your goal. Achievements you unlocked appear on the same card, and when a break starts it says how long the break is. The goal ring fills, and when a session takes you to your daily goal a mint "Daily goal reached" appears with a few dots rising once; with reduced motion on, the dots and the fill are left out. A soft chime plays when the card appears, once per session, in the open side panel only; turn it off in Settings under Notifications ("Soft chime when a session ends"). If you stop a session early the card is plain and neutral: "You focused for 12 minutes. Pick it up whenever you’re ready." The end-of-session notification now reads "Nice. 25 min done. Take 5."

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
