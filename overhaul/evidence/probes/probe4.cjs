// Probe 4: with the alarm adapter fixed, do the OTHER alarm handlers work?
// Usage: xvfb-run -a node probe4.cjs <distDir> <resultsJson>
const { chromium } = require('playwright');
const fs = require('fs'); const os = require('os'); const path = require('path');
const [DIST, RESULTS] = process.argv.slice(2);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const R = {};
(async () => {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'fg-profile4-'));
  const ctx = await chromium.launchPersistentContext(profile, { headless: false, args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`], viewport: { width: 900, height: 700 } });
  const sw0 = ctx.serviceWorkers()[0] || (await ctx.waitForEvent('serviceworker', { timeout: 20000 }));
  const extId = new URL(sw0.url()).host;
  const swEval = async (fn, arg) => (ctx.serviceWorkers()[0] || (await ctx.waitForEvent('serviceworker'))).evaluate(fn, arg);
  await sleep(1500);
  await swEval(() => { self.__errs = []; self.addEventListener('unhandledrejection', (e) => self.__errs.push(String((e.reason && e.reason.message) || e.reason))); });
  const ext = await ctx.newPage();
  await ext.goto(`chrome-extension://${extId}/panel.html`); await sleep(800);
  const send = (m) => ext.evaluate((msg) => chrome.runtime.sendMessage(msg), m);

  // seed a task that "starts" now so a reminder can find it
  const task = { id: 't1', title: 'Write report', durationMin: 25, scheduledDate: '2026-11-03', scheduledTime: '09:00', priority: 'high', tags: [], recurring: 'none', lockLevel: 'none', completed: false, createdAt: Date.now() };
  R.taskWrite = await send({ type: 'state/write', key: 'tasks', value: [task] });
  R.tasksChangedMsg = await send({ type: 'tasks/changed' });
  R.taskAlarmsAfterTasksChanged = await swEval(async () => (await chrome.alarms.getAll()).filter((a) => a.name.startsWith('task-reminder')).length);

  // fire each remaining handler once, 1s from now
  await swEval(() => {
    const t = Date.now() + 1000;
    chrome.alarms.create('midnight', { when: t });
    chrome.alarms.create('weekly_report', { when: t + 200 });
    chrome.alarms.create('task-reminder:' + encodeURIComponent('t1:at-start:manual'), { when: t + 400 });
  });
  await sleep(5000);
  R.errorsAfterFiring = await swEval(() => self.__errs);
  R.afterState = await swEval(async () => {
    const s = await chrome.storage.local.get(['weeklyReports', 'lastWeeklyReport', 'achievements', 'health', 'dayStats']);
    const notes = await new Promise((res) => chrome.notifications.getAll(res));
    return { weeklyReports: (s.weeklyReports || []).length, hasLastWeekly: !!s.lastWeeklyReport, achievements: s.achievements.length, healthErr: s.health.lastError, notificationIds: Object.keys(notes) };
  });
  R.alarmsNow = await swEval(async () => (await chrome.alarms.getAll()).map((a) => a.name));
  fs.writeFileSync(RESULTS, JSON.stringify(R, null, 2));
  await ctx.close(); console.log('probe4 done');
})().catch((e) => { console.error('PROBE4 FAILED', e); try { fs.writeFileSync(RESULTS, JSON.stringify({ ...R, fatal: String(e) }, null, 2)); } catch {} process.exit(1); });
