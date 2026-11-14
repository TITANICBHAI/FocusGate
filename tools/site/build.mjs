// Generates the static website in docs/ (HTML pages, sitemap.xml, robots.txt, llms.txt, llms-full.txt).
//   npm run site:build
// No runtime JavaScript and no CDN: the pages are plain HTML + docs/assets/site.css, which reuses the
// extension's design tokens so the site and the product look the same.

import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  FACTS, FAQ, FEATURE_LIST, FULL_NAME, KEYWORDS, LINKS, MIN, NAME, PAGES, PUBLISHER, SHORT_DESCRIPTION,
  SHOTS, SITE_UPDATED, SITE_URL, TAGLINE, VERSION, stripTags,
} from "./data.mjs";

// SITE_OUT lets a test build into a temporary folder and compare it with docs/.
const docs = process.env.SITE_OUT
  ? path.resolve(process.env.SITE_OUT)
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "docs");
mkdirSync(docs, { recursive: true });

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const abs = (file) => (file === "index.html" ? `${SITE_URL}/` : `${SITE_URL}/${file}`);
const asset = (p) => `${SITE_URL}/assets/${p}`;
const ld = (graph) =>
  `<script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", "@graph": graph }).replace(/</g, "\\u003c")}</script>`;

// ---------- images ----------
function pic(shot, { eager = false, className = "" } = {}) {
  const s = SHOTS[shot];
  const src = (mode) => `assets/img/${s.base}-${mode}.webp`;
  return `<picture><source media="(prefers-color-scheme: dark)" srcset="${src("dark")}"><img${className ? ` class="${className}"` : ""} src="${src("light")}" width="${s.w}" height="${s.h}" alt="${esc(s.alt)}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async"></picture>`;
}
const shotFig = (shot, caption, { eager = false, narrow = false } = {}) =>
  `<figure class="shot${narrow ? " shot--narrow" : ""}">${pic(shot, { eager })}${caption ? `<figcaption>${caption}</figcaption>` : ""}</figure>`;

// ---------- JSON-LD nodes ----------
const ORG = {
  "@type": "Organization", "@id": `${SITE_URL}/#org`, name: PUBLISHER, url: `${SITE_URL}/`,
  logo: { "@type": "ImageObject", url: asset("icon-512.png"), width: 512, height: 512 },
  sameAs: [LINKS.github],
};
const WEBSITE = {
  "@type": "WebSite", "@id": `${SITE_URL}/#website`, url: `${SITE_URL}/`, name: NAME,
  description: SHORT_DESCRIPTION, inLanguage: "en", publisher: { "@id": `${SITE_URL}/#org` },
};
const APP_REF = { "@id": `${SITE_URL}/#app` };
const appNode = () => ({
  "@type": "SoftwareApplication", "@id": `${SITE_URL}/#app`, name: FULL_NAME, alternateName: NAME,
  description: SHORT_DESCRIPTION, url: `${SITE_URL}/`, applicationCategory: "BrowserApplication",
  operatingSystem: "Chrome, Microsoft Edge, Firefox",
  browserRequirements: `Chrome ${MIN.chrome} or later (and Microsoft Edge on the same engine), Firefox ${MIN.firefox} or later`,
  softwareVersion: VERSION, isAccessibleForFree: true,
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  license: "https://opensource.org/licenses/MIT",
  downloadUrl: LINKS.chromeZip, installUrl: LINKS.firefox,
  sameAs: [LINKS.github, LINKS.firefox, LINKS.edge],
  author: { "@id": `${SITE_URL}/#org` }, publisher: { "@id": `${SITE_URL}/#org` },
  image: asset("og-image.png"),
  screenshot: ["dash-overview", "dash-rules", "panel-focus", "blocked"].map((n) => asset(`img/${n}-light.webp`)),
  featureList: FEATURE_LIST,
  keywords: KEYWORDS.join(", "),
});
const crumbs = (items) => ({
  "@type": "BreadcrumbList",
  itemListElement: items.map(([name, file], i) => ({ "@type": "ListItem", position: i + 1, name, item: abs(file) })),
});

// ---------- layout ----------
const NAV = ["home", "install", "features", "faq", "support"];

function layout({ key, file, title, description, body, extraGraph = [], breadcrumb, keywords, noindex = false, ogImageAlt }) {
  const url = abs(file);
  const page = {
    "@type": "WebPage", "@id": `${url}#webpage`, url, name: title, description,
    isPartOf: { "@id": `${SITE_URL}/#website` }, dateModified: SITE_UPDATED, inLanguage: "en",
    primaryImageOfPage: { "@type": "ImageObject", url: asset("og-image.png") },
  };
  const graph = [ORG, WEBSITE, page, ...(breadcrumb ? [crumbs(breadcrumb)] : []), ...extraGraph];
  const nav = NAV.map((k) => {
    const p = PAGES[k];
    return `<a href="${p.file}"${k === key ? ' aria-current="page"' : ""}>${p.nav}</a>`;
  }).join("");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
${keywords ? `<meta name="keywords" content="${esc(keywords)}">\n` : ""}<meta name="author" content="${PUBLISHER}">
<meta name="application-name" content="${NAME}">
<meta name="robots" content="${noindex ? "noindex, follow" : "index, follow, max-image-preview:large, max-snippet:-1"}">
<link rel="canonical" href="${url}">
<meta name="theme-color" content="#e8ebfc" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0f1420" media="(prefers-color-scheme: dark)">
<link rel="icon" type="image/png" sizes="32x32" href="assets/icon-32.png">
<link rel="icon" type="image/png" sizes="192x192" href="assets/icon-192.png">
<link rel="apple-touch-icon" href="assets/icon-180.png">
<link rel="sitemap" type="application/xml" href="sitemap.xml">
<link rel="alternate" type="text/plain" href="llms.txt" title="${NAME} summary for AI assistants">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${NAME}">
<meta property="og:locale" content="en_US">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${asset("og-image.png")}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(ogImageAlt || `${NAME}: ${TAGLINE}, shown on the side panel and dashboard`)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${asset("og-image.png")}">
<link rel="stylesheet" href="assets/site.css">
${ld(graph)}
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="site-header">
<div class="wrap">
<a class="brand" href="index.html"><img src="assets/focusgate-icon-128.png" width="30" height="30" alt="" decoding="async"><span>${NAME}</span></a>
<nav class="nav" aria-label="Main">${nav}</nav>
</div>
</header>
<main id="main">
${body}
</main>
<footer class="site-footer">
<div class="wrap">
<div class="footer__grid">
<div>
<a class="brand" href="index.html"><img src="assets/focusgate-icon-128.png" width="30" height="30" alt="" decoding="async"><span>${NAME}</span></a>
<p class="muted small" style="margin-top:12px">${TAGLINE} for Chrome, Edge and Firefox. Free and open source. Your data stays in your browser.</p>
</div>
<nav aria-label="Get FocusGate">
<h2>Get it</h2>
<ul>
<li><a href="${LINKS.firefox}">Firefox Add-ons</a></li>
<li><a href="${LINKS.edge}">Microsoft Edge Add-ons</a></li>
<li><a href="install.html#chrome">Chrome (from GitHub)</a></li>
<li><a href="${LINKS.releases}">All downloads</a></li>
</ul>
</nav>
<nav aria-label="Learn more">
<h2>Learn more</h2>
<ul>
<li><a href="features.html">Features</a></li>
<li><a href="faq.html">FAQ</a></li>
<li><a href="support.html">Support</a></li>
<li><a href="llms.txt">Summary for AI assistants</a></li>
</ul>
</nav>
<nav aria-label="Project">
<h2>Project</h2>
<ul>
<li><a href="${LINKS.github}">Source on GitHub</a></li>
<li><a href="${LINKS.issues}">Report an issue</a></li>
<li><a href="privacy-policy.html">Privacy policy</a></li>
<li><a href="terms-of-service.html">Terms of service</a></li>
</ul>
</nav>
</div>
<div class="footer__fine">
<span>&copy; 2026 ${PUBLISHER}. ${NAME} is open source under the <a href="${LINKS.license}">MIT licence</a>.</span>
<span>Chrome, Microsoft Edge and Firefox are trademarks of their owners. ${NAME} is not affiliated with them.</span>
</div>
</div>
</footer>
</body>
</html>
`;
}

const write = (file, content) => writeFileSync(path.join(docs, file), content);

const storeButtons = ({ small = false } = {}) => {
  const cls = small ? "btn btn--small" : "btn";
  return `<a class="${cls} btn--primary" href="${LINKS.firefox}">Add to Firefox</a>
<a class="${cls} btn--primary" href="${LINKS.edge}">Add to Edge</a>
<a class="${cls} btn--secondary" href="install.html#chrome">Get for Chrome</a>`;
};

const faqHtml = (items) =>
  `<div class="faq">${items
    .map((f) => `<details><summary>${esc(f.q)}</summary><div class="answer"><p>${f.a}</p></div></details>`)
    .join("\n")}</div>`;

const faqNode = (items) => ({
  "@type": "FAQPage",
  mainEntity: items.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: stripTags(f.a) } })),
});

// =====================================================================================
// Home
// =====================================================================================
const homeTitle = `${NAME}: Website Blocker & Focus Timer for Chrome, Edge, Firefox`;
const homeDesc = SHORT_DESCRIPTION.length <= 160 ? SHORT_DESCRIPTION : SHORT_DESCRIPTION.slice(0, 157) + "...";

write(
  "index.html",
  layout({
    key: "home", file: "index.html", title: homeTitle, description: homeDesc, keywords: KEYWORDS.join(", "),
    extraGraph: [appNode()],
    body: `
<section class="hero">
<div class="wrap hero__grid">
<div>
<div class="eyebrow"><span class="pill pill--accent">Free</span><span class="pill pill--accent">Open source</span><span class="pill pill--accent">No account</span></div>
<h1>Block distractions. <span>Keep your focus.</span></h1>
<p class="lead">${NAME} is a free, open-source website blocker and focus timer for Chrome, Edge and Firefox. It blocks the sites and keywords you choose during focus sessions, on schedules or all day, and your data never leaves your browser.</p>
<div class="cta">${storeButtons()}</div>
<p class="hero__note">Not on the Chrome Web Store. Chrome installs from GitHub in about a minute: <a href="install.html#chrome">see the steps</a>.</p>
</div>
<div class="shots">
${shotFig("panelFocus", "Focus: start a session in one tap", { eager: true })}
${shotFig("panelRules", "Rules: sites, keywords, schedules", { eager: true })}
</div>
</div>
</section>

<section class="section section--alt" id="get">
<div class="wrap">
<div class="section__head">
<h2>Get ${NAME} for your browser</h2>
<p>Pick your browser. Firefox and Edge install from their official add-on stores and update themselves. Chrome installs from the GitHub release.</p>
</div>
<div class="cards">
<div class="card"><h3>Firefox</h3><p>Firefox ${MIN.firefox} or later, and Firefox for Android ${MIN.firefoxAndroid} or later. Installs from Firefox Add-ons.</p><a class="btn btn--primary" href="${LINKS.firefox}">Add to Firefox</a></div>
<div class="card"><h3>Microsoft Edge</h3><p>Installs from Microsoft Edge Add-ons and updates itself.</p><a class="btn btn--primary" href="${LINKS.edge}">Add to Edge</a></div>
<div class="card card--accent"><h3>Chrome</h3><p>Chrome ${MIN.chrome} or later. Download <code>focusgate-chrome.zip</code> from GitHub, extract it and load it in <code>chrome://extensions</code>.</p><a class="btn btn--secondary" href="install.html#chrome">Chrome install guide</a></div>
</div>
</div>
</section>

<section class="section" id="what">
<div class="wrap">
<div class="section__head">
<h2>Everything you need to stay on task</h2>
<p>Block what pulls you away, focus on purpose, and see how much focused time you really get.</p>
</div>
<div class="cards">
<div class="card"><h3>Block websites</h3><p>A focus list for sessions and schedules, plus an always-blocked list that works all day. Related addresses such as x.com and twitter.com share one entry.</p></div>
<div class="card"><h3>Block keywords</h3><p>Stop searches and pages that match your words, or hide matches on supported pages such as YouTube and Google Search.</p></div>
<div class="card"><h3>Schedules</h3><p>Work hours, study time or sleep, on any days and any hours, including overnight. Start from a template and see your whole week at a glance.</p></div>
<div class="card"><h3>Daily limits</h3><p>Give a site a time or page-open budget. When it runs out, the site blocks.</p></div>
<div class="card"><h3>Focus timer</h3><p>Start in one click from the side panel. Choose a lock: None, Strict or Commit, to keep your future self honest.</p></div>
<div class="card"><h3>Block now <span class="pill">No early stop</span></h3><p>Pick sites and an end time, from 5 minutes to 30 days. It never uses your password, and nothing can be loosened until it ends.</p></div>
</div>
<p style="margin-top:20px"><a href="features.html">See all features</a></p>
</div>
</section>

<section class="section section--alt">
<div class="wrap">
<div class="split">
<div>
<h2>See your focus at a glance</h2>
<p class="lead" style="margin-top:12px">The dashboard shows today first, a week chart, your schedules and limits, and when protection was off. Reports, streaks, habits and achievements sit alongside.</p>
<ul class="ticks">
<li>Today, week and month views</li>
<li>Focus score, streaks and pages blocked</li>
<li>Only finished sessions count toward your daily goal</li>
</ul>
</div>
<div class="split__media">${shotFig("dashOverview", "The dashboard Overview")}</div>
</div>
<div class="split split--flip">
<div>
<h2>A block page that remembers why</h2>
<p class="lead" style="margin-top:12px">When you hit a blocked site you see your own reason, how long is left and a Close tab button. No lecture, no stock message.</p>
<ul class="ticks">
<li>Shows which schedule or session blocked the site</li>
<li>Says when the block ends</li>
<li>Light and dark, easy on the eyes</li>
</ul>
</div>
<div class="split__media">${shotFig("blocked", "The block page", { narrow: false })}</div>
</div>
</div>
</section>

<section class="section" id="facts">
<div class="wrap">
<div class="section__head">
<h2>${NAME} at a glance</h2>
<p>The facts, in one place.</p>
</div>
<dl class="facts">${FACTS.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}</dl>
</div>
</section>

<section class="section section--alt" id="private">
<div class="wrap">
<div class="split">
<div>
<h2>Private by design</h2>
<p class="lead" style="margin-top:12px">No account, no ads, no analytics and no remote servers. Your rules, history and settings live in your browser, and you can export or import a backup. ${NAME} keeps only a scrambled copy of your password.</p>
<p><a href="privacy-policy.html">Read the privacy policy</a> or <a href="${LINKS.github}">check the source code</a>.</p>
</div>
<div>
<div class="status"><strong>Good to know</strong>
<p>${NAME} needs access to the sites you browse so it can block them. It reads page addresses only to apply your rules.</p>
<p>A lock slows you down; it does not make removal impossible. Someone with access to your browser can still disable the extension.</p>
<p>Content filters are Beta and off by default, because they depend on each site's page layout.</p></div>
</div>
</div>
</div>
</section>

<section class="section" id="faq">
<div class="wrap">
<div class="section__head"><h2>Common questions</h2></div>
${faqHtml(FAQ.slice(0, 5))}
<p style="margin-top:20px"><a href="faq.html">Read all questions</a></p>
</div>
</section>

<section class="section section--alt">
<div class="wrap">
<div class="section__head"><h2>Ready to focus?</h2><p>Add ${NAME} in a minute. It's free.</p></div>
<div class="cta">${storeButtons()}</div>
</div>
</section>`,
  }),
);

// =====================================================================================
// Install
// =====================================================================================
const chromeSteps = [
  ["Download the extension", `Get <code>focusgate-chrome.zip</code> from the latest GitHub release. <a href="${LINKS.chromeZip}">Download focusgate-chrome.zip</a>, or open the <a href="${LINKS.releases}">Releases page</a> and pick it from the list of files.`],
  ["Extract it to a folder you will keep", `Extract the zip to a permanent place, such as <code>Documents/FocusGate</code>, not your Downloads folder. Chrome loads the extension from that folder every time it starts, so don't move or delete it. Open the folder and check that <code>manifest.json</code> is directly inside; if the zip made an extra folder, use the inner one.`],
  ["Open the extensions page", `In Chrome, go to <code>chrome://extensions</code> and turn on <strong>Developer mode</strong> (top right).`],
  ["Load it", `Choose <strong>Load unpacked</strong> and select the folder that contains <code>manifest.json</code>. FocusGate appears in your list of extensions.`],
  ["Pin it and open it", `Click the puzzle-piece icon in the toolbar and pin FocusGate. Click its icon to open the side panel. A guided setup opens the first time.`],
];

write(
  "install.html",
  layout({
    key: "install", file: "install.html",
    title: `Install ${NAME} on Chrome, Edge and Firefox`,
    description: `How to install ${NAME}: add it to Firefox or Edge from their add-on stores, or install it on Chrome from the GitHub release in five steps.`,
    breadcrumb: [["Home", "index.html"], ["Install", "install.html"]],
    extraGraph: [
      appNode(),
      {
        "@type": "HowTo", name: `How to install ${NAME} on Chrome`,
        description: `${NAME} is not on the Chrome Web Store, so Chrome installs it from the GitHub release as an unpacked extension.`,
        step: chromeSteps.map(([name, text], i) => ({ "@type": "HowToStep", position: i + 1, name, text: stripTags(text) })),
      },
    ],
    body: `
<div class="wrap page-head">
<p class="crumbs"><a href="index.html">Home</a> / Install</p>
<h1>Install ${NAME}</h1>
<p class="lead">${NAME} is free. On Firefox and Edge, add it from the official add-on store. On Chrome, install it from the GitHub release in five short steps.</p>
<ul class="toc"><li><a href="#firefox">Firefox</a></li><li><a href="#edge">Edge</a></li><li><a href="#chrome">Chrome</a></li><li><a href="#after">After you install</a></li></ul>
</div>

<section class="section" id="firefox">
<div class="wrap">
<div class="section__head"><h2>Firefox</h2><p>Firefox ${MIN.firefox} or later. Firefox for Android ${MIN.firefoxAndroid} or later.</p></div>
<ol class="steps">
<li><h3>Open the add-on page</h3><p><a href="${LINKS.firefox}">${NAME} on Firefox Add-ons</a>.</p></li>
<li><h3>Add it</h3><p>Choose <strong>Add to Firefox</strong> and accept the permission prompt.</p></li>
<li><h3>Allow access to sites</h3><p>${NAME} needs site access to block pages. If blocking does not work, open <code>about:addons</code>, choose ${NAME}, open <strong>Permissions</strong> and allow access to your data for all websites.</p></li>
<li><h3>Open it</h3><p>Click the ${NAME} toolbar button. On desktop it opens in the sidebar. On Android there is no sidebar, so it opens in a tab.</p></li>
</ol>
<p class="cta" style="margin-top:20px"><a class="btn btn--primary" href="${LINKS.firefox}">Add to Firefox</a></p>
</div>
</section>

<section class="section section--alt" id="edge">
<div class="wrap">
<div class="section__head"><h2>Microsoft Edge</h2><p>Installs from Microsoft Edge Add-ons and updates itself.</p></div>
<ol class="steps">
<li><h3>Open the add-on page</h3><p><a href="${LINKS.edge}">${NAME} on Microsoft Edge Add-ons</a>.</p></li>
<li><h3>Get it</h3><p>Choose <strong>Get</strong>, then <strong>Add extension</strong>.</p></li>
<li><h3>Open it</h3><p>Click the ${NAME} icon in the toolbar (or under the puzzle-piece Extensions menu) to open the side panel.</p></li>
</ol>
<p class="cta" style="margin-top:20px"><a class="btn btn--primary" href="${LINKS.edge}">Add to Edge</a></p>
</div>
</section>

<section class="section" id="chrome">
<div class="wrap">
<div class="section__head">
<h2>Chrome</h2>
<p>${NAME} is not on the Chrome Web Store, so Chrome installs it from the GitHub release. It is the same extension. Chrome ${MIN.chrome} or later.</p>
</div>
<ol class="steps">
${chromeSteps.map(([h, p]) => `<li><h3>${h}</h3><p>${p}</p></li>`).join("\n")}
</ol>
<p class="cta" style="margin-top:20px"><a class="btn btn--primary" href="${LINKS.chromeZip}">Download focusgate-chrome.zip</a><a class="btn btn--secondary" href="${LINKS.releases}">All releases</a></p>
<div class="cards" style="margin-top:28px">
<div class="card"><h3>Keep the folder where it is</h3><p>Chrome runs an unpacked extension from its folder. If you move or delete the folder, the extension stops working.</p></div>
<div class="card"><h3>Back up before you move it</h3><p>An unpacked extension's data belongs to the folder it was loaded from. Before moving it or loading it from a new place, open <strong>Settings</strong> and export a backup, then import it afterwards.</p></div>
<div class="card"><h3>Updating</h3><p>Chrome does not update this install for you. Download the new zip, replace the files in the same folder, then press the reload button on <code>chrome://extensions</code>. Export a backup first to be safe.</p></div>
</div>
<p class="muted small" style="margin-top:20px">Other Chromium-based browsers may load the same file in the same way. Only Chrome, Edge and Firefox are supported. On Edge you can also load <code>focusgate-edge.zip</code> from the release as an unpacked extension, but the Edge Add-ons store is the easier route.</p>
</div>
</section>

<section class="section section--alt" id="after">
<div class="wrap">
<div class="section__head"><h2>After you install</h2><p>You can be blocking in about a minute.</p></div>
<ol class="steps">
<li><h3>Run the guided setup</h3><p>It opens the first time. You can run it again from the You tab.</p></li>
<li><h3>Add the sites that distract you</h3><p>On the Focus tab, choose <strong>Add sites</strong>. Add keywords and schedules from the Rules tab or the full-screen dashboard.</p></li>
<li><h3>Start focusing</h3><p>Start a focus session from the side panel or press <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>F</kbd>. Want no way out? Use <strong>Block now</strong>.</p></li>
</ol>
<p style="margin-top:20px">Stuck? See <a href="support.html">Support</a> or the <a href="faq.html">FAQ</a>.</p>
</div>
</section>`,
  }),
);

// =====================================================================================
// Features
// =====================================================================================
const filterRows = [
  ["YouTube", "Shorts shelves and menu entry (Shorts links open as normal videos), the home feed, suggested videos, comments"],
  ["Instagram", "Reels, Explore"],
  ["X (Twitter)", "Trends and Who to follow"],
  ["TikTok", "The For You and Explore feed"],
  ["LinkedIn", "The post feed"],
  ["Hide words", "Posts and results that contain your words, on YouTube, Reddit, X, Instagram, TikTok, LinkedIn and Google search"],
];

write(
  "features.html",
  layout({
    key: "features", file: "features.html",
    title: `${NAME} Features: Site Blocker, Focus Timer, Schedules`,
    description: `Everything ${NAME} does: block sites and keywords, schedules, daily limits, a focus timer with locks, Block now, progress tracking and Beta content filters.`,
    breadcrumb: [["Home", "index.html"], ["Features", "features.html"]],
    extraGraph: [appNode()],
    body: `
<div class="wrap page-head">
<p class="crumbs"><a href="index.html">Home</a> / Features</p>
<h1>Features</h1>
<p class="lead">${NAME} blocks distracting websites and keywords, runs a focus timer, and shows your progress. Here is everything it does.</p>
<ul class="toc"><li><a href="#sites">Websites</a></li><li><a href="#keywords">Keywords</a></li><li><a href="#schedules">Schedules</a></li><li><a href="#limits">Daily limits</a></li><li><a href="#timer">Focus timer</a></li><li><a href="#blocknow">Block now</a></li><li><a href="#filters">Content filters</a></li><li><a href="#progress">Progress</a></li><li><a href="#browsers">Browsers</a></li></ul>
</div>

<section class="section" id="sites">
<div class="wrap split">
<div>
<h2>Block websites</h2>
<p class="lead" style="margin-top:12px">Keep two lists: a <strong>focus list</strong> that blocks during sessions and schedules, and an <strong>always-blocked</strong> list that works all day.</p>
<ul class="ticks">
<li>Related addresses such as x.com and twitter.com share one entry</li>
<li>Pick from your existing sites, your custom presets and the built-in presets with one tap</li>
<li>Blocking happens at the browser's network level, without reading page content</li>
</ul>
</div>
<div class="split__media">${shotFig("dashRules", "Rules on the dashboard")}</div>
</div>
</section>

<section class="section section--alt" id="keywords">
<div class="wrap">
<div class="section__head"><h2>Block keywords</h2><p>Block searches and pages that match your words, or hide matches on supported pages such as YouTube and Google Search. A match log shows what was caught.</p></div>
</div>
</section>

<section class="section" id="schedules">
<div class="wrap split">
<div>
<h2>Schedules that explain themselves</h2>
<p class="lead" style="margin-top:12px">Block on the days and hours you choose, including overnight.</p>
<ul class="ticks">
<li>Start from a Work hours, Study or Sleep template</li>
<li>Choose exactly which sites each schedule blocks, or use your Focus list</li>
<li>The Schedules screen says what is on now or what starts next, and shows your whole week</li>
<li>The block page says which schedule blocked the site and when it ends</li>
</ul>
</div>
<div class="split__media">${shotFig("panelRules", "Rules in the side panel", { narrow: true })}</div>
</div>
</section>

<section class="section section--alt" id="limits">
<div class="wrap">
<div class="section__head"><h2>Daily limits</h2><p>Give a site a time or page-open budget for the day. When the budget is used up, the site blocks. ${NAME} stops counting time when you step away.</p></div>
</div>
</section>

<section class="section" id="timer">
<div class="wrap split split--flip">
<div>
<h2>A focus timer with locks</h2>
<p class="lead" style="margin-top:12px">Start a session in one click from the side panel (the sidebar in Firefox), extend it or stop it. A card says what is on, when it ends and what is blocked.</p>
<h3 style="margin:18px 0 8px">Choose how firm to be</h3>
<ul class="ticks">
<li><strong>None:</strong> stop any time</li>
<li><strong>Strict:</strong> stopping early needs your password, or the phrase "I GIVE UP" and a 15-second wait if you have not set one</li>
<li><strong>Commit:</strong> no early stop at all</li>
</ul>
<p class="muted">Sessions you stop early are shown, but only finished time counts toward your daily goal, streak and achievements. When a session ends you get a done card, a soft chime you can turn off, and a short message when you reach your goal.</p>
</div>
<div class="split__media">${shotFig("panelSession", "A running focus session", { narrow: true })}</div>
</div>
</section>

<section class="section section--alt" id="blocknow">
<div class="wrap">
<div class="section__head"><h2>Block now <span class="pill">No early stop</span></h2><p>A timed block for when you want no way out. Pick sites and an end time, from 5 minutes up to 30 days, with up to 500 sites.</p></div>
<div class="cards">
<div class="card"><h3>Independent of your password</h3><p>Block now never asks for a password and a password cannot end it. It runs until the time you chose.</p></div>
<div class="card"><h3>Locks things down while it runs</h3><p>Sites, keywords, schedules and limits cannot be removed or loosened. Content filters cannot be turned off. The password cannot be changed or removed, and your data cannot be reset.</p></div>
<div class="card"><h3>Easy to set up</h3><p>Pick from your existing sites with one tap, or add new ones. It has its own tab in the dashboard and a card in the side panel.</p></div>
</div>
</div>
</section>

<section class="section" id="filters">
<div class="wrap">
<div class="section__head"><h2>Content filters <span class="pill">Beta</span></h2><p>Hide parts of a page instead of blocking the whole site. They are all off by default, and marked Beta because they depend on each site's page layout, which can change without notice.</p></div>
<div class="table-wrap"><table><thead><tr><th scope="col">Site</th><th scope="col">What it can hide</th></tr></thead><tbody>
${filterRows.map(([s, d]) => `<tr><th scope="row">${esc(s)}</th><td>${esc(d)}</td></tr>`).join("")}
</tbody></table></div>
<p class="muted small" style="margin-top:14px">Turning a filter off asks for your password if you set one, and is locked while Block now or a Strict or Commit session runs.</p>
</div>
</section>

<section class="section section--alt" id="progress">
<div class="wrap split">
<div>
<h2>See your progress</h2>
<ul class="ticks" style="margin-top:14px">
<li>Today, week and month views, with a week chart</li>
<li>Focus score, streaks and pages blocked</li>
<li>The sites that tried hardest to distract you</li>
<li>Weekly reports and daily mood notes</li>
<li>Habits, a daily goal and achievements</li>
<li>Your own reason for focusing, shown when you hit a block</li>
</ul>
<p class="muted">Light and dark themes, built for keyboard and screen-reader use. Keyboard shortcuts: <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>F</kbd> starts or stops a focus session and <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>B</kbd> blocks the current site. Export or import a backup any time.</p>
</div>
<div class="split__media">${shotFig("panelYou", "The You tab", { narrow: true })}</div>
</div>
</section>

<section class="section" id="browsers">
<div class="wrap">
<div class="section__head"><h2>Browser support</h2><p>${NAME} works in Chrome, Edge and Firefox. A few things differ.</p></div>
<div class="table-wrap"><table>
<thead><tr><th scope="col"></th><th scope="col">Chrome</th><th scope="col">Edge</th><th scope="col">Firefox</th><th scope="col">Firefox for Android</th></tr></thead>
<tbody>
<tr><th scope="row">Install from</th><td>GitHub release</td><td>Edge Add-ons</td><td>Firefox Add-ons</td><td>Firefox Add-ons</td></tr>
<tr><th scope="row">Minimum version</th><td>${MIN.chrome}</td><td>Chromium ${MIN.chrome} engine</td><td>${MIN.firefox}</td><td>${MIN.firefoxAndroid}</td></tr>
<tr><th scope="row">Opens in</th><td>Side panel</td><td>Side panel</td><td>Sidebar</td><td>A tab</td></tr>
<tr><th scope="row">Shortcuts, notifications, idle detection</th><td>Yes</td><td>Yes</td><td>Yes</td><td>Skipped</td></tr>
</tbody></table></div>
<p class="cta" style="margin-top:24px">${storeButtons()}</p>
</div>
</section>`,
  }),
);

// =====================================================================================
// FAQ
// =====================================================================================
write(
  "faq.html",
  layout({
    key: "faq", file: "faq.html",
    title: `${NAME} FAQ: Install, Privacy, Block now and More`,
    description: `Answers about ${NAME}: is it free, how to install it on Chrome, Firefox and Edge, what data it collects, how Block now and session locks work, and more.`,
    breadcrumb: [["Home", "index.html"], ["FAQ", "faq.html"]],
    extraGraph: [faqNode(FAQ)],
    body: `
<div class="wrap page-head">
<p class="crumbs"><a href="index.html">Home</a> / FAQ</p>
<h1>Frequently asked questions</h1>
<p class="lead">Short answers about ${NAME}. Can't find yours? Ask on <a href="${LINKS.issues}">GitHub</a> or see <a href="support.html">Support</a>.</p>
</div>
<section class="section"><div class="wrap">
${faqHtml(FAQ)}
</div></section>`,
  }),
);

// =====================================================================================
// Support
// =====================================================================================
write(
  "support.html",
  layout({
    key: "support", file: "support.html",
    title: `${NAME} Support: Help, Troubleshooting and Bug Reports`,
    description: `Get help with ${NAME}: install guides for Chrome, Edge and Firefox, what to check when a site is not blocking, and how to report a problem on GitHub.`,
    breadcrumb: [["Home", "index.html"], ["Support", "support.html"]],
    body: `
<div class="wrap page-head">
<p class="crumbs"><a href="index.html">Home</a> / Support</p>
<h1>Support</h1>
<p class="lead">Need help with ${NAME}? Use the <a href="install.html">install guide</a> for Chrome, Edge and Firefox. Store users should install and update ${NAME} from their browser's add-on store.</p>
</div>
<section class="section"><div class="wrap prose">
<h2>Before you report a problem</h2>
<ol>
<li>Confirm the extension is enabled on your browser's extensions page.</li>
<li>Confirm the site is in your ${NAME} rules and that the focus session, schedule or Block now you expect is active.</li>
<li>On Firefox, open <code>about:addons</code>, choose ${NAME}, open <strong>Permissions</strong> and make sure access to all websites is allowed.</li>
<li>If you installed a new build on Chrome, press reload on <code>chrome://extensions</code>.</li>
<li>Read the <a href="faq.html">FAQ</a>, <a href="privacy-policy.html">Privacy Policy</a> and <a href="terms-of-service.html">Terms of Service</a>.</li>
</ol>
<h2>Report a problem</h2>
<p>Include your browser name and version, the ${NAME} version (shown in Settings, in the About card), the steps to reproduce the issue, and any error shown on the extensions page. Do not include private browsing history or sensitive information.</p>
<p class="cta"><a class="btn btn--primary" href="${LINKS.issues}">Open a GitHub issue</a><a class="btn btn--secondary" href="${LINKS.github}">View the source</a></p>
<h2>Good to know</h2>
<ul>
<li>${NAME} cannot guarantee that every distraction is blocked at all times. Browser updates can occasionally affect blocking.</li>
<li>Content filters are Beta. If one stops working after a site redesign, please report it and name the site and the filter.</li>
<li>A lock slows you down; it does not make removal impossible.</li>
</ul>
</div></section>`,
  }),
);

// =====================================================================================
// Privacy policy (text preserved from the previous page; permissions and browsers brought up to date)
// =====================================================================================
write(
  "privacy-policy.html",
  layout({
    key: "privacy", file: "privacy-policy.html",
    title: `Privacy Policy | ${NAME}`,
    description: `${NAME} stores your rules, history and settings in your browser. No server, no analytics, no ads, and no personal information collected or sent.`,
    breadcrumb: [["Home", "index.html"], ["Privacy policy", "privacy-policy.html"]],
    body: `
<div class="wrap page-head">
<p class="crumbs"><a href="index.html">Home</a> / Privacy policy</p>
<h1>Privacy Policy</h1>
<p class="muted">Last updated: November 13, 2026</p>
<p class="lead">At ${NAME}, we believe your data is yours. This Privacy Policy explains how the ${NAME} browser extension stores and uses information. ${NAME} is designed so the extension does not collect or transmit personal information. It applies to the extension in Chrome, Microsoft Edge and Firefox, and to this website.</p>
</div>
<section class="section"><div class="wrap prose">
<h2>1. Data storage is 100% local</h2>
<p>${NAME} is designed to operate entirely on your device. Your settings, blocked websites, keywords, focus history, schedules, daily limits, habits, notes and statistics are stored locally using your browser's extension storage on your computer. ${NAME} keeps only a scrambled (hashed) copy of your password, never the password itself.</p>
<p>We do not operate a server, database, or cloud storage for extension data. Your ${NAME} data stays on your device unless you choose to share it yourself, such as when you export a backup or open a support issue.</p>
<h2>2. No analytics or tracking</h2>
<p>We do not use any third-party analytics services (like Google Analytics or Mixpanel) inside the extension. We do not track how you use the extension, which websites you block, or how often you fail a focus session. The Firefox version declares that it collects no data.</p>
<h2>3. Permissions explained</h2>
<p>To function correctly, ${NAME} requires certain permissions in your browser. Here is exactly why we need them:</p>
<ul>
<li><strong>storage:</strong> Used to save your settings, blocked lists, and statistics locally on your device.</li>
<li><strong>tabs &amp; webNavigation:</strong> Used to detect when you attempt to visit a blocked website and intervene when a page or route changes, and to know which tab is in use for daily limits.</li>
<li><strong>All-sites host access (&lt;all_urls&gt;):</strong> Used to inspect and redirect pages across websites selected by you. Page contents and browsing data are not uploaded.</li>
<li><strong>declarativeNetRequest:</strong> Used to efficiently block web requests to distracting sites at the browser network level.</li>
<li><strong>alarms:</strong> Used to run background timers for focus sessions, daily allowances, scheduled blocks, and weekly digests.</li>
<li><strong>notifications:</strong> Used to send you alerts, such as when a focus session ends or when your weekly digest is ready.</li>
<li><strong>idle:</strong> Used to stop counting time toward daily limits when you step away from the computer.</li>
<li><strong>sidePanel (Chrome and Edge):</strong> Used to show the ${NAME} timer and rules in the browser's side panel. Firefox uses its sidebar instead, which needs no extra permission.</li>
</ul>
<p>${NAME} also runs a small script on YouTube, Google, Reddit, X (Twitter), Instagram, TikTok and LinkedIn pages to apply keyword and content filters. That script works on your device and does not send page contents anywhere.</p>
<h2>4. This website</h2>
<p>This website is a static site. It has no forms, no accounts, no cookies of its own and no analytics. The service that hosts it may keep ordinary server logs under its own policy.</p>
<h2>5. Third-party links</h2>
<p>Our extension and website contain links to third-party websites, such as GitHub, Firefox Add-ons and Microsoft Edge Add-ons. We are not responsible for the privacy practices of those external sites.</p>
<h2>6. Changes to this policy</h2>
<p>Since we do not collect data, this policy is unlikely to change drastically. However, we may update it from time to time to reflect changes in the extension's features. Any updates will be reflected on this page, with the date above.</p>
<h2>7. Contact us</h2>
<p>If you have any questions about this Privacy Policy or the open-source code, visit the <a href="support.html">Support page</a>, inspect the <a href="${LINKS.github}">source code on GitHub</a>, or <a href="${LINKS.issues}">open an issue</a> in our repository.</p>
</div></section>`,
  }),
);

// =====================================================================================
// Terms of service (text preserved)
// =====================================================================================
write(
  "terms-of-service.html",
  layout({
    key: "terms", file: "terms-of-service.html",
    title: `Terms of Service | ${NAME}`,
    description: `The terms for using the ${NAME} browser extension: a free, open-source tool provided under the MIT licence, as is, without warranty.`,
    breadcrumb: [["Home", "index.html"], ["Terms of service", "terms-of-service.html"]],
    body: `
<div class="wrap page-head">
<p class="crumbs"><a href="index.html">Home</a> / Terms of service</p>
<h1>Terms of Service</h1>
<p class="muted">Last updated: August 10, 2026</p>
<p class="lead">Welcome to ${NAME}. By downloading, installing, or using the ${NAME} browser extension (the "Extension"), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the Extension.</p>
</div>
<section class="section"><div class="wrap prose">
<h2>1. Use of the Extension</h2>
<p>${NAME} is provided as a free, open-source tool to help you manage your digital environment. You may use it for personal or professional productivity. You may not use the Extension for any illegal or unauthorized purpose.</p>
<h2>2. Open source licence</h2>
<p>The source code for ${NAME} is open source and made available under the <a href="${LINKS.license}">MIT License</a> provided in the GitHub repository. You are free to view, modify, and distribute the code according to the terms of that licence.</p>
<h2>3. Disclaimer of warranties</h2>
<p>THE EXTENSION IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE EXTENSION OR THE USE OR OTHER DEALINGS IN THE EXTENSION.</p>
<p>We do not guarantee that the extension will successfully block all distractions at all times. Users can sometimes find workarounds, and browser updates may occasionally impact functionality.</p>
<h2>4. Limitation of liability</h2>
<p>In no event shall ${NAME}, its creators, or contributors be liable for any direct, indirect, incidental, special, or consequential damages arising out of the use of or inability to use the Extension, even if advised of the possibility of such damages.</p>
<h2>5. Privacy</h2>
<p>Your privacy is paramount. Please review our <a href="privacy-policy.html">Privacy Policy</a> to understand how we treat your data. By using the Extension, you agree to the terms of the Privacy Policy.</p>
<h2>6. Changes to terms</h2>
<p>We reserve the right to modify these Terms of Service at any time. We will indicate the date of the latest revision at the top of this page. Continued use of the Extension after any such changes constitutes your consent to the updated terms.</p>
<h2>7. Contact</h2>
<p>For questions or concerns regarding these terms, visit the <a href="support.html">Support page</a> or consult our official <a href="${LINKS.github}">repository on GitHub</a>.</p>
</div></section>`,
  }),
);

// =====================================================================================
// 404 and the old chrome-install.html redirect
// =====================================================================================
write(
  "404.html",
  layout({
    key: "", file: "404.html", noindex: true,
    title: `Page not found | ${NAME}`,
    description: `This page does not exist. Go back to the ${NAME} home page or the install guide.`,
    body: `
<div class="wrap page-head" style="padding-bottom:64px">
<h1>Page not found</h1>
<p class="lead">That page does not exist or has moved.</p>
<p class="cta" style="margin-top:20px"><a class="btn btn--primary" href="index.html">Go to the home page</a><a class="btn btn--secondary" href="install.html">Install ${NAME}</a></p>
</div>`,
  }),
);

write(
  "chrome-install.html",
  `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Install ${NAME} on Chrome</title>
<meta name="robots" content="noindex, follow">
<link rel="canonical" href="${abs("install.html")}">
<meta http-equiv="refresh" content="0; url=install.html#chrome">
<link rel="stylesheet" href="assets/site.css">
</head>
<body>
<main class="wrap" style="padding:48px 20px">
<p>This page has moved. <a href="install.html#chrome">Open the Chrome install guide</a>.</p>
</main>
</body>
</html>
`,
);

// =====================================================================================
// sitemap.xml, robots.txt, llms.txt, llms-full.txt
// =====================================================================================
const indexed = ["home", "install", "features", "faq", "support", "privacy", "terms"].map((k) => PAGES[k].file);
write(
  "sitemap.xml",
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${indexed.map((f) => `  <url><loc>${abs(f)}</loc><lastmod>${SITE_UPDATED}</lastmod></url>`).join("\n")}
</urlset>
`,
);

const AI_BOTS = [
  "GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-SearchBot", "Claude-User", "anthropic-ai",
  "PerplexityBot", "Perplexity-User", "Google-Extended", "Applebot-Extended", "CCBot", "Bingbot", "Googlebot",
];
write(
  "robots.txt",
  `# ${NAME} is open source and happy to be read, indexed and cited, including by AI search and assistants.
User-agent: *
Allow: /

${AI_BOTS.map((b) => `User-agent: ${b}\nAllow: /`).join("\n\n")}

Sitemap: ${SITE_URL}/sitemap.xml
`,
);

const llmsFacts = FACTS.map(([k, v]) => `- ${k}: ${v}`).join("\n");
write(
  "llms.txt",
  `# ${FULL_NAME}

> ${SHORT_DESCRIPTION}

${NAME} is a Manifest V3 browser extension published by ${PUBLISHER}. Current version ${VERSION}. It is free and open source (MIT) and has no account, ads or analytics. It is not on the Chrome Web Store: Chrome installs from the GitHub release, Firefox from Firefox Add-ons and Edge from Microsoft Edge Add-ons.

## Get it
- [Firefox Add-ons](${LINKS.firefox}): install for Firefox ${MIN.firefox}+ and Firefox for Android ${MIN.firefoxAndroid}+
- [Microsoft Edge Add-ons](${LINKS.edge}): install for Edge
- [Chrome install guide](${SITE_URL}/install.html#chrome): download focusgate-chrome.zip from GitHub and load it unpacked (Chrome ${MIN.chrome}+)
- [GitHub releases](${LINKS.releases}): focusgate-chrome.zip, focusgate-edge.zip, focusgate-firefox.zip

## Learn more
- [Features](${SITE_URL}/features.html): sites, keywords, schedules, daily limits, focus timer with locks, Block now, content filters (Beta), progress
- [FAQ](${SITE_URL}/faq.html): short answers on price, install, privacy, Block now and session locks
- [Support](${SITE_URL}/support.html): troubleshooting and how to report a problem
- [Privacy policy](${SITE_URL}/privacy-policy.html): data stays in the browser; no server, analytics or ads
- [Terms of service](${SITE_URL}/terms-of-service.html)

## Source
- [GitHub repository](${LINKS.github}): source code, issues and releases

## Optional
- [Full text for AI assistants](${SITE_URL}/llms-full.txt): the facts, features and FAQ in one file
`,
);

write(
  "llms-full.txt",
  `# ${FULL_NAME}

> ${SHORT_DESCRIPTION}

Last updated: ${SITE_UPDATED}. Site: ${SITE_URL}/

## Facts
${llmsFacts}

## What FocusGate is
${NAME} is a free, open-source website blocker and focus timer for Chrome, Edge and Firefox. It blocks the sites and keywords you choose during focus sessions, on schedules or all day, lets you set daily limits, and shows how much focused time you really get. It is published by ${PUBLISHER} under the MIT licence.

## How to install
- Firefox (${MIN.firefox}+, Android ${MIN.firefoxAndroid}+): ${LINKS.firefox}
- Microsoft Edge: ${LINKS.edge}
- Chrome (${MIN.chrome}+): FocusGate is not on the Chrome Web Store. Download focusgate-chrome.zip from ${LINKS.releases} (direct: ${LINKS.chromeZip}), extract it to a folder you will keep, open chrome://extensions, turn on Developer mode, choose Load unpacked and select the folder that contains manifest.json. Click the toolbar icon to open the side panel.
- Chrome updates are manual: replace the files in the same folder and press reload on chrome://extensions. An unpacked extension's data belongs to its folder, so export a backup from Settings before moving it.

## Features
${FEATURE_LIST.map((f) => `- ${f}`).join("\n")}

### Session locks
- None: stop any time.
- Strict: stopping early needs your password; without a password you stop with the phrase "I GIVE UP" and a 15-second wait.
- Commit: no early stop.

### Block now
A timed block with no early stop. Choose sites and an end time from 5 minutes to 30 days, up to 500 sites. It never uses the password. While it runs, rules cannot be removed or loosened, content filters cannot be turned off, the password cannot be changed or removed, and data cannot be reset.

### Content filters (Beta, off by default)
${filterRows.map(([s, d]) => `- ${s}: ${d}`).join("\n")}
They depend on each site's page layout, which can change without notice.

## Privacy
All data is stored in the browser. FocusGate has no server, no analytics and no ads, and does not upload page contents or browsing. Only a hashed copy of the password is kept. The Firefox build declares no data collection. Permissions: storage, tabs, webNavigation, declarativeNetRequest, alarms, notifications, idle, sidePanel (Chrome and Edge) and access to all sites so rules can apply to any site you add.

## Limits
A lock slows you down; it does not make removal impossible. Someone with access to the browser can disable or remove the extension. Browser updates and site redesigns can occasionally affect blocking.

## FAQ
${FAQ.map((f) => `### ${f.q}\n${stripTags(f.a)}`).join("\n\n")}

## Links
- Source and issues: ${LINKS.github}
- Privacy policy: ${SITE_URL}/privacy-policy.html
- Terms: ${SITE_URL}/terms-of-service.html
`,
);

console.log(`Site written to ${docs} (base URL ${SITE_URL}).`);
