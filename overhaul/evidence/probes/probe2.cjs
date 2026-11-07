// Probe 2: behaviour experiments against the REAL built extension.
// Usage: xvfb-run -a node probe2.cjs <distDir> <shotsDir> <resultsJson>
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

const [DIST, SHOTS, RESULTS] = process.argv.slice(2);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const R = { steps: {} };
const hits = [];

const server = http.createServer((req, res) => {
  hits.push({ t: Date.now(), url: req.url });
  res.setHeader('content-type', 'text/html');
  res.end('<!doctype html><title>News</title><h1>THE ORIGINAL SITE LOADED</h1>');
});

(async () => {
  await new Promise((r) => server.listen(8123, '127.0.0.1', r));
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'fg-profile2-'));
  const ctx = await chromium.launchPersistentContext(profile, {
    headless: false,
    args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`, '--host-resolver-rules=MAP *.test 127.0.0.1'],
    viewport: { width: 1100, height: 760 },
  });
  let sw = ctx.serviceWorkers()[0] || (await ctx.waitForEvent('serviceworker', { timeout: 20000 }));
  const extId = new URL(sw.url()).host;
  const swEval = async (fn, arg) => (ctx.serviceWorkers()[0] || (await ctx.waitForEvent('serviceworker'))).evaluate(fn, arg);

  // --- P0: state of alarms BEFORE we touch anything; install error collector ---
  await sleep(1500);
  R.steps.p0_alarmsAtStart = await swEval(async () => {
    const a = await chrome.alarms.getAll();
    return a.map((x) => ({ name: x.name, in_s: Math.round((x.scheduledTime - Date.now()) / 1000), period: x.periodInMinutes }));
  });
  await swEval(() => {
    self.__errs = [];
    self.addEventListener('unhandledrejection', (e) => self.__errs.push({ at: Date.now(), msg: String((e.reason && e.reason.message) || e.reason) }));
  });
  R.steps.p0_commands = await swEval(async () => (await chrome.commands.getAll()).map((c) => ({ name: c.name, shortcut: c.shortcut })));

  // helper page on the extension origin for sending messages like the real UI does
  const ext = await ctx.newPage();
  await ext.goto(`chrome-extension://${extId}/panel.html`);
  await sleep(800);
  const send = (m) => ext.evaluate((msg) => chrome.runtime.sendMessage(msg), m);
  const dnr = () => swEval(async () => (await chrome.declarativeNetRequest.getDynamicRules()).map((r) => ({ id: r.id, domains: r.condition.requestDomains, excl: r.condition.excludedRequestDomains, action: r.action.type })));
  const storage = (keys) => swEval((k) => chrome.storage.local.get(k), keys);
  const nav = async (url, label) => {
    const before = hits.length;
    const p = await ctx.newPage();
    try { await p.goto(url, { timeout: 8000 }); } catch (e) { /* redirects can abort the goto */ }
    await sleep(1800);
    const out = { label, finalUrl: p.url().replace(extId, '<ext>'), serverHitsDelta: hits.length - before };
    return { page: p, out };
  };

  // --- P3: ADD AN "ALWAYS" SITE (the most basic flow) ---
  R.steps.p3_write = await send({ type: 'state/write', key: 'alwaysBlockedSites', value: ['news.test'] });
  R.steps.p3_dnrAfterWrite = await dnr();
  R.steps.p3_alarmsAfterWrite = await swEval(async () => (await chrome.alarms.getAll()).map((a) => a.name));
  {
    const { page, out } = await nav('http://news.test:8123/', 'always-site, no reconcile yet');
    R.steps.p3_navBeforeReconcile = out;
    await page.close();
  }

  // trigger a legit reconcile (session start/stop) and re-test
  R.steps.p3_sessionStartNone = (await send({ type: 'session/start', durationMin: 5, lockLevel: 'none' })).ok;
  R.steps.p3_dnrAfterReconcile = await dnr();
  {
    const { page, out } = await nav('http://news.test:8123/', 'always-site, after reconcile');
    R.steps.p3_navAfterReconcile = out;
    await page.screenshot({ path: path.join(SHOTS, 'blocked-ACTIVE-always-1100.png') });
    await page.close();
  }
  R.steps.p3_stop = await send({ type: 'session/stop' });

  // --- P2b: REMOVE the site -> is the block still enforced? ---
  R.steps.p2b_write = await send({ type: 'state/write', key: 'alwaysBlockedSites', value: [] });
  R.steps.p2b_dnrAfterRemoval = await dnr();
  {
    const { page, out } = await nav('http://news.test:8123/', 'site REMOVED from list');
    R.steps.p2b_navAfterRemoval = out;
    await page.screenshot({ path: path.join(SHOTS, 'blocked-GHOST-after-removal-1100.png') });
    // click the "Open <site>" button the block page offers
    const openBtn = page.getByRole('button', { name: /^Open news\.test/ }).or(page.getByRole('link', { name: /^Open news\.test/ }));
    if (await openBtn.count()) {
      await openBtn.first().click();
      await sleep(1800);
      R.steps.p2b_afterClickOpen = { finalUrl: page.url().replace(extId, '<ext>') };
    } else R.steps.p2b_afterClickOpen = 'no open button found';
    await page.close();
  }

  // --- P2: SCHEDULE active right now, written through the real guarded path ---
  const sched = { id: 's1', name: 'Work hours', enabled: true, days: [0, 1, 2, 3, 4, 5, 6], start: '00:00', end: '23:59', sites: ['news.test'], keywords: [], useGlobalLists: false };
  R.steps.p2_write = await send({ type: 'state/write', key: 'schedules', value: [sched] });
  R.steps.p2_dnrAfterWrite = await dnr();
  R.steps.p2_alarmsAfterWrite = await swEval(async () => (await chrome.alarms.getAll()).map((a) => ({ name: a.name, in_s: Math.round((a.scheduledTime - Date.now()) / 1000) })));
  {
    const { page, out } = await nav('http://news.test:8123/', 'schedule active, no reconcile');
    R.steps.p2_navNoReconcile = out;
    await page.screenshot({ path: path.join(SHOTS, 'blocked-ACTIVE-schedule-1100.png') });
    await page.close();
  }
  await send({ type: 'state/write', key: 'schedules', value: [] });

  // --- P4: STRICT 1-minute session ---
  await send({ type: 'state/write', key: 'blockedSites', value: ['news.test'] });
  const t0 = Date.now();
  const startRes = await send({ type: 'session/start', durationMin: 1, lockLevel: 'strict' });
  R.steps.p4_start = { ok: startRes.ok, code: startRes.code };
  R.steps.p4_dnrDuring = await dnr();
  R.steps.p4_weakenAttempt = await send({ type: 'state/write', key: 'blockedSites', value: [] });
  R.steps.p4_stopAttempt = await send({ type: 'session/stop' });
  R.steps.p4_extendAttempt = await send({ type: 'session/extend', minutes: 10 });

  {
    const panel = await ctx.newPage();
    await panel.setViewportSize({ width: 400, height: 760 });
    await panel.emulateMedia({ colorScheme: 'dark' });
    await panel.goto(`chrome-extension://${extId}/panel.html`);
    await sleep(1200);
    await panel.screenshot({ path: path.join(SHOTS, 'panel-RUNNING-strict-400.png') });
    // how much does the UI re-render per second while a timer runs?
    R.steps.p4_mutations5s = await panel.evaluate(() => new Promise((res) => {
      let n = 0; const tgt = {};
      const mo = new MutationObserver((list) => { n += list.length; for (const m of list) { const el = m.target.nodeType === 1 ? m.target : m.target.parentElement; const k = (el && (el.className && el.className.baseVal === undefined ? el.className : el.tagName)) || '?'; tgt[k] = (tgt[k] || 0) + 1; } });
      mo.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
      setTimeout(() => { mo.disconnect(); res({ mutations: n, top: Object.entries(tgt).sort((a, b) => b[1] - a[1]).slice(0, 5) }); }, 5000);
    }));
    await panel.close();
  }
  {
    const { page, out } = await nav('http://news.test:8123/', 'strict session running');
    R.steps.p4_navDuring = out;
    await page.setViewportSize({ width: 1000, height: 700 });
    await page.emulateMedia({ colorScheme: 'dark' });
    await sleep(500);
    await page.screenshot({ path: path.join(SHOTS, 'blocked-ACTIVE-session-1000.png') });
    await page.setViewportSize({ width: 380, height: 700 });
    await sleep(300);
    await page.screenshot({ path: path.join(SHOTS, 'blocked-ACTIVE-session-380.png') });
    await page.close();
  }

  // wait until well after the 1-minute phase should have ended
  const waitMs = Math.max(0, t0 + 78000 - Date.now());
  await sleep(waitMs);

  R.steps.p4_after = await swEval(async () => {
    const s = await chrome.storage.local.get(['session', 'sessionHistory', 'dayStats', 'health', 'usage']);
    return {
      now: Date.now(),
      status: s.session.status, phaseEndsAt: s.session.phaseEndsAt, overdue_s: Math.round((Date.now() - s.session.phaseEndsAt) / 1000),
      lockLevel: s.session.lockLevel, historyLen: s.sessionHistory.length, dayStatsKeys: Object.keys(s.dayStats), health: s.health,
    };
  });
  R.steps.p4_weakenAfterEnd = await send({ type: 'state/write', key: 'blockedSites', value: [] });
  {
    const panel = await ctx.newPage();
    await panel.setViewportSize({ width: 400, height: 760 });
    await panel.emulateMedia({ colorScheme: 'dark' });
    await panel.goto(`chrome-extension://${extId}/panel.html`);
    await sleep(1500);
    await panel.screenshot({ path: path.join(SHOTS, 'panel-AFTER-timer-end-400.png') });
    R.steps.p4_panelTimerText = await panel.evaluate(() => (document.querySelector('.fg-hero__time') || {}).textContent || null);
    await panel.close();
  }
  {
    const { page, out } = await nav('http://news.test:8123/', 'after strict timer ended');
    R.steps.p4_navAfterEnd = out;
    await page.close();
  }
  R.steps.p4_naturalAlarmErrors = await swEval(() => self.__errs);
  R.steps.p4_alarmsNow = await swEval(async () => (await chrome.alarms.getAll()).map((a) => ({ name: a.name, in_s: Math.round((a.scheduledTime - Date.now()) / 1000), period: a.periodInMinutes })));

  // P5: user comes back and presses Start again -> does the old session finally get recorded?
  R.steps.p5_startAgain = (await send({ type: 'session/start', durationMin: 5, lockLevel: 'none' })).ok;
  R.steps.p5_after = await swEval(async () => {
    const s = await chrome.storage.local.get(['sessionHistory', 'dayStats']);
    return { history: s.sessionHistory.map((r) => ({ status: r.status, elapsed_s: Math.round(r.elapsedMs / 1000), planned_s: Math.round(r.plannedMs / 1000), endedAgo_s: Math.round((Date.now() - r.endedAt) / 1000) })), dayStats: s.dayStats };
  });
  await send({ type: 'session/stop' });

  fs.writeFileSync(RESULTS, JSON.stringify(R, null, 2));
  await ctx.close(); server.close();
  console.log('probe2 done');
})().catch((e) => { console.error('PROBE2 FAILED', e); try { fs.writeFileSync(RESULTS, JSON.stringify({ ...R, fatal: String(e) }, null, 2)); } catch {} process.exit(1); });
