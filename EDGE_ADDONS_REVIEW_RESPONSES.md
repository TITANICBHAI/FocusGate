# Microsoft Edge Add-ons review responses (reverified)

Prepared for FocusGate version 1.0.0 and reverified August 11, 2026. These
answers are based on the current extension manifest and source files in
`public/manifest.json`, `public/background.js`, and `public/content.js`.

## Re-verification summary

- `storage` is used for settings, blocked lists, schedules, allowances,
  session history, cooldowns, and local blocked-attempt statistics.
- `tabs` is used to inspect open tab URLs, track configured allowances, and
  redirect tabs that become blocked.
- `webNavigation` and `tabs.onUpdated` enforce blocks on normal and
  single-page-app navigations.
- `alarms` runs the allowance tracker, temporary-mode expiry, and weekly
  digest.
- `declarativeNetRequest` creates local redirect and allow rules for the
  user's settings.
- `notifications` displays the locally calculated weekly digest.
- The content script is declared for `<all_urls>` and, during an active focus
  mode, reads displayed text on supported sites to hide matching content.
- The submitted extension code contains no `fetch`, `XMLHttpRequest`,
  `WebSocket`, `eval`, `new Function`, or remotely loaded executable script.
- No extension code sends settings, URLs, domains, page text, or statistics to
  a developer-controlled server.

## Single purpose description

### Paste into “Single purpose description”

FocusGate has one purpose: to help users maintain focused work by locally
blocking user-selected distracting websites and filtering user-selected
keywords during active focus sessions, scheduled blocks, standalone mode, and
daily allowances. It applies the user's rules in the browser, redirects
matching pages to a FocusGate screen, hides matching content on supported
sites, and provides local focus timers and summaries. It does not provide
unrelated features, use data for advertising, or transmit browsing data to a
server.

### Justification

Every feature supports the same narrow purpose: helping the user avoid chosen
online distractions while working. The timer, schedules, allowances,
keyword filtering, block screen, and local statistics are enforcement or
feedback mechanisms for that purpose, not separate products or unrelated
functionality.

## Permission justifications

Each response below is written to fit the corresponding Edge Add-ons form
field and is under the 1,000-character limit.

### `storage` justification

FocusGate uses `storage` to save the user's settings on the device, including
blocked websites, blocked keywords, allow-listed URLs, schedules, daily
allowances, focus-session state and history, cooldowns, and local focus
statistics. The background service worker and popup need to share these
settings so the user's rules continue to work across tabs and browser
restarts. The extension does not send this stored information to a remote
server.

### `tabs` justification

FocusGate uses `tabs` to check the URLs of open tabs when the user changes a
blocking rule or when a daily allowance is reached. It also checks open tabs
once per minute to measure locally configured site allowances and redirects a
tab that is already open when it becomes blocked. This permission is used only
to enforce the user's own blocking settings; tab URLs are processed locally and
are not uploaded.

### `webNavigation` justification

FocusGate uses `webNavigation` to enforce blocking when a top-level page
commits a navigation and when a single-page application changes its route
without a full page load. It compares the navigated URL with the user's
blocked-site, blocked-keyword, schedule, and allowance rules, then redirects a
matching navigation to the local FocusGate block screen. It does not transmit
navigation data.

### `alarms` justification

FocusGate uses `alarms` for background timing that supports its focus
functionality: updating daily site-allowance usage every minute, expiring
temporary standalone mode, and generating a weekly local focus summary. These
timers allow the rules and summaries to work while the popup is closed. Alarm
processing uses locally stored settings and statistics only.

### `declarativeNetRequest` justification

FocusGate uses `declarativeNetRequest` to create and update browser-level
rules for the user's blocked sites and allow-listed URLs. While a focus session,
schedule, standalone mode, or exhausted allowance is active, matching
top-level site navigations are redirected to the extension's local block
screen. The rules are generated on the device from the user's settings; URLs
are not sent to a server.

### `notifications` justification

FocusGate uses `notifications` to show the user a local weekly focus digest
when its scheduled summary is ready. The notification reports locally
calculated completed sessions, focus time, and blocked distraction attempts.
It is a productivity feedback notification, not advertising, and its content
is generated from data stored on the user's device.

### Host permission (`<all_urls>`) justification

FocusGate supports user-selected blocking rules on any website, so it needs
host access across URLs rather than access to a fixed list of domains. The
background service worker uses this access to inspect matching navigation URLs
and redirect blocked pages. Its content script uses the access to read visible
text on supported sites during an active focus mode and hide elements matching
the user's keywords. Page content and browsing data are processed locally and
are not uploaded or sold.

## Remote code

### Paste into “Are you using remote code?”

**No.**

### Justification

The extension's executable UI, background service worker, and content script
are bundled into the submitted package. FocusGate does not download or execute
JavaScript, WebAssembly, or other executable code from a remote server, and it
does not use `eval`, `new Function`, or a remotely hosted extension script.
External links in the UI are ordinary links and are not executable extension
code. The public documentation site's presentation dependencies are separate
from the submitted extension package.

## Data usage selections

The recommended selections for the two supplied Edge “Data usage” screens are:

| Edge data category | Select? | Why |
| --- | --- | --- |
| Personally identifiable information | No | FocusGate has no account, identity, contact, or profile collection. |
| Health information | No | The extension does not request or process health data. |
| Financial and payment information | No | The extension has no payments, purchases, or financial features. |
| Authentication information | No | It does not request passwords, credentials, tokens, or PINs. |
| Personal communications | No | It does not read or store email, messages, or chats. |
| Location | No | It does not request or use GPS, IP-based location, or nearby-device information. |
| Web history | **Yes** | It locally processes tab/navigation URLs and stores the domains of blocked attempts so user-created blocking rules and local statistics work. It does not transmit this data. |
| User activity | **Yes** | It locally stores focus-session history, daily allowance usage, and blocked-attempt counts to provide the user's focus timer and statistics. It does not record general clicks, keystrokes, mouse movement, or unrelated activity. |
| Website content | **Yes** | During an active focus mode, the content script reads visible titles, captions, posts, and other displayed text on supported sites to hide content matching the user's keywords. It does not upload, retain, or sell the page text. |

### Data-use disclosure justification

The three selected categories are the transparent disclosures for the data
FocusGate handles locally to provide its blocking and focus features. The
extension does not transmit this information to the developer or any
third-party service, does not sell it, does not use it for advertising, and
does not run analytics. If the Edge submission UI separately defines
“collect” as data transmitted off the device, that definition should control
the checkbox choice; in that case, the three locally handled categories are
not remote collection. The permission and host-access explanations above
remain accurate either way.