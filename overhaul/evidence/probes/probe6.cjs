// Probe 6: on the REPAIRED build, do UI writes ever reach the network layer (DNR)?
//  A) schedule saved via the UI path, window starts ~3 min later: is the boundary alarm re-armed by tick, is DNR installed at start?
//  B) always-site added via UI path: DNR immediately? after a tick?
//  C) always-site REMOVED via UI path after a legit reconcile: does a ghost DNR rule survive a tick?
// Usage: xvfb-run -a node probe6.cjs <distDir> <resultsJson>
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const os = require('os'); const path = require('path');
const [DIST, RESULTS] = process.argv.slice(2);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const R = { steps: {} }; const hits = [];
const server = http.createServer((req, res) => { hits.push({ host: (req.headers.host || '').split(':')[0] }); res.setHeader('content-type', 'text/html'); res.end('<!doctype html><title>Site</title><h1>THE ORIGINAL SITE LOADED</h1>'); });
const hitsFor = (h) => hits.filter((x) => x.host === h).length;
(async () => {
  await new Promise((r) => server.listen(8124, '127.0.0.1', r));
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'fg-profile6-'));
  const ctx = await chromium.launchPersistentContext(profile, { headless: false, args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`, '--host-resolver-rules=MAP *.test 127.0.0.1'], viewport: { width: 900, height: 700 } });
  const sw0 = ctx.serviceWorkers()[0] || (await ctx.waitForEvent('serviceworker', { timeout: 20000 }));
  const extId = new URL(sw0.url()).host;
  const swEval = async (fn, arg) => (ctx.serviceWorkers()[0] || (await ctx.waitForEvent('serviceworker'))).evaluate(fn, arg);
  await sleep(1500);
  await swEval(() => { self.__errs = []; self.addEventListener('unhandledrejection', (e) => self.__errs.push(String((e.reason && e.reason.message) || e.reason))); });
  const ext = await ctx.newPage(); await ext.goto(`chrome-extension://${extId}/panel.html`); await sleep(800);
  const send = (m) => ext.evaluate((msg) => chrome.runtime.sendMessage(msg), m);
  const dnr = () => swEval(async () => (await chrome.declarativeNetRequest.getDynamicRules()).map((r) => ({ id: r.id, domains: r.condition.requestDomains })));
  const boundary = () => swEval(async () => { const a = await chrome.alarms.get('boundary'); return a ? new Date(a.scheduledTime).toTimeString().slice(0, 8) : null; });
  const nav = async (host, label) => {
    const before = hitsFor(host); const p = await ctx.newPage();
    try { await p.goto(`http://${host}:8124/`, { timeout: 8000 }); } catch (e) {}
    await sleep(1200);
    const out = { label, finalIsBlockPage: p.url().includes('blocked.html'), serverHitsDelta: hitsFor(host) - before };
    if (p.url().includes('blocked.html')) out.text = (await p.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ').slice(0, 140);
    await p.close(); return out;
  };
  const hhmm = (d) => String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');

  // ---- A) future schedule saved through the UI path ----
  const t0 = new Date(); const start = new Date(t0.getTime() + 170000); start.setSeconds(0, 0); const end = new Date(start.getTime() + 30 * 60000);
  const sched = { id: 's1', name: 'Later', enabled: true, days: [0, 1, 2, 3, 4, 5, 6], start: hhmm(start), end: hhmm(end), sites: ['sched.test'], keywords: [], useGlobalLists: false };
  R.steps.A_nowIs = t0.toTimeString().slice(0, 8); R.steps.A_scheduleStart = sched.start;
  R.steps.A_write = await send({ type: 'state/write', key: 'schedules', value: [sched] });
  R.steps.A_boundaryRightAfterWrite = await boundary();
  await sleep(66000);
  R.steps.A_boundaryAfterOneTick = await boundary();
  await sleep(Math.max(0, start.getTime() + 8000 - Date.now()));
  R.steps.A_dnrAtStartPlus8s = await dnr();
  R.steps.A_navAtStartPlus8s = await nav('sched.test', 'schedule window just started');

  // ---- B) always-site added through the UI path ----
  R.steps.B_write = await send({ type: 'state/write', key: 'alwaysBlockedSites', value: ['ghost.test'] });
  R.steps.B_dnrImmediately = await dnr();
  R.steps.B_navImmediately = await nav('ghost.test', 'always-site just added (UI path)');

  // ---- C) legit reconcile, then remove via UI path ----
  await send({ type: 'session/start', durationMin: 5, lockLevel: 'none' }); await send({ type: 'session/stop' });
  R.steps.C_dnrAfterReconcile = await dnr();
  R.steps.C_removeWrite = await send({ type: 'state/write', key: 'alwaysBlockedSites', value: [] });
  R.steps.C_dnrRightAfterRemoval = await dnr();
  await sleep(66000);
  R.steps.C_dnrAfterOneTick = await dnr();
  R.steps.C_navAfterRemoval = await nav('ghost.test', 'site removed, one tick later');
  R.steps.errors = await swEval(() => self.__errs);
  fs.writeFileSync(RESULTS, JSON.stringify(R, null, 2));
  await ctx.close(); server.close(); console.log('probe6 done');
})().catch((e) => { console.error('PROBE6 FAILED', e); try { fs.writeFileSync(RESULTS, JSON.stringify({ ...R, fatal: String(e) }, null, 2)); } catch {} process.exit(1); });
