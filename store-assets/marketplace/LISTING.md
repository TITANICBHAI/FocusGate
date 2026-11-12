# FocusGate store kit for Edge Add-ons and Firefox Add-ons (v1.0.2)

Copy-ready text, written so the first words of every field carry the search terms people use ("website blocker", "focus timer", "block distracting websites", "productivity"). Everything below describes what FocusGate 1.0.2 does. Do not add user counts, ratings or "best" claims until they are true and you can show where they come from.

Files in this folder:

| File | Use |
|---|---|
| `screenshots/01` to `06` (1280 x 800 PNG) | Store screenshots, in this order. Edge accepts 1280 x 800 or 640 x 400, up to 10. Firefox takes any size, 1280 x 800 is fine. |
| `promo-tile-440x280.png` | Edge small promotional tile. |
| `icon-128.png` | Store icon (Edge asks for 128 x 128; Firefox uses the manifest icon). |
| `raw/` | Unframed light and dark screenshots of the panel, dashboard, block page and setup, if you want to make other crops. |

The screenshots show demo data (the name "Asha", the reason "Finish the thesis draft by Friday", reddit.com and similar sites). They were captured from the real built pages in headless Chromium with sample settings, not from a signed-in browser.

## Name

**FocusGate: Website Blocker & Focus Timer** (40 characters)

## Short description (Edge allows 132 characters)

Block distracting websites and keywords with a focus timer, schedules and daily limits. Your data stays in your browser. (120)

## Summary for Firefox (250 characters)

Website blocker and focus timer. Block distracting sites and keywords during focus sessions, on schedules, or all day. Set daily limits, lock a session so you stay on task, and see your progress. No account, no ads, and your data stays in your browser. (249)

## Search terms (Edge: up to 7)

website blocker, focus timer, block websites, productivity, pomodoro, site blocker, distraction blocker

## Firefox tags and category

Category: Productivity. Tags: productivity, website blocker, focus, timer, study, time management.

## Description (works for both stores)

**FocusGate is a website blocker and focus timer for people who want to get work done.** Block distracting websites and keywords while you focus, on a schedule, or all day, and see how much focused time you really get.

### Block what pulls you away
- **Websites:** a focus list for sessions and schedules, plus an always-blocked list that works 24/7. Related addresses such as x.com and twitter.com share one entry.
- **Keywords:** block searches and pages that match, or hide matches on supported pages such as YouTube and Google Search.
- **Schedules:** work hours, study time or sleep, with templates, any days and any hours, including overnight.
- **Daily limits:** give a site a time or page-open budget and it blocks when the budget is used up.

### Focus on purpose
- **Focus timer in your side panel.** Start a session in one click, extend it, or stop it. A card tells you what was on, when it ends and what is blocked.
- **Session locks.** Choose None, Strict (needs your password to stop early) or Commit (no early stop) when you want your future self kept honest.
- **A block page that remembers why.** It shows your own reason, how long is left and a Close tab button.
- **A daily goal that counts.** Sessions you stop early are shown, but only finished time counts toward your goal, streak and achievements.
- **A calm finish.** A done card, a soft chime (you can turn it off) and a short message when you reach your goal.

### See your progress
Today, week and month views, focus score, streaks, pages blocked, the sites that tried hardest to distract you, weekly reports, daily mood notes, habits and achievements.

### Made to be easy to use
A redesigned interface in light and dark, built for keyboard and screen-reader use. A guided setup. One password protects your rules. Keyboard shortcuts: Alt+Shift+F starts or stops a focus session and Alt+Shift+B blocks the current site (you can change them in your browser).

### Your data stays with you
No account, no ads, no analytics and no remote servers. Your rules, history and settings are stored in your browser, and you can export or import a backup. FocusGate keeps only a scrambled copy of your password.

### Good to know
- FocusGate needs access to the sites you browse so it can block them. It reads page addresses only to apply your rules.
- A lock slows you down, it does not make removal impossible: someone with access to your browser can still disable or remove the extension.
- On Firefox for Android the toolbar button opens FocusGate in a tab, and desktop-only features such as keyboard shortcuts are skipped.

## What's new in 1.0.2 (release notes field)

FocusGate has a new look: a redone side panel, dashboard, block page and setup, in light and dark. New: a done card and goal moment when a session ends, a password that protects your rules, schedules that explain themselves, a status strip that says what is blocking, a friendlier "Nothing is blocking" message you can hide, and a Firefox version. Fixed: screen readers now read the week chart as a list of days.

## Screenshot captions (in order)

1. See your focus at a glance
2. Start a focus session in one click
3. A calm stop, with your own reason
4. Block sites, keywords and schedules
5. Light and dark, easy on the eyes
6. Your goal, your rules, your pace

## Permission justifications (for the review forms)

| Permission | Why |
|---|---|
| `storage` | Saves your rules, settings and history in your browser. |
| `tabs`, `webNavigation` | Sees which page is opening so a blocked address can be replaced by the block page, and which tab is in use for daily limits. |
| `declarativeNetRequest` | Blocks and redirects the sites you chose without reading page content. |
| `alarms` | Ends sessions and starts schedules on time. |
| `notifications` | Tells you when a session ends or a daily limit is close. |
| `idle` | Stops counting time toward limits when you step away. |
| `sidePanel` (Chrome and Edge) | Shows the timer in the side panel. Firefox uses its sidebar instead. |
| Site access (`<all_urls>`) | Lets rules apply to any site you add. Page addresses are used on your device only and are never sent anywhere. |

## Notes for each store

- **Edge:** upload `build/focusgate-edge.zip`. Use the same text. Pick the Productivity category.
- **Firefox:** upload `build/focusgate-firefox.zip`. It needs a source-code submission only if you ship minified or generated code; if asked, point to the GitHub repository and `npm run build:extension`. The Firefox build has not been tested in a real Firefox yet, so test it first (see the README) before you publish.
