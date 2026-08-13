# Microsoft Edge Add-ons listing

This file contains the copy-ready listing fields and upload mapping for
FocusGate. The image assets are in `store-assets/edge/`.

## Description

Paste this into the Edge Add-ons **Description** field:

> FocusGate: Website Blocker & Focus Timer helps you protect your attention and
> build consistent deep-work habits. Create your own distraction rules, start a
> focus session, and let the extension enforce your intentions directly in the
> browser.
>
> **Block distracting websites:** Add websites such as social media, video,
> news, or gaming sites to your personal block list. During an active focus
> session, scheduled block, standalone block, or exhausted daily allowance,
> matching pages are redirected to a FocusGate block screen.
>
> **Filter distracting keywords:** Add keywords to hide matching content on
> supported sites, including YouTube, Google Search, Reddit, X/Twitter,
> Instagram, TikTok, and LinkedIn. This helps keep useful sites available
> while reducing distracting topics, feeds, and recommendations.
>
> **Use flexible focus controls:** Start timed work sessions, configure
> schedules, set daily allowances for selected websites, and add allow-list
> exceptions. Focus sessions support optional strict or commitment locks to
> add friction against impulsive changes. Standalone blocks can run for up to
> 1000 hours or with no time limit.
>
> **Review local progress:** FocusGate provides session history, focus time,
> daily usage, blocked-attempt counts, and a weekly digest notification so you
> can understand and improve your work habits.
>
> FocusGate is privacy-first. Settings, rules, focus history, usage data, and
> blocked-attempt domains remain in browser-local storage. Website and
> navigation data is processed locally to enforce your rules; FocusGate has no
> account system, advertising, analytics, or developer-controlled data server,
> and does not sell or transmit your browsing data.

## Logo

Upload:

- `store-assets/edge/focusgate-logo-300x300.png`
- Dimensions: **300 × 300 pixels**
- Aspect ratio: **1:1**

## Small promotional tile

Upload:

- `store-assets/edge/small-promotional-tile-440x280.png`
- Dimensions: **440 × 280 pixels**

## Screenshots

Upload these three screenshots. They are all **1280 × 800 pixels**, which is
one of Edge's accepted sizes:

1. `store-assets/screenshot-onboarding.png` — first-run setup and adding a
   blocked website
2. `store-assets/screenshot-popup.png` — focus timer and focus-mode controls
3. `store-assets/screenshot-blocked.png` — the blocked-page experience

The Edge form allows up to six screenshots; the three available screenshots
cover the primary user journey without duplicating views.

## Large promotional tile

Upload:

- `store-assets/edge/large-promotional-tile-1400x560.png`
- Dimensions: **1400 × 560 pixels**

## YouTube video URL

Leave blank unless a public product demonstration video has been published.
Do not use a private, unlisted-with-access-restrictions, or placeholder URL.

## Notes for certification

Paste this into the Edge Add-ons **Notes for certification** field:

> FocusGate is a productivity extension that helps users avoid distracting
> websites and content during focused work.
>
> To test the extension:
>
> 1. Install the extension and open the FocusGate popup. The first launch
> displays onboarding, where a tester can add a website to block.
> 2. Open the Rules tab to add or remove blocked websites and keywords.
> 3. Start a Focus Session from the timer screen. While the session is active,
> visit a blocked website. The page should be redirected to the local
> FocusGate blocked screen.
> 4. Add keywords and visit a supported site such as YouTube, Google Search,
> Reddit, X/Twitter, Instagram, TikTok, or LinkedIn. Matching visible content
> is hidden while focus mode is active.
> 5. Test Settings features, including scheduled blocking, standalone blocking,
> daily website allowances, allow-listed URLs, and optional strict or
> commitment locks.
> 6. Open the Stats tab to review locally stored focus sessions, blocked
> attempts, and usage summaries.
>
> No account, sign-in, payment, or external service is required. FocusGate does
> not use remote executable code, advertising, analytics, or a
> developer-controlled data server. Settings, rules, navigation domains needed
> for blocking, focus history, usage data, and statistics are stored locally in
> the browser. The extension processes URLs and visible page text locally only
> to enforce user-created rules and filter matching content. It does not
> transmit, sell, or share browsing data.
>
> The extension requires access across websites because users can choose any
> website to block and the keyword-filtering content script supports multiple
> sites. The requested permissions are used for local storage, tab and
> navigation monitoring, browser-level blocking, background timers, and local
> notifications.

## Search terms

Use these seven search terms, one per field:

1. `website blocker`
2. `focus timer`
3. `productivity`
4. `distraction blocker`
5. `keyword filter`
6. `deep work`
7. `time management`

Validation:

- 7 separate terms
- 13 total words across all terms
- Every term is under the 30-character limit
- The terms describe the extension's actual blocking and focus features

## Listing metadata

- **Name:** FocusGate: Website Blocker & Focus Timer
- **Category:** Productivity
- **Language:** English
- **Short description:** Block distracting websites and keywords, schedule focus time, and stay on task with a privacy-first focus timer.
- **Website:** Use the published documentation-site URL.
- **Privacy policy:** `<published-site-url>/privacy-policy.html`
- **Support page:** `<published-site-url>/support.html`
- **Source repository:** `https://github.com/TITANICBHAI/FocusFlow-Web`

## Submission notes

- The extension package to upload is `build/focusgate-edge.zip`.
- Upload the ZIP produced for the Edge/Chromium build, not the repository ZIP
  and not the `dist/` directory wrapped in another folder.
- Review the screenshots in the Edge upload form after upload because the
  store may apply its own preview crop.
- The logo and promotional tiles are listing artwork; they are not part of the
  extension ZIP.