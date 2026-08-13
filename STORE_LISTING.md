# FocusGate: Website Blocker & Focus Timer store listing package

This file is the ready-to-copy listing and disclosure text for the Chrome Web
Store, Microsoft Edge Add-ons, and Firefox Add-ons. Store accounts, pricing,
publisher identity verification, screenshots, and final submission remain
account-owner actions in each store dashboard.

## Listing details

- **Name:** FocusGate: Website Blocker & Focus Timer
- **Short description:** Block social media, video, news, and keywords with a privacy-first website blocker and focus timer.
- **Category:** Productivity
- **Language:** English
- **Website:** Publish the `docs/` site and use its public URL.
- **Privacy policy:** `<published-site-url>/privacy-policy.html`
- **Support page:** `<published-site-url>/support.html`
- **Source/support repository:** https://github.com/TITANICBHAI/FocusGate
- **License:** MIT

## Detailed description

FocusGate: Website Blocker & Focus Timer is a privacy-first browser extension
for Chrome, Edge, and Firefox. Use it as a social media blocker, website
blocker, keyword blocker, and focus timer: block distracting sites, hide
unwanted topics, schedule deep-work time, and review local progress without an
account.

### What can FocusGate block?

- **Websites:** Block social media, video, news, gaming, shopping, or any
  distracting website with a personal block list.
- **Keywords:** Hide matching content on supported sites without blocking the
  entire website. Supported sites include YouTube, Google Search, Reddit,
  X/Twitter, Instagram, TikTok, and LinkedIn.
- **Routes and feeds:** Redirect matching pages to a local FocusGate block
  screen while an active rule, session, schedule, or allowance restriction is
  in effect.

### How does FocusGate support deep work?

- **Focus timer:** Start a timed work session and optionally add strict or
  commitment locks to make impulsive changes harder.
- **Scheduled website blocking:** Automatically enforce website and keyword
  rules during work hours, evenings, or recurring routines.
- **Standalone focus mode:** Block without starting a focus timer for any
  duration up to 1000 hours, or choose no limit. Timed blocks use an absolute
  end time and continue across browser restarts and computer shutdowns.
- **Daily website limits:** Give selected websites a limited amount of
  guilt-free time each day.

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