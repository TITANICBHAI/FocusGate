# FocusGate store listing package

This file is the ready-to-copy listing and disclosure text for the Chrome Web
Store, Microsoft Edge Add-ons, and Firefox Add-ons. Store accounts, pricing,
publisher identity verification, screenshots, and final submission remain
account-owner actions in each store dashboard.

## Listing details

- **Name:** FocusGate
- **Short description:** Block distracting websites and commit to focused work sessions.
- **Category:** Productivity
- **Language:** English
- **Website:** Publish the `docs/` site and use its public URL.
- **Privacy policy:** `<published-site-url>/privacy-policy.html`
- **Support page:** `<published-site-url>/support.html`
- **Source/support repository:** https://github.com/TITANICBHAI/FocusGate
- **License:** MIT

## Detailed description

FocusGate helps you protect your attention while you work. Create blocked-site
and keyword rules, start a focus session, set schedules and daily allowances,
lock settings with a deliberate commitment, and review local focus statistics.

FocusGate is privacy-first by design. Settings, blocked lists, schedules,
session history, and focus statistics are stored in browser-local storage. The
extension does not include analytics, advertising, accounts, or a remote
database, and does not sell or transmit browsing history.

## Permission justifications

### Extension permissions

- **`storage`** — Saves FocusGate settings, blocked lists, schedules, focus
  sessions, allowances, and local statistics on the device.
- **`tabs`** — Checks open tab URLs when rules change and redirects tabs that
  match an active blocking rule.
- **`webNavigation`** — Detects committed navigations and history-state changes
  so an active block can be enforced when a page or route changes.
- **`alarms`** — Runs the background expiry timer for temporary focus modes.
- **`declarativeNetRequest`** — Applies the user's blocking and allow-list rules
  at the browser network layer without sending URLs to a server.
- **`notifications`** — Shows local reminders when a focus session or scheduled
  event needs the user's attention.

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