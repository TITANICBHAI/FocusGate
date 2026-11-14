// Single source of truth for the website: URLs, facts, FAQ and feature copy.
// build.mjs turns this into the HTML pages, JSON-LD, sitemap.xml, llms.txt and llms-full.txt,
// so a fact is written once and cannot drift between the page, the schema and the AI summary.
//
// Every claim here is taken from public/manifest.json, the README, CHANGELOG.md, the store
// listing kit (store-assets/marketplace/LISTING.md) or the source. Do not add user counts,
// ratings or "best" claims until they are true and you can show where they come from.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const manifest = JSON.parse(readFileSync(path.join(root, "public", "manifest.json"), "utf8"));

/** Public base URL of the published site (no trailing slash). Override with SITE_URL. */
export const SITE_URL = (process.env.SITE_URL || "https://titanicbhai.github.io/FocusGate").replace(/\/+$/, "");

/** Bump when the site content changes meaningfully; it feeds sitemap lastmod and JSON-LD dateModified. */
export const SITE_UPDATED = "2026-11-13";

export const VERSION = manifest.version;
export const NAME = "FocusGate";
export const FULL_NAME = manifest.name; // "FocusGate: Website Blocker & Focus Timer"
export const PUBLISHER = "TBTechs";
export const TAGLINE = "Website blocker and focus timer";

export const LINKS = {
  github: "https://github.com/TITANICBHAI/FocusGate",
  issues: "https://github.com/TITANICBHAI/FocusGate/issues",
  releases: "https://github.com/TITANICBHAI/FocusGate/releases/latest",
  chromeZip: "https://github.com/TITANICBHAI/FocusGate/releases/latest/download/focusgate-chrome.zip",
  firefox: "https://addons.mozilla.org/en-US/firefox/addon/focusgate-web/",
  edge: "https://microsoftedge.microsoft.com/addons/detail/mmjhejklaaljidnmabjiloceniacihkk",
  license: "https://github.com/TITANICBHAI/FocusGate/blob/main/LICENSE",
};

export const MIN = { chrome: manifest.minimum_chrome_version, firefox: "140", firefoxAndroid: "142" };

export const SHORT_DESCRIPTION =
  "Free, open-source website blocker and focus timer for Chrome, Edge and Firefox. Block distracting sites and keywords, set schedules and daily limits. No account; your data stays in your browser.";

export const KEYWORDS = [
  "website blocker",
  "focus timer",
  "block distracting websites",
  "site blocker",
  "distraction blocker",
  "productivity extension",
  "pomodoro",
  "browser extension",
  "block websites",
  "study timer",
];

/** Pages in the site. `file` is relative to docs/. */
export const PAGES = {
  home: { file: "index.html", nav: "Home" },
  install: { file: "install.html", nav: "Install" },
  features: { file: "features.html", nav: "Features" },
  faq: { file: "faq.html", nav: "FAQ" },
  support: { file: "support.html", nav: "Support" },
  privacy: { file: "privacy-policy.html", nav: "Privacy" },
  terms: { file: "terms-of-service.html", nav: "Terms" },
};

/** One row per fact; used in the home page table, SoftwareApplication schema and llms-full.txt. */
export const FACTS = [
  ["What it is", "A browser extension that blocks websites and keywords and runs a focus timer"],
  ["Price", "Free. No ads and no account"],
  ["Licence", "MIT, open source"],
  ["Publisher", PUBLISHER],
  ["Current version", VERSION],
  ["Browsers", `Chrome ${MIN.chrome}+, Microsoft Edge, Firefox ${MIN.firefox}+ (Firefox for Android ${MIN.firefoxAndroid}+)`],
  ["Where to get it", "Firefox Add-ons, Microsoft Edge Add-ons, and GitHub Releases for Chrome"],
  ["Your data", "Stored in your browser. No server, no analytics, nothing sent anywhere"],
  ["Shortcuts", "Alt+Shift+F starts or stops a focus session; Alt+Shift+B blocks the current site"],
];

const BR = (t) => t; // marks a string as intentional HTML

/** FAQ: answers are short HTML. The plain-text form is derived for FAQPage JSON-LD and llms-full.txt. */
export const FAQ = [
  {
    q: "What is FocusGate?",
    a: BR(`FocusGate is a free, open-source website blocker and focus timer for Chrome, Edge and Firefox. It blocks the sites and keywords you choose during focus sessions, on schedules or all day, lets you set daily limits, and shows how much focused time you really get.`),
  },
  {
    q: "Is FocusGate free?",
    a: BR(`Yes. FocusGate is free and open source under the MIT licence. It has no ads and no account.`),
  },
  {
    q: "Is FocusGate on the Chrome Web Store?",
    a: BR(`No. FocusGate is not on the Chrome Web Store. On Chrome you install it from the GitHub release in about a minute: download <code>focusgate-chrome.zip</code>, extract it, and load it with <strong>Load unpacked</strong>. The <a href="install.html#chrome">step-by-step Chrome guide</a> has the details. On Firefox and Edge you install it from their official add-on stores.`),
  },
  {
    q: "How do I install FocusGate on Firefox or Edge?",
    a: BR(`Open the <a href="${LINKS.firefox}">Firefox Add-ons page</a> or the <a href="${LINKS.edge}">Microsoft Edge Add-ons page</a> and choose to add it. The store updates it for you.`),
  },
  {
    q: "Does FocusGate collect or send my data?",
    a: BR(`No. Your rules, history and settings are stored in your browser. FocusGate has no server, no analytics and no ads, and it does not upload page contents or your browsing. The Firefox build declares that it collects no data. You can read the <a href="privacy-policy.html">privacy policy</a> or the source code to check.`),
  },
  {
    q: "Why does FocusGate need access to all websites?",
    a: BR(`So your rules can apply to any site you add. FocusGate reads page addresses on your device to apply your rules, and nothing is sent anywhere. On Firefox, site access is a separate switch: if blocking does not work after you install, open the FocusGate entry in the Add-ons manager and allow access to all websites.`),
  },
  {
    q: "Can I block a site only during certain hours?",
    a: BR(`Yes. Schedules block your chosen sites on the days and hours you pick, including overnight. There are Work hours, Study and Sleep templates, and the Schedules screen shows what is on now, what starts next and your whole week.`),
  },
  {
    q: "What is Block now?",
    a: BR(`Block now is a timed block with no early stop. Pick the sites and an end time (from 5 minutes up to 30 days, up to 500 sites) and they stay blocked until it ends. It never uses your password. While it runs, nothing can be removed or loosened, content filters cannot be turned off, the password cannot be changed or removed, and your data cannot be reset.`),
  },
  {
    q: "What do Strict and Commit session locks do?",
    a: BR(`They keep you honest during a focus session. <strong>Strict</strong> needs your password to stop early; if you have not set one, you stop with the phrase "I GIVE UP" and a 15-second wait. <strong>Commit</strong> has no early stop at all. <strong>None</strong> lets you stop any time.`),
  },
  {
    q: "Can I get around a block by turning FocusGate off?",
    a: BR(`A lock slows you down; it does not make removal impossible. Someone with access to your browser can still disable or remove the extension, and browser updates or site changes can occasionally affect blocking. If you need a firmer barrier, use Block now or a Commit session.`),
  },
  {
    q: "What are content filters, and why are they Beta?",
    a: BR(`Content filters hide parts of a page, such as YouTube Shorts, the YouTube home feed, suggested videos and comments, Instagram Reels and Explore, X trends, the TikTok feed and the LinkedIn feed, plus posts that contain your hide words. They are marked Beta because they depend on each site's page layout, which can change without notice. They are all off by default.`),
  },
  {
    q: "Does FocusGate work on Firefox for Android?",
    a: BR(`It is built to run on Firefox for Android ${MIN.firefoxAndroid} and later. Android has no sidebar, so the toolbar button opens FocusGate in a tab, and features Android lacks, such as keyboard shortcuts, notifications and idle detection, are skipped.`),
  },
  {
    q: "What keyboard shortcuts does FocusGate have?",
    a: BR(`<kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>F</kbd> starts or stops a focus session and <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>B</kbd> blocks the site you are on. You can change both in your browser's shortcut settings.`),
  },
  {
    q: "How do I back up or move my FocusGate data?",
    a: BR(`In Settings you can export a backup and import it again. On Chrome with an unpacked install, the extension's data belongs to the folder it was loaded from, so export a backup before you move the folder or load it from a new place.`),
  },
  {
    q: "Where is the source code, and how do I report a bug?",
    a: BR(`The code is on <a href="${LINKS.github}">GitHub</a>. To report a problem, <a href="${LINKS.issues}">open an issue</a> with your browser and version, the FocusGate version and the steps to reproduce it. Please leave out private browsing history. The <a href="support.html">support page</a> lists what to check first.`),
  },
];

export const stripTags = (html) =>
  html
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

/** Headline features used on the home page and in the feature list schema. */
export const FEATURE_LIST = [
  "Block distracting websites during focus sessions, on schedules or all day",
  "Block or hide keywords",
  "Schedules for work hours, study time or sleep, including overnight",
  "Daily time and page-open limits per site",
  "Focus timer in the side panel (sidebar in Firefox) with session locks: None, Strict, Commit",
  "Block now: a timed block with no early stop that never uses your password",
  "Progress: daily goal, streaks, focus score, weekly reports, habits and achievements",
  "Content filters for YouTube, Instagram, X, TikTok and LinkedIn (Beta, off by default)",
  "Light and dark themes, keyboard and screen-reader friendly",
  "Export and import a backup; all data stays in your browser",
];

/** Screenshots used on the site. dims are the real file sizes. */
export const SHOTS = {
  panelFocus: { base: "panel-focus", w: 400, h: 700, alt: "FocusGate side panel on the Focus tab with a focus session ready to start" },
  panelSession: { base: "panel-session", w: 400, h: 700, alt: "FocusGate side panel showing a running focus session with its end time and blocked sites" },
  panelRules: { base: "panel-rules", w: 400, h: 700, alt: "FocusGate side panel on the Rules tab listing blocked sites, keywords and schedules" },
  panelYou: { base: "panel-you", w: 400, h: 700, alt: "FocusGate side panel on the You tab with your reason for focusing, today's progress and achievements" },
  dashOverview: { base: "dash-overview", w: 1200, h: 769, alt: "FocusGate dashboard overview with today's focus time, a week chart, schedules and limits" },
  dashRules: { base: "dash-rules", w: 1200, h: 769, alt: "FocusGate dashboard Rules page with sites, keywords, schedules and daily limits" },
  blocked: { base: "blocked", w: 559, h: 543, alt: "FocusGate block page showing your own reason for focusing, the time left and a Close tab button" },
};
