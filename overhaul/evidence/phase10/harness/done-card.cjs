// The done card, the goal moment and the chime, in the real panel in Chromium.
const { chromium } = require("playwright");
const fs = require("fs");
const S = "/tmp/claude-0/-home-claude/1d3d810c-0866-503f-8b36-d437fcdf9427/scratchpad/store";
const OUT = process.argv[2];
const THEME = process.argv[3] || "light";
fs.mkdirSync(OUT, { recursive: true });
const defaults = JSON.parse(fs.readFileSync(`${S}/default-state.json`, "utf8"));
fs.writeFileSync(`${S}/panel.html`, `<!doctype html><html lang="en" data-theme="${THEME}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>FocusGate</title><link rel="stylesheet" href="styles.css"></head><body class="panel-page"><div id="root"></div><script src="panel.js"></script></body></html>`);
const stub = (scenario, chimeOn) => `(() => {
  const MIN = 60000, now = Date.now();
  const key = (t) => { const d = new Date(t); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
  const rec = (id, endedAgo, min, extra) => Object.assign({ id, startedAt: now - endedAgo - min * MIN, endedAt: now - endedAgo, plannedMs: min * MIN, elapsedMs: min * MIN, status: "completed", lockLevel: "none", blockedAttempts: 0, gaps: [] }, extra || {});
  const day = (t, focus, stopped, done, aband) => ({ dateKey: key(t), focusMs: focus * MIN, ...(stopped ? { stoppedMs: stopped * MIN } : {}), sessionsCompleted: done, sessionsAbandoned: aband, blocks: 0, blocksByDomain: {}, tasksCompleted: 0 });
  const defaults = ${JSON.stringify(defaults)};
  const settings = Object.assign({}, defaults.settings, { theme: "${THEME}", dailyGoalMin: 60, notifications: Object.assign({}, defaults.settings.notifications, { chime: ${chimeOn} }) });
  let history = [], dayStats = {}, achievements = [], session = defaults.session;
  const scenario = ${JSON.stringify(scenario)};
  if (scenario === "plain") {
    const r = rec("s:1", 20000, 25); history = [r]; dayStats[key(r.startedAt)] = day(r.startedAt, 25, 0, 1, 0);
    session = Object.assign({}, defaults.session, { status: "shortBreak", sessionId: "b", phaseStartedAt: now - 20000, phaseEndsAt: now + 4.6 * MIN, phasePlannedMs: 5 * MIN });
  } else if (scenario === "goal") {
    const a = rec("s:0", 2 * 60 * MIN, 40), r = rec("s:1", 20000, 25, { blockedAttempts: 4 }); history = [a, r];
    dayStats[key(r.startedAt)] = day(r.startedAt, 65, 0, 2, 0);
    achievements = [{ id: "IRON_SESSION", unlockedAt: now - 10000 }];
  } else if (scenario === "stopped") {
    const r = rec("s:1", 20000, 12, { status: "abandoned" }); history = [r]; dayStats[key(r.startedAt)] = day(r.startedAt, 12, 12, 0, 1);
  }
  const state = Object.assign({}, defaults, { blockedSites: ["reddit.com"], alwaysBlockedSites: [], schedules: [], settings, sessionHistory: history, dayStats, achievements, session });
  for (const [k, v] of Object.entries(state)) { if (localStorage.getItem(k) === null) localStorage.setItem(k, JSON.stringify(v)); }
  window.__chime = { contexts: 0, oscillators: 0, freqs: [], peaks: [] };
  window.AudioContext = class { constructor() { window.__chime.contexts++; this.currentTime = 0; this.state = "running"; this.destination = {}; }
    createOscillator() { const o = { type: "", frequency: { value: 0 }, connect() {}, start() { window.__chime.oscillators++; window.__chime.freqs.push(o.frequency.value + ":" + o.type); }, stop() {} }; return o; }
    createGain() { return { connect() {}, gain: { setValueAtTime() {}, linearRampToValueAtTime(v) { window.__chime.peaks.push(v); }, exponentialRampToValueAtTime() {} } }; }
    async resume() {} async close() {} };
  window.chrome = { runtime: { id: "t", getURL: (p) => "chrome-extension://t/" + p, getManifest: () => ({ version: "1.0.1" }), sendMessage: async () => ({ ok: false, code: "X", message: "x" }) }, tabs: { create() {} } };
})();`;
const results = [];
const check = (n, ok, d) => { results.push(ok); console.log((ok ? "PASS " : "FAIL ") + n + (d ? " :: " + d : "")); };
(async () => {
  const browser = await chromium.launch();
  for (const [scenario, width] of [["plain", 400], ["goal", 400], ["goal", 320], ["stopped", 400]]) {
    const ctx = await browser.newContext({ viewport: { width, height: 760 }, deviceScaleFactor: 2, reducedMotion: "no-preference" });
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e).slice(0, 300)));
    await page.route("**/icon.png", (r) => r.fulfill({ path: `${S}/public/icon.png`, contentType: "image/png" }));
    await page.addInitScript(stub(scenario, true));
    await page.goto("http://127.0.0.1:8765/panel.html");
    await page.waitForTimeout(500);
    const w = `${scenario} ${width}px`;
    const card = page.locator(".fg-done");
    check(`${w}: done card shown`, (await card.count()) === 1);
    const text = await card.innerText();
    if (scenario === "plain") {
      check(`${w}: real minutes and the goal line`, text.includes("25 min, done") && text.includes("35 min from today’s goal."), text.replace(/\n/g, " | "));
      check(`${w}: break tip`, text.includes("Break time: 5 min."));
      check(`${w}: no goal pill`, (await page.locator(".fg-goal-pill").count()) === 0);
      check(`${w}: ring says 42%`, (await page.getByRole("img", { name: "Daily goal: 42%" }).count()) === 1);
    }
    if (scenario === "goal") {
      check(`${w}: headline and goal line`, text.includes("25 min, done") && text.includes("That’s your 60 min goal for today."), text.replace(/\n/g, " | "));
      check(`${w}: Daily goal reached pill`, (await page.locator(".fg-goal-pill").innerText()).trim() === "Daily goal reached");
      check(`${w}: achievement shown`, text.includes("Unlocked: Iron Session"));
      check(`${w}: ring says 100%`, (await page.getByRole("img", { name: "Daily goal: 100%" }).count()) === 1);
      const mid = await page.locator(".fg-goal-dots__dot").first().evaluate((el) => getComputedStyle(el).animationName);
      check(`${w}: dots animate when motion is allowed`, mid === "fg-goal-rise", mid);
      const iter = await page.locator(".fg-goal-dots__dot").first().evaluate((el) => getComputedStyle(el).animationIterationCount);
      check(`${w}: dots run once`, iter === "1", iter);
      const ringAnim = await page.locator(".fg-goal-ring__value").evaluate((el) => getComputedStyle(el).animationName);
      check(`${w}: ring fills with a CSS animation`, ringAnim === "fg-ring-fill", ringAnim);
      const pillBox = await page.locator(".fg-goal-pill").boundingBox();
      const cardBox = await card.boundingBox();
      check(`${w}: pill inside the card`, pillBox.x >= cardBox.x && pillBox.x + pillBox.width <= cardBox.x + cardBox.width, JSON.stringify({ pillBox, cardBox }));
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${OUT}/${THEME}-done-goal-${width}-mid.png` });
    }
    if (scenario === "stopped") {
      check(`${w}: neutral card`, text.includes("You focused for 12 minutes.") && text.includes("Pick it up whenever you’re ready."), text.replace(/\n/g, " | "));
      for (const absent of [".fg-goal-ring", ".fg-goal-pill", ".fg-goal-dots"]) check(`${w}: no ${absent}`, (await page.locator(absent).count()) === 0);
      const chimeS = await page.evaluate(() => window.__chime.contexts);
      check(`${w}: no chime for a stopped session`, chimeS === 0, String(chimeS));
      const todayText = await page.locator("main, body").first().innerText();
      check(`${w}: Today still shows the stopped line, goal 0%`, todayText.includes("12 min stopped early, not counted toward your goal.") && todayText.includes("0%"));
    } else {
      const chime = await page.evaluate(() => window.__chime);
      check(`${w}: chime rang once: 1 context, 3 sine notes rising and quiet`, chime.contexts === 1 && chime.oscillators === 3 && chime.freqs.every((f) => f.endsWith(":sine")) && chime.peaks.every((p) => p <= 0.08), JSON.stringify(chime));
      await page.reload(); await page.waitForTimeout(500);
      const again = await page.evaluate(() => window.__chime.contexts);
      check(`${w}: not again after a reload`, again === 0, String(again));
      check(`${w}: card still there after a reload`, (await page.locator(".fg-done").count()) === 1);
    }
    await page.waitForTimeout(1800);
    await page.screenshot({ path: `${OUT}/${THEME}-done-${scenario}-${width}.png` });
    if (scenario !== "stopped") {
      await page.getByRole("button", { name: "Dismiss" }).click();
      await page.waitForTimeout(150);
      check(`${w}: dismiss removes the card`, (await page.locator(".fg-done").count()) === 0);
      await page.reload(); await page.waitForTimeout(400);
      check(`${w}: stays dismissed after a reload`, (await page.locator(".fg-done").count()) === 0);
    }
    check(`${w}: no sideways scroll`, await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1));
    check(`${w}: no page errors`, errors.length === 0, errors.join(" | "));
    await ctx.close();
  }
  // Chime off, and reduced motion.
  { const ctx = await browser.newContext({ viewport: { width: 400, height: 760 } });
    const page = await ctx.newPage();
    await page.route("**/icon.png", (r) => r.fulfill({ path: `${S}/public/icon.png`, contentType: "image/png" }));
    await page.addInitScript(stub("goal", false));
    await page.goto("http://127.0.0.1:8765/panel.html"); await page.waitForTimeout(500);
    check("chime off: the card shows and nothing rings", (await page.locator(".fg-done").count()) === 1 && (await page.evaluate(() => window.__chime.contexts)) === 0);
    await ctx.close(); }
  { const ctx = await browser.newContext({ viewport: { width: 400, height: 760 }, reducedMotion: "reduce" });
    const page = await ctx.newPage();
    await page.route("**/icon.png", (r) => r.fulfill({ path: `${S}/public/icon.png`, contentType: "image/png" }));
    await page.addInitScript(stub("goal", true));
    await page.goto("http://127.0.0.1:8765/panel.html"); await page.waitForTimeout(500);
    const dot = await page.locator(".fg-goal-dots__dot").first().evaluate((el) => ({ a: getComputedStyle(el).animationName, o: getComputedStyle(el).opacity }));
    check("reduced motion: dots do not move and stay invisible", dot.a === "none" && dot.o === "0", JSON.stringify(dot));
    const ring = await page.locator(".fg-goal-ring__value").evaluate((el) => getComputedStyle(el).animationName);
    check("reduced motion: ring does not animate, it is just full", ring === "none", ring);
    check("reduced motion: the pill is still there", (await page.locator(".fg-goal-pill").innerText()).trim() === "Daily goal reached");
    await page.screenshot({ path: `${OUT}/${THEME}-done-goal-reduced-motion.png` });
    await ctx.close(); }
  await browser.close();
  const failed = results.filter((ok) => !ok).length;
  console.log(`\n${results.length - failed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();
