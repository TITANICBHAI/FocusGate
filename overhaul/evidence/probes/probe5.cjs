// Probe 5: render the repaired build: dashboard (fresh + seeded), schedule UI, profile (You) tab.
// Usage: xvfb-run -a node probe5.cjs <distDir> <shotsDir> <resultsJson>
const { chromium } = require('playwright');
const fs = require('fs'); const os = require('os'); const path = require('path');
const [DIST, SHOTS, RESULTS] = process.argv.slice(2);
const AXE = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const R = { pages: [] };

(async () => {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'fg-profile5-'));
  const ctx = await chromium.launchPersistentContext(profile, { headless: false, args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`], viewport: { width: 1280, height: 800 } });
  const sw0 = ctx.serviceWorkers()[0] || (await ctx.waitForEvent('serviceworker', { timeout: 20000 }));
  const extId = new URL(sw0.url()).host;
  const swEval = async (fn, arg) => (ctx.serviceWorkers()[0] || (await ctx.waitForEvent('serviceworker'))).evaluate(fn, arg);
  await sleep(1500);

  async function shot(name, url, w, h, scheme, opts = {}) {
    const page = await ctx.newPage();
    const logs = [];
    page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) logs.push(m.type() + ': ' + m.text().slice(0, 200)); });
    page.on('pageerror', (e) => logs.push('pageerror: ' + String(e.message).slice(0, 200)));
    await page.setViewportSize({ width: w, height: h });
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto(url); await sleep(900);
    if (opts.before) await opts.before(page);
    await sleep(500);
    await page.screenshot({ path: path.join(SHOTS, name + '.png'), fullPage: opts.fullPage !== false });
    let axe = null;
    if (opts.axe) {
      try {
        await page.evaluate(AXE);
        axe = await page.evaluate(async () => (await window.axe.run(document, { resultTypes: ['violations'] })).violations.map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length, sample: v.nodes.slice(0, 2).map((n) => n.target.join(' ') + ' :: ' + (n.failureSummary || '').split('\n').slice(0, 2).join(' | ').slice(0, 200)) })));
      } catch (e) { axe = 'axe failed ' + e.message; }
    }
    const info = await page.evaluate(() => ({ h1: [...document.querySelectorAll('h1')].map((e) => e.textContent.trim()).slice(0, 3), text: document.body.innerText.replace(/\s+/g, ' ').slice(0, 700), hScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth }));
    R.pages.push({ name, logs, axe, info });
    await page.close();
  }
  const D = `chrome-extension://${extId}/dashboard.html`;
  const P = `chrome-extension://${extId}/panel.html`;

  // ---- FRESH (no data) ----
  for (const tab of ['', '#rules', '#reports', '#settings', '#data']) {
    await shot(`fx-dash-fresh${tab.replace('#', '-') || '-overview'}-dark`, D + tab, 1280, 800, 'dark', { axe: tab === '' || tab === '#settings' });
  }

  // ---- SEED realistic data ----
  await swEval(async () => {
    const now = Date.now();
    const key = (d) => { const t = new Date(now - d * 86400000); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`; };
    const mins = [95, 60, 130, 0, 45, 80, 110, 70, 0, 150, 40, 85, 65, 100];
    const dayStats = {};
    mins.forEach((m, d) => { if (!m) return; dayStats[key(d)] = { dateKey: key(d), focusMs: m * 60000, sessionsCompleted: Math.ceil(m / 25), sessionsAbandoned: d % 4 === 0 ? 1 : 0, blocks: 3 + ((d * 7) % 11), blocksByDomain: { 'youtube.com': 2 + (d % 3), 'reddit.com': 1 + (d % 4), 'x.com': d % 2 }, tasksCompleted: d % 3 }; });
    const sessionHistory = Array.from({ length: 12 }, (_, i) => { const end = now - i * 43200000 - 600000; const planned = 25 * 60000; const ab = i % 5 === 4; return { id: 'r' + i, startedAt: end - planned, endedAt: end, plannedMs: planned, elapsedMs: ab ? 9 * 60000 : planned, status: ab ? 'abandoned' : 'completed', lockLevel: i % 3 === 0 ? 'strict' : 'none', blockedAttempts: i % 4, gaps: [] }; });
    await chrome.storage.local.set({
      dayStats, sessionHistory,
      recentBlocks: [{ domain: 'youtube.com', reason: 'session', at: now - 3600000 }, { domain: 'reddit.com', reason: 'schedule', at: now - 7200000 }, { domain: 'x.com', reason: 'always', at: now - 9000000 }],
      blockedSites: ['youtube.com', 'reddit.com', 'x.com'], alwaysBlockedSites: ['tiktok.com'],
      schedules: [{ id: 's1', name: 'Study hours', enabled: true, days: [1, 2, 3, 4, 5], start: '09:00', end: '12:00', sites: ['instagram.com', 'netflix.com'], keywords: ['gossip'], useGlobalLists: true }, { id: 's2', name: 'Night wind-down', enabled: false, days: [0, 1, 2, 3, 4, 5, 6], start: '22:00', end: '06:30', sites: ['youtube.com'], keywords: [], useGlobalLists: false }],
      allowances: { 'youtube.com': { mode: 'time_budget', limitMin: 30, duringBlocks: false } },
      usage: { 'youtube.com': { dateKey: key(0), usedMs: 18 * 60000, opens: 5, windowStartMs: 0, lastActiveAt: now - 600000 } },
      keywords: [{ text: 'gossip', mode: 'both', when: 'always' }],
      tasks: [{ id: 't1', title: 'Write thesis intro', durationMin: 50, scheduledDate: key(0), scheduledTime: '16:00', priority: 'high', tags: [], recurring: 'none', lockLevel: 'none', completed: false, createdAt: now }, { id: 't2', title: 'Revise OS notes', durationMin: 25, scheduledDate: key(0), scheduledTime: '18:30', priority: 'medium', tags: [], recurring: 'daily', lockLevel: 'strict', completed: false, createdAt: now }],
      habits: [{ id: 'h1', name: 'Read 20 pages', emoji: '📚', createdAt: now }], habitEntries: { h1: [key(0), key(1), key(2), key(4)] },
    });
  });
  await sleep(800);

  // ---- SEEDED dashboard ----
  for (const tab of ['', '#rules', '#reports', '#settings', '#data']) {
    await shot(`fx-dash-seed${tab.replace('#', '-') || '-overview'}-dark`, D + tab, 1280, 800, 'dark', { axe: tab === '' });
  }
  await shot('fx-dash-seed-overview-light', D, 1280, 800, 'light');
  await shot('fx-dash-seed-overview-640', D, 640, 800, 'dark');

  // ---- panel: Rules sub-tabs (schedule UX), You tab, Focus ----
  const clickSub = (label) => async (page) => {
    await page.locator('#panel-rules-tab').click(); await sleep(500);
    const t = page.locator(`[role=tab]:has-text("${label}"), button:has-text("${label}")`).first();
    if (await t.count()) await t.click();
  };
  await shot('fx-panel-rules-sites-seed', P, 400, 1400, 'dark', { fullPage: false, before: clickSub('Sites') });
  await shot('fx-panel-rules-schedule-seed', P, 400, 1500, 'dark', { fullPage: false, before: clickSub('Schedule') });
  await shot('fx-panel-rules-limits-seed', P, 400, 1100, 'dark', { fullPage: false, before: clickSub('Limits') });
  await shot('fx-panel-rules-keywords-seed', P, 400, 1000, 'dark', { fullPage: false, before: clickSub('Keywords') });
  await shot('fx-panel-you-seed', P, 400, 2300, 'dark', { fullPage: false, before: async (p) => { await p.locator('#panel-you-tab').click(); } });
  await shot('fx-panel-focus-seed', P, 400, 900, 'dark', { fullPage: false });

  // ---- empty schedule sub-tab (fresh user view) ----
  await swEval(async () => { await chrome.storage.local.set({ schedules: [] }); });
  await shot('fx-panel-rules-schedule-EMPTY', P, 400, 1000, 'dark', { fullPage: false, before: clickSub('Schedule') });

  // ---- "Check a URL" (first card on the Rules tab) ----
  {
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push('pageerror: ' + String(e.message).slice(0, 200)));
    page.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 200)); });
    await page.setViewportSize({ width: 400, height: 900 }); await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto(P); await sleep(800);
    await page.locator('#panel-rules-tab').click(); await sleep(400);
    await page.getByPlaceholder(/Paste any address/i).fill('https://youtube.com/watch?v=abc');
    await page.getByRole('button', { name: /^Check$/ }).click(); await sleep(900);
    R.checkUrl = { errs, text: (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ').slice(0, 420) };
    await page.screenshot({ path: path.join(SHOTS, 'fx-panel-check-url.png') });
    await page.close();
  }

  fs.writeFileSync(RESULTS, JSON.stringify(R, null, 2));
  await ctx.close(); console.log('probe5 done');
})().catch((e) => { console.error('PROBE5 FAILED', e); try { fs.writeFileSync(RESULTS, JSON.stringify({ ...R, fatal: String(e) }, null, 2)); } catch {} process.exit(1); });
