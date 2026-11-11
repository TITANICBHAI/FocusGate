const { chromium } = require("playwright");
const fs = require("fs");
const S = "/tmp/claude-0/-home-claude/1d3d810c-0866-503f-8b36-d437fcdf9427/scratchpad/store";
const defaults = JSON.parse(fs.readFileSync(`${S}/default-state.json`, "utf8"));
const init = `(() => { const defaults = ${JSON.stringify(defaults)}; for (const [k, v] of Object.entries(defaults)) { if (localStorage.getItem(k) === null) localStorage.setItem(k, JSON.stringify(v)); }
  window.chrome = { runtime: { id: "t", getURL: (p) => "chrome-extension://t/" + p, getManifest: () => ({ version: "1.0.1" }), sendMessage: async () => ({ ok: false }) }, tabs: { create() {} } }; })();`;
(async () => {
  const browser = await chromium.launch();
  let lost = 0;
  for (let i = 0; i < 12; i++) {
    const ctx = await browser.newContext({ viewport: { width: 400, height: 700 } });
    const page = await ctx.newPage();
    const errs = [];
    page.on("pageerror", (e) => errs.push(String(e)));
    await page.addInitScript(init);
    await page.goto(`http://127.0.0.1:8765/panel.html`);
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: "Not now" }).click();
    const immediate = await page.evaluate(() => localStorage.getItem("focusgate.hidden-hints"));
    await page.waitForTimeout(300);
    await page.reload(); await page.waitForTimeout(500);
    const after = await page.evaluate(() => localStorage.getItem("focusgate.hidden-hints"));
    const shown = await page.getByRole("heading", { name: "Set up FocusGate in full screen" }).count();
    if (!immediate || !after || shown) lost++;
    console.log(i, "immediate:", immediate, "after reload:", after, "offer shown:", shown, errs.length ? errs.join("|") : "");
    await ctx.close();
  }
  console.log("lost:", lost);
  await browser.close();
})();
