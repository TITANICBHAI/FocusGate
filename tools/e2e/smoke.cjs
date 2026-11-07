// FocusGate built-extension smoke test.  Loads the REAL dist/ in Chromium and fails on anything that crashes.
//
//   xvfb-run -a node tools/e2e/smoke.cjs dist            # fast checks (about 40 s)
//   xvfb-run -a node tools/e2e/smoke.cjs dist --a11y     # + axe: fail on critical/serious
//   xvfb-run -a node tools/e2e/smoke.cjs dist --slow     # + a 1-minute session must finish (about +75 s)
//   xvfb-run -a node tools/e2e/smoke.cjs dist --engine   # + UI edits must reach the network blocker within 1 s (red until T1.1)
//
// Needs `playwright` (and `axe-core` for --a11y) resolvable from this folder or NODE_PATH:
//   mkdir /tmp/fg-e2e && cd /tmp/fg-e2e && npm i playwright axe-core && export NODE_PATH=/tmp/fg-e2e/node_modules
// (kept OUTSIDE the repo on purpose: the project rule is "no new dependencies".)
// On a desktop with a display you can drop `xvfb-run -a`.
const { chromium } = require('playwright');
const fs = require('fs'); const os = require('os'); const path = require('path');
const DIST = path.resolve(process.argv[2] || 'dist');
const A11Y = process.argv.includes('--a11y'); const SLOW = process.argv.includes('--slow'); const ENGINE = process.argv.includes('--engine');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const failures = []; const passes = [];
const check = (name, ok, detail = '') => { (ok ? passes : failures).push(name + (ok || !detail ? '' : ' -> ' + detail)); };

(async () => {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'fg-smoke-'));
  const ctx = await chromium.launchPersistentContext(profile, { headless: false, args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`], viewport: { width: 1280, height: 800 } });
  const sw0 = ctx.serviceWorkers()[0] || (await ctx.waitForEvent('serviceworker', { timeout: 20000 }));
  const extId = new URL(sw0.url()).host;
  const swEval = async (fn, arg) => (ctx.serviceWorkers()[0] || (await ctx.waitForEvent('serviceworker'))).evaluate(fn, arg);
  await sleep(1500);
  await swEval(() => { self.__errs = []; self.addEventListener('unhandledrejection', (e) => self.__errs.push(String((e.reason && e.reason.message) || e.reason))); self.addEventListener('error', (e) => self.__errs.push('error: ' + e.message)); });

  // 1) alarm contract: Chrome hands the listener an Alarm OBJECT; every handler must cope.
  await swEval(() => { chrome.alarms.create('tick', { when: Date.now() + 500 }); chrome.alarms.create('boundary', { when: Date.now() + 700 }); });
  await sleep(2500);
  const swErrs = await swEval(() => self.__errs);
  check('service worker: alarms fire without errors', swErrs.length === 0, swErrs.join(' | '));
  const cmds = await swEval(async () => (await chrome.commands.getAll()).map((c) => c.name + '=' + (c.shortcut || 'UNASSIGNED')));
  console.log('commands:', cmds.join(', '));

  // 2) every surface renders with no page errors
  async function visit(name, url, w, h, act) {
    const page = await ctx.newPage(); const errs = [];
    page.on('pageerror', (e) => errs.push('pageerror: ' + e.message.slice(0, 160)));
    page.on('console', (m) => { if (m.type() === 'error') errs.push('console.error: ' + m.text().slice(0, 160)); });
    await page.setViewportSize({ width: w, height: h });
    await page.goto(url); await sleep(900);
    let extra = '';
    if (act) { try { extra = (await act(page)) || ''; } catch (e) { errs.push('action failed: ' + String(e.message).slice(0, 160)); } }
    await sleep(300);
    const blank = (await page.evaluate(() => document.body.innerText.trim().length)) === 0;
    const crashed = await page.evaluate(() => /could not start|hit a problem/i.test(document.body.innerText)); // both crash-screen wordings (see T0.6)
    check(`${name}: no errors`, errs.length === 0, errs.join(' | '));
    check(`${name}: not blank / not the crash screen`, !blank && !crashed, blank ? 'blank page' : crashed ? '"could not start" screen' : '');
    if (extra) check(name + ': ' + extra.split('|')[0], extra.split('|')[1] === 'ok', extra.split('|')[2] || '');
    if (A11Y) {
      try {
        await page.evaluate(fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8'));
        const v = await page.evaluate(async () => (await window.axe.run(document, { resultTypes: ['violations'] })).violations.filter((x) => ['critical', 'serious'].includes(x.impact)).map((x) => x.id + '(' + x.nodes.length + ')'));
        check(`${name}: axe critical/serious`, v.length === 0, v.join(', '));
      } catch (e) { check(name + ': axe ran', false, e.message); }
    }
    await page.close();
  }
  const P = `chrome-extension://${extId}/panel.html`; const D = `chrome-extension://${extId}/dashboard.html`;
  await visit('panel/focus', P, 400, 900);
  await visit('panel/you', P, 400, 900, async (p) => { await p.locator('#panel-you-tab').click(); await sleep(400); });
  await visit('panel/rules + Check a URL', P, 400, 900, async (p) => {
    await p.locator('#panel-rules-tab').click(); await sleep(300);
    await p.getByPlaceholder(/Paste any address/i).fill('https://youtube.com/watch?v=abc');
    await p.getByRole('button', { name: /^Check$/ }).click(); await sleep(600);
    const t = await p.evaluate(() => document.body.innerText);
    return 'check-a-url shows an answer|' + (/blocks|allowed|rule|list|limit|schedule/i.test(t) ? 'ok' : 'fail') + '|panel text after click: ' + t.slice(0, 60);
  });
  for (const sub of ['Keywords', 'Schedule', 'Limits']) {
    await visit('panel/rules/' + sub, P, 400, 900, async (p) => { await p.locator('#panel-rules-tab').click(); await sleep(300); await p.locator(`[role=tab]:has-text("${sub}"), button:has-text("${sub}")`).first().click(); await sleep(300); });
  }
  for (const tab of ['', '#rules', '#reports', '#settings', '#data']) await visit('dashboard' + (tab || '#overview'), D + tab, 1280, 800);
  await visit('dashboard@640', D, 640, 800);
  await visit('blocked page', `chrome-extension://${extId}/blocked.html#http://example.test/`, 1000, 700);
  await visit('onboarding', `chrome-extension://${extId}/onboarding.html`, 1000, 700);

  // 3) optional: a 1-minute session must FINISH (history entry written, lock released)
  if (SLOW) {
    const ext = await ctx.newPage(); await ext.goto(P); await sleep(600);
    const send = (m) => ext.evaluate((msg) => chrome.runtime.sendMessage(msg), m);
    await send({ type: 'state/write', key: 'blockedSites', value: ['focus.test'] });
    const started = await send({ type: 'session/start', durationMin: 1, lockLevel: 'strict' });
    check('slow: strict 1-min session starts', started && started.ok === true, JSON.stringify(started));
    await sleep(70000);
    const after = await swEval(async () => { const s = await chrome.storage.local.get(['session', 'sessionHistory']); return { status: s.session.status, history: s.sessionHistory.length }; });
    check('slow: finished session is recorded', after.history === 1, JSON.stringify(after));
    check('slow: session left the work phase', after.status !== 'work', JSON.stringify(after));
    const weaken = await send({ type: 'state/write', key: 'blockedSites', value: [] });
    check('slow: rules editable again after the timer', weaken && weaken.ok === true, JSON.stringify(weaken));
  }
  // 4) optional: UI edits must reach the network-level blocker at once (no waiting for a timer tick).
  //    Expected RED until plan task T1.1 is done; GREEN afterwards.
  if (ENGINE) {
    const ext = await ctx.newPage(); await ext.goto(P); await sleep(600);
    const send = (m) => ext.evaluate((msg) => chrome.runtime.sendMessage(msg), m);
    const blocked = () => swEval(async () => (await chrome.declarativeNetRequest.getDynamicRules()).flatMap((r) => r.condition.requestDomains || []));
    await send({ type: 'state/write', key: 'alwaysBlockedSites', value: ['engine-a.test'] }); await sleep(800);
    check('engine: an added site is blocked at the network layer within 1 s', (await blocked()).includes('engine-a.test'), 'rules: ' + JSON.stringify(await blocked()));
    await send({ type: 'session/start', durationMin: 5, lockLevel: 'none' }); await send({ type: 'session/stop' }); // forces a legit reconcile so the rule exists
    await send({ type: 'state/write', key: 'alwaysBlockedSites', value: [] }); await sleep(800);
    check('engine: a removed site stops being blocked within 1 s (no ghost rule)', !(await blocked()).includes('engine-a.test'), 'rules: ' + JSON.stringify(await blocked()));
    const sched = { id: 'e1', name: 'Engine test', enabled: true, days: [0, 1, 2, 3, 4, 5, 6], start: '00:00', end: '23:59', sites: ['engine-b.test'], keywords: [], useGlobalLists: false };
    await send({ type: 'state/write', key: 'schedules', value: [sched] }); await sleep(800);
    check('engine: a schedule that is active now blocks at the network layer within 1 s', (await blocked()).includes('engine-b.test'), 'rules: ' + JSON.stringify(await blocked()));
    await send({ type: 'session/start', durationMin: 5, lockLevel: 'none' }); await send({ type: 'session/stop' }); // legit reconcile, so the schedule rule really exists before we delete it
    await send({ type: 'state/write', key: 'schedules', value: [] }); await sleep(800);
    check('engine: deleting that schedule lifts its rule within 1 s', !(await blocked()).includes('engine-b.test'), 'rules: ' + JSON.stringify(await blocked()));
    await ext.close();
  }

  const finalErrs = await swEval(() => self.__errs);
  check('service worker: no errors during the whole run', finalErrs.length === 0, finalErrs.join(' | '));

  await ctx.close();
  console.log(`\nPASS ${passes.length}  FAIL ${failures.length}`);
  failures.forEach((f) => console.log('  FAIL  ' + f));
  process.exit(failures.length ? 1 : 0);
})().catch((e) => { console.error('SMOKE CRASHED', e); process.exit(2); });
