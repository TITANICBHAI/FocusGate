// Screenshots of every main surface for a before/after look: node looks.cjs <outdir> <tag> <light|dark>
const { chromium } = require("playwright");
const fs = require("fs");
const S = "/tmp/claude-0/-home-claude/1d3d810c-0866-503f-8b36-d437fcdf9427/scratchpad/store";
const OUT = process.argv[2] || `${S}/out8`;
const TAG = process.argv[3] || "after";
const THEME = process.argv[4] || "light";
fs.mkdirSync(OUT, { recursive: true });
const defaults = JSON.parse(fs.readFileSync(`${S}/default-state.json`, "utf8"));
const shell = (title, cls, js) => `<!doctype html><html lang="en" data-theme="${THEME}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title><link rel="stylesheet" href="styles.css"></head><body class="${cls}"><div id="root"></div><script src="${js}.js"></script></body></html>`;
fs.writeFileSync(`${S}/panel.html`, shell("FocusGate", "panel-page", "panel"));
fs.writeFileSync(`${S}/dashboard.html`, shell("Dashboard", "full-page", "dashboard"));
fs.writeFileSync(`${S}/blocked.html`, shell("Blocked", "full-page", "blocked"));
fs.writeFileSync(`${S}/onboarding.html`, shell("Setup", "full-page", "onboarding"));
const seed = (o) => `(() => {
  const defaults = ${JSON.stringify(defaults)};
  const now = Date.now();
  const key = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  const dayStats = {};
  [[0, 65, 3], [1, 95, 2], [2, 40, 1], [3, 120, 4], [4, 0, 0], [5, 75, 2], [6, 30, 1]].forEach(([ago, min, blocks]) => {
    const k = key(new Date(now - ago * 86400000));
    dayStats[k] = { dateKey: k, focusMs: min * 60000, sessionsCompleted: min ? Math.ceil(min / 30) : 0, sessionsAbandoned: 0, blocks, blocksByDomain: {}, tasksCompleted: min ? 1 : 0 };
  });
  const rules = ${o.empty ? "{}" : `{
    blockedSites: ["reddit.com", "x.com", "news.ycombinator.com"], alwaysBlockedSites: ["youtube.com"],
    keywords: [{ text: "news", mode: "block", when: "always" }],
    schedules: [{ id: "study", name: "Study hours", enabled: true, days: [1,2,3,4,5], start: "18:00", end: "21:00", sites: [], keywords: [], useGlobalLists: true }],
    dayStats }`};
  const state = Object.assign({}, defaults, rules, { settings: Object.assign({}, defaults.settings, { theme: "${THEME}", displayName: "Asha", why: "Finish the thesis draft by Friday", dailyGoalMin: 120 }) });
  ${o.session ? `state.session = { status: "work", sessionId: "demo", phaseStartedAt: now - 8 * 60000, phaseEndsAt: now + 17 * 60000, phasePlannedMs: 25 * 60000, plannedWorkMs: 25 * 60000, extendedMs: 0, cycle: 1, lockLevel: "none", taskId: null, blockedAttempts: 2, lastHeartbeatAt: now, gaps: [], stopChallengeStartedAt: null };` : ""}
  for (const [k, v] of Object.entries(state)) localStorage.setItem(k, JSON.stringify(v));
  window.chrome = { runtime: { id: "t", getURL: (p) => "chrome-extension://t/" + p, getManifest: () => ({ version: "1.0.1" }), sendMessage: async () => ({ ok: false, code: "X", message: "x" }) }, tabs: { create() {} } };
})();`;
async function shot(browser, file, name, o, vp, after) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: vp.width < 500 ? 2 : 1, colorScheme: THEME });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
  await page.route("file:///icon.png", (r) => r.fulfill({ path: `${S}/public/icon.png`, contentType: "image/png" }));
  await page.addInitScript(seed(o));
  await page.goto(`http://127.0.0.1:8765/${file}${o.hash || ""}`);
  await page.waitForTimeout(800);
  if (after) await after(page);
  await page.screenshot({ path: `${OUT}/looks-${TAG}-${THEME}-${name}.png` });
  if (errors.length) console.log("ERRORS", name, errors.join(" | "));
  await ctx.close();
}
(async () => {
  const browser = await chromium.launch();
  const P = { width: 400, height: 700 }, D = { width: 1280, height: 820 };
  await shot(browser, "panel.html", "panel-focus", {}, P);
  await shot(browser, "panel.html", "panel-session", { session: true }, P);
  await shot(browser, "panel.html", "panel-rules", {}, P, async (p) => { await p.getByRole("tab", { name: "Rules" }).click(); await p.waitForTimeout(300); });
  await shot(browser, "panel.html", "panel-you", {}, P, async (p) => { await p.getByRole("tab", { name: "You" }).click(); await p.waitForTimeout(300); });
  await shot(browser, "panel.html", "panel-firstrun", { empty: true }, P);
  await shot(browser, "dashboard.html", "dash-overview", { hash: "#overview" }, D);
  await shot(browser, "dashboard.html", "dash-rules", { hash: "#rules" }, D);
  await shot(browser, "dashboard.html", "dash-reports", { hash: "#reports" }, D);
  await shot(browser, "dashboard.html", "dash-settings", { hash: "#settings" }, D);
  await shot(browser, "blocked.html", "blocked", { session: true, hash: "#https%3A%2F%2Fwww.reddit.com%2Fr%2Fall" }, D);
  await shot(browser, "onboarding.html", "onboarding", { empty: true }, { width: 1000, height: 800 });
  await browser.close();
  console.log("done", TAG, THEME);
})();
