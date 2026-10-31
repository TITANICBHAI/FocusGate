# FocusGate: Website Blocker & Focus Timer store listing package

This file is the ready-to-copy listing and disclosure text for the Chrome Web
Store, Microsoft Edge Add-ons, and Firefox Add-ons. Store accounts, pricing,
publisher identity verification, screenshots, and final submission remain
account-owner actions in each store dashboard.

## Listing details

- **Name:** FocusGate: Website Blocker & Focus Timer
- **Short description:** Block distracting websites and keywords with a focus timer, schedules and daily limits. Your data stays in your browser.
- **Category:** Productivity
- **Language:** English
- **Website:** Publish the `docs/` site and use its public URL.
- **Privacy policy:** `<published-site-url>/privacy-policy.html`
- **Support page:** `<published-site-url>/support.html`
- **Source/support repository:** https://github.com/TITANICBHAI/FocusGate
- **License:** MIT

## Detailed description

FocusGate: Website Blocker & Focus Timer is a browser extension for Chrome,
Edge, and Firefox. Block distracting websites and keywords with a focus timer,
schedules, and daily limits. Your rules and usage data stay in your browser.

### What can FocusGate block?

- **Websites:** Add domains to your focus rules or permanent-block list.
  Focus rules apply during focus sessions and schedules; embedded content on
  other sites is not affected.
- **Keywords:** Choose Block, Hide, or Both. Block rules match searches and page
  addresses; Hide applies on supported pages, including YouTube and Google
  Search.
- **Schedules:** Choose the days and hours when site and keyword rules apply.
- **Daily limits:** Set a daily time or page-open cap, or a repeating time
  window. A site is blocked when its budget is used until the limit resets.

### What can FocusGate block?

- **Websites:** Add domains to your focus rules or your permanent 24/7 block
  list, with alias groups (x.com and twitter.com share one entry) and URL
  exceptions for single pages. Focus rules apply during focus sessions and
  schedules; embedded content on other sites is not affected.
- **Keywords:** Choose Block, Hide, or Both, with optional whole-word
  matching. Block rules match searches and page addresses; Hide applies on
  supported pages, including YouTube and Google Search. A match log shows the
  last 50 hits.
- **Schedules:** Choose the days and hours when site and keyword rules apply,
  including overnight and 24:00 windows. Each schedule can have its own list.
- **Daily limits:** Set a daily time or page-open cap, or a repeating time
  window. A site is blocked when its budget is used until the limit resets,
  with a heads-up notification before that happens.

### How does FocusGate support deep work?

- **Focus timer:** Start a timed work session. Strict sessions require a
  password or typed confirmation to end early; Commitment sessions have no
  early-stop action. Either lock can be bypassed by disabling or removing the
  extension.
- **Block now:** Start a timed block with its own site list that ends
  automatically (5 minutes to 30 days). While it runs you can extend it or add
  sites, but nothing can end it early.
- **Tasks and reminders:** Plan tasks with dates, durations, priorities, and
  repetition. FocusGate reminds you before a task starts and can start the
  session for you. Tasks can also run in an allow-only mode that blocks
  everything except the domains you choose.
- **Stats and reports:** A dashboard with Today/Week/Month totals, a daily
  goal, focus score, streaks, insights, and weekly reports — computed on your
  device from your sessions.
- **Habits and reflection:** Daily habit check-ins with streaks and an
  optional end-of-day mood and note, plus achievements for clean sessions and
  focus streaks.

### Can I use FocusGate without an account?

Yes. FocusGate stores settings, blocked lists, schedules, session history,
usage, and focus statistics in browser-local storage. The extension has no
analytics, advertising, account system, or remote database.

### Does FocusGate collect browsing history?

No. FocusGate processes only the URLs and visible page text needed to enforce
user-created rules in the browser. Browsing activity is not transmitted or
sold.

## Permission justifications

### Extension permissions

- **`storage`** — Saves FocusGate settings, blocked lists, schedules, focus
  sessions, allowances, and local statistics on the device.
- **`tabs`** — Checks open tab URLs when rules change and redirects tabs that
  match an active blocking rule.
- **`webNavigation`** — Detects committed navigations and history-state changes
  so an active block can be enforced when a page or route changes.
- **`alarms`** — Runs the background timers for focus sessions, temporary
  blocks, task reminders, weekly reports, and daily limit resets.
- **`declarativeNetRequest`** — Applies the user's blocking and allow-list rules
  at the browser network layer without sending URLs to a server.
- **`idle`** — Detects when the user is away so that unfocused time is not
  counted against daily allowance budgets.
- **`notifications`** — Shows local reminders when a focus session, task,
  allowance budget, or weekly report needs the user's attention.

### Host access

- **`<all_urls>`** — FocusGate must inspect and redirect matching pages across
  websites selected by the user. The extension does not upload page contents,
  browsing history, or URL data.

### Data disclosures

- **Personally identifiable information:** Not collected.
- **Health or financial information:** Not collected.
- **Authentication information:** Not collected.
- **Browsing activity:** Used locally to enforce user-created blocking rules;
  not transmitted or sold.
- **User activity:** Focus sessions and statistics are stored locally; not
  transmitted or sold.
- **Data sold to third parties:** No.
- **Data used for advertising:** No.

## Store assets

The build produces:

- `build/focusgate-chrome.zip` — Chrome Web Store package.
- `build/focusgate-edge.zip` — Edge Add-ons package.
- `build/focusgate-firefox.zip` — Firefox Add-ons package with Gecko metadata.
- `store-assets/icon-128.png` — Store icon.
- `store-assets/screenshot-popup.png`
- `store-assets/screenshot-onboarding.png`
- `store-assets/screenshot-blocked.png`

Screenshots are generated from the built extension UI. Review them once in the
store upload form and replace them with updated captures if the listing
dimensions or store crop rules change.