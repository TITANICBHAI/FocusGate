// Probe 3 (clean): schedule that ENDS mid-run + 1-minute strict session that ENDS, no extension.
// Usage: xvfb-run -a node probe3.cjs <distDir> <shotsDir> <resultsJson>
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
  hits.push({ host: (req.headers.host || '').split(':')[0], url: req.url, t: Date.now() });
  res.setHeader('content-type', 'text/html');
  res.end('<!doctype html><title>Site</title><h1>THE ORIGINAL SITE LOADED</h1>');
});
const hitsFor = (h) => hits.filter((x) => x.host === h).length;

(async () => {
  await new Promise((r) => server.listen(8123, '127.0.0.1', r));
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'fg-profile3-'));
  const ctx = await chromium.launchPersistentContext(profile, {
    headless: false,
    args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`, '--host-resolver-rules=MAP *.test 127.0.0.1'],
    viewport: { width: 1100, height: 900 },
  });
  const sw0 = ctx.serviceWorkers()[0] || (await ctx.waitForEvent('serviceworker', { timeout: 20000 }));
  const extId = new URL(sw0.url()).host;
  const swEval = async (fn, arg) => (ctx.serviceWorkers()[0] || (await ctx.waitForEvent('serviceworker'))).evaluate(fn, arg);
  await sleep(1500);
  await swEval(() => { self.__errs = []; self.addEventListener('unhandledrejection', (e) => self.__errs.push({ at: Date.now(), msg: String((e.reason && e.reason.message) || e.reason) })); });

  const ext = await ctx.newPage();
  await ext.goto(`chrome-extension://${extId}/panel.html`);
  await sleep(800);
  const send = (m) => ext.evaluate((msg) => chrome.runtime.sendMessage(msg), m);
  const dnr = () => swEval(async () => (await chrome.declarativeNetRequest.getDynamicRules()).map((r) => ({ id: r.id, domains: r.condition.requestDomains })));
  const alarms = () => swEval(async () => (await chrome.alarms.getAll()).map((a) => ({ name: a.name, in_s: Math.round((a.scheduledTime - Date.now()) / 1000), period: a.periodInMinutes })));
  const nav = async (host, label, shot) => {
    const before = hitsFor(host);
    const p = await ctx.newPage();
    await p.setViewportSize({ width: 1000, height: 700 });
    await p.emulateMedia({ colorScheme: 'dark' });
    try { await p.goto(`http://${host}:8123/`, { timeout: 8000 }); } catch (e) {}
    await sleep(1500);
    const out = { label, finalUrl: p.url().replace(extId, '<ext>'), serverHitsDelta: hitsFor(host) - before };
    if (p.url().includes('blocked.html')) {
      out.blockPageText = (await p.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ').trim().slice(0, 300);
      if (shot) await p.screenshot({ path: path.join(SHOTS, shot) });
    }
    await p.close();
    return out;
  };

  // ---------- schedule window: started 3 min ago, ends in 1-2 min ----------
  const now = new Date();
  const hhmm = (d) => String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  const sStart = new Date(now.getTime() - 3 * 60000);
  const sEnd = new Date(now.getTime() + 2 * 60000); sEnd.setSeconds(0, 0);
  const sched = { id: 's1', name: 'Deep work', enabled: true, days: [0, 1, 2, 3, 4, 5, 6], start: hhmm(sStart), end: hhmm(sEnd), sites: ['sched.test'], keywords: [], useGlobalLists: false };
  R.steps.s1_schedule = { start: sched.start, end: sched.end, expectedEnd_in_s: Math.round((sEnd.getTime() - Date.now()) / 1000) };
  R.steps.s1_write = await send({ type: 'state/write', key: 'schedules', value: [sched] });
  R.steps.s1_dnr = await dnr();
  R.steps.s1_alarms = await alarms();
  R.steps.s1_nav = await nav('sched.test', 'schedule active, written via UI path', 'blocked-ACTIVE-schedule-clean.png');

  // ---------- strict 1-min session ----------
  await send({ type: 'state/write', key: 'blockedSites', value: ['focus.test'] });
  const tStart = Date.now();
  R.steps.s2_start = (await send({ type: 'session/start', durationMin: 1, lockLevel: 'strict' })).ok;
  R.steps.s2_dnrAfterStart = await dnr();
  R.steps.s2_alarmsAfterStart = await alarms();

  // real UI while locked: Rules tab, try to remove the site
  {
    const page = await ctx.newPage();
    await page.setViewportSize({ width: 400, height: 900 });
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto(`chrome-extension://${extId}/panel.html`);
    await sleep(800);
    await page.locator('#panel-rules-tab').click();
    await sleep(500);
    await page.screenshot({ path: path.join(SHOTS, 'panel-RULES-while-strict-locked.png') });
    const rm = page.getByRole('button', { name: /remove/i }).first();
    if (await rm.count()) {
      R.steps.s2_removeBtn = { aria: await rm.getAttribute('aria-label'), disabled: await rm.isDisabled(), title: await rm.getAttribute('title') };
      R.steps.s2_lockTextVisibleOnRulesTab = /locked/i.test(await page.evaluate(() => document.body.innerText));
    } else {
      R.steps.s2_removeBtnName = 'NO REMOVE BUTTON FOUND';
      R.steps.s2_buttons = await page.evaluate(() => [...document.querySelectorAll('button')].map((b) => (b.getAttribute('aria-label') || b.textContent || '').trim()).slice(0, 25));
    }
    await page.close();
  }

  // ---------- wait for the session phase to be overdue by ~8s ----------
  await sleep(Math.max(0, tStart + 68000 - Date.now()));
  R.steps.s3_afterSessionEnd = await swEval(async () => {
    const s = await chrome.storage.local.get(['session', 'sessionHistory', 'dayStats']);
    return { status: s.session.status, overdue_s: Math.round((Date.now() - s.session.phaseEndsAt) / 1000), lockLevel: s.session.lockLevel, historyLen: s.sessionHistory.length, dayStats: s.dayStats };
  });
  R.steps.s3_weakenAfterEnd = await send({ type: 'state/write', key: 'blockedSites', value: [] });
  R.steps.s3_dnr = await dnr();
  R.steps.s3_alarms = await alarms();
  {
    const page = await ctx.newPage();
    await page.setViewportSize({ width: 400, height: 760 });
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto(`chrome-extension://${extId}/panel.html`);
    await sleep(1500);
    R.steps.s3_panelTimer = await page.evaluate(() => (document.querySelector('.fg-hero__time') || {}).textContent || null);
    R.steps.s3_panelText = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ').slice(0, 260);
    await page.screenshot({ path: path.join(SHOTS, 'panel-AFTER-session-end-clean.png') });
    await page.close();
  }
  R.steps.s3_navFocusSite = await nav('focus.test', 'strict session phase is overdue', 'blocked-AFTER-session-end.png');

  // ---------- wait until the schedule window is over by ~20s ----------
  await sleep(Math.max(0, sEnd.getTime() + 20000 - Date.now()));
  R.steps.s4_scheduleOverBy_s = Math.round((Date.now() - sEnd.getTime()) / 1000);
  R.steps.s4_dnr = await dnr();
  R.steps.s4_alarms = await alarms();
  R.steps.s4_navSchedSite = await nav('sched.test', 'schedule window has ENDED', 'blocked-AFTER-schedule-end.png');
  R.steps.s4_naturalErrors = await swEval(() => self.__errs);

  fs.writeFileSync(RESULTS, JSON.stringify(R, null, 2));
  await ctx.close(); server.close();
  console.log('probe3 done');
})().catch((e) => { console.error('PROBE3 FAILED', e); try { fs.writeFileSync(RESULTS, JSON.stringify({ ...R, fatal: String(e) }, null, 2)); } catch {} process.exit(1); });
