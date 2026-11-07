// Probe 1: load the REAL built extension in Chromium, reproduce the alarm crash,
// capture first-run state, screenshots (both themes, several widths) and axe results.
// Usage: xvfb-run -a node probe1.cjs <distDir> <shotsDir> <resultsJson>
const { chromium } = require('playwright');
const fs = require('fs');
const os = require('os');
const path = require('path');

const [DIST, SHOTS, RESULTS] = process.argv.slice(2);
const AXE = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = { notes: [] };

(async () => {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'fg-profile-'));
  const ctx = await chromium.launchPersistentContext(profile, {
    headless: false,
    args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`],
    viewport: { width: 1100, height: 760 },
  });

  let sw = ctx.serviceWorkers()[0];
  if (!sw) sw = await ctx.waitForEvent('serviceworker', { timeout: 20000 });
  const extId = new URL(sw.url()).host;
  results.extId = extId;
  const swEval = async (fn, arg) => {
    const w = ctx.serviceWorkers()[0] || (await ctx.waitForEvent('serviceworker', { timeout: 15000 }));
    return w.evaluate(fn, arg);
  };

  // ---------- E1: reproduce the alarm crash ----------
  await sleep(1500); // let onInstalled finish
  await swEval(() => {
    self.__errs = [];
    self.__alarmArgs = [];
    self.addEventListener('unhandledrejection', (e) =>
      self.__errs.push(String((e.reason && e.reason.message) || e.reason)));
    self.addEventListener('error', (e) => self.__errs.push('error: ' + e.message));
    chrome.alarms.onAlarm.addListener((a) =>
      self.__alarmArgs.push({ type: typeof a, keys: a && typeof a === 'object' ? Object.keys(a) : null }));
  });
  await swEval(() => chrome.alarms.create('tick', { when: Date.now() + 700 }));
  await sleep(2500);
  results.alarmCrash = await swEval(() => ({ errs: self.__errs, alarmArgs: self.__alarmArgs }));

  // ---------- E2: fresh-install state ----------
  results.fresh = await swEval(async () => {
    const all = await chrome.storage.local.get(null);
    const alarms = await chrome.alarms.getAll();
    const rules = await chrome.declarativeNetRequest.getDynamicRules();
    return {
      storageKeys: Object.keys(all).sort(),
      storageBytes: JSON.stringify(all).length,
      health: all.health,
      alarms: alarms.map((a) => ({ name: a.name, in_s: Math.round((a.scheduledTime - Date.now()) / 1000), period: a.periodInMinutes })),
      dnrRules: rules.length,
    };
  });
  results.tabsOpenAfterInstall = ctx.pages().map((p) => p.url());

  // ---------- visual + a11y sweep ----------
  const matrix = [
    { name: 'panel', url: `chrome-extension://${extId}/panel.html`, sizes: [[400, 760], [320, 640]] },
    { name: 'dash-overview', url: `chrome-extension://${extId}/dashboard.html`, sizes: [[1280, 800], [640, 800]] },
    { name: 'dash-rules', url: `chrome-extension://${extId}/dashboard.html#rules`, sizes: [[1280, 800]] },
    { name: 'dash-reports', url: `chrome-extension://${extId}/dashboard.html#reports`, sizes: [[1280, 800]] },
    { name: 'dash-settings', url: `chrome-extension://${extId}/dashboard.html#settings`, sizes: [[1280, 800]] },
    { name: 'dash-data', url: `chrome-extension://${extId}/dashboard.html#data`, sizes: [[1280, 800]] },
    { name: 'blocked', url: `chrome-extension://${extId}/blocked.html#http://news.test:8123/some/page`, sizes: [[1000, 700], [380, 700]] },
    { name: 'blocked-nohash', url: `chrome-extension://${extId}/blocked.html`, sizes: [[1000, 700]] },
    { name: 'onboarding', url: `chrome-extension://${extId}/onboarding.html`, sizes: [[1000, 700], [380, 700]] },
  ];
  results.pages = [];
  for (const m of matrix) {
    for (const [w, h] of m.sizes) {
      for (const scheme of ['dark', 'light']) {
        // light theme only for the primary size to keep the run short
        if (scheme === 'light' && (w === 320 || w === 640 || (w === 380 && m.name !== 'blocked'))) continue;
        const page = await ctx.newPage();
        const logs = [];
        page.on('console', (msg) => { if (['error', 'warning'].includes(msg.type())) logs.push(msg.type() + ': ' + msg.text().slice(0, 240)); });
        page.on('pageerror', (err) => logs.push('pageerror: ' + String(err.message).slice(0, 240)));
        await page.setViewportSize({ width: w, height: h });
        await page.emulateMedia({ colorScheme: scheme });
        await page.goto(m.url);
        await sleep(900);
        const tag = `${m.name}-${w}x${h}-${scheme}`;
        await page.screenshot({ path: path.join(SHOTS, tag + '.png'), fullPage: true });
        const info = await page.evaluate(() => ({
          title: document.title,
          lang: document.documentElement.lang,
          dataTheme: document.documentElement.getAttribute('data-theme'),
          hScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth,
          scrollW: document.documentElement.scrollWidth,
          bodyBg: getComputedStyle(document.body).backgroundColor,
          fontFamily: getComputedStyle(document.body).fontFamily.slice(0, 120),
          fontSize: getComputedStyle(document.body).fontSize,
          h1: [...document.querySelectorAll('h1')].map((e) => e.textContent.trim().slice(0, 60)),
          buttons: document.querySelectorAll('button').length,
          imgsNoAlt: [...document.querySelectorAll('img')].filter((i) => !i.hasAttribute('alt')).length,
        }));
        let axe = null;
        try {
          await page.evaluate(AXE);
          axe = await page.evaluate(async () => {
            const r = await window.axe.run(document, { resultTypes: ['violations'] });
            return r.violations.map((v) => ({
              id: v.id, impact: v.impact, n: v.nodes.length, help: v.help,
              sample: v.nodes.slice(0, 2).map((n) => ({ target: n.target.join(' '), summary: (n.failureSummary || '').split('\n').slice(0, 3).join(' | ').slice(0, 260) })),
            }));
          });
        } catch (e) { axe = 'axe failed: ' + e.message; }
        results.pages.push({ tag, info, logs, axe });
        await page.close();
      }
    }
  }

  // ---------- per-tab panel shots, tall viewport so nothing is cut ----------
  for (const tab of ['focus', 'rules', 'you']) {
    const page = await ctx.newPage();
    await page.setViewportSize({ width: 400, height: 1900 });
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto(`chrome-extension://${extId}/panel.html`);
    await sleep(700);
    const t = page.locator(`#panel-${tab}-tab`);
    if (await t.count()) await t.click();
    await sleep(600);
    await page.screenshot({ path: path.join(SHOTS, `panel-tab-${tab}-400-tall-dark.png`) });
    await page.close();
  }

  fs.writeFileSync(RESULTS, JSON.stringify(results, null, 2));
  await ctx.close();
  console.log('probe1 done');
})().catch((e) => { console.error('PROBE FAILED', e); try { fs.writeFileSync(RESULTS, JSON.stringify({ ...results, fatal: String(e) }, null, 2)); } catch {} process.exit(1); });
