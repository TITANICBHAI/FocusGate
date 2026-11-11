// The full-screen Settings PIN card in real Chromium, with a stub for the extension messages.
const { chromium } = require("playwright");
const fs = require("fs");
const S = "/tmp/claude-0/-home-claude/1d3d810c-0866-503f-8b36-d437fcdf9427/scratchpad/store";
const OUT = process.argv[2] || `${S}/out8`;
const THEME = process.argv[3] || "light";
fs.mkdirSync(OUT, { recursive: true });
const defaults = JSON.parse(fs.readFileSync(`${S}/default-state.json`, "utf8"));
fs.writeFileSync(`${S}/dashboard.html`, `<!doctype html><html lang="en" data-theme="${THEME}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Dashboard</title><link rel="stylesheet" href="styles.css"></head><body class="full-page"><div id="root"></div><script src="dashboard.js"></script></body></html>`);
const stub = (hasPin) => `(() => {
  window.__sent = [];
  const defaults = ${JSON.stringify(defaults)};
  const state = Object.assign({}, defaults, {
    blockedSites: ["reddit.com", "x.com"], alwaysBlockedSites: ["youtube.com"],
    settings: Object.assign({}, defaults.settings, { theme: "${THEME}" }),
    password: ${hasPin} ? { algo: "pbkdf2-sha256", iter: 1, salt: "00", hash: "11" } : null,
  });
  for (const [k, v] of Object.entries(state)) localStorage.setItem(k, JSON.stringify(v));
  window.chrome = { runtime: { id: "test-id", getManifest: () => ({ version: "1.0.1" }), sendMessage: async (m) => {
    window.__sent.push(m);
    if (m.type === "password/set") return { ok: true, passwordSet: true };
    if (m.type === "password/remove") return m.currentPassword === "1111" ? { ok: true, passwordSet: false } : { ok: false, code: "BAD_PASSWORD", message: "That PIN is not correct." };
    return { ok: false, code: "UNKNOWN", message: "unknown" };
  } } };
})();`;
const results = [];
function check(name, ok, detail) { results.push(ok); console.log((ok ? "PASS " : "FAIL ") + name + (detail ? "  :: " + detail : "")); }
async function open(browser, hasPin, w = 1280, h = 800) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, colorScheme: THEME === "light" ? "light" : "dark", permissions: ["clipboard-read", "clipboard-write"] });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 300)));
  await page.route("file:///icon.png", (r) => r.fulfill({ path: `${S}/public/icon.png`, contentType: "image/png" }));
  await page.addInitScript(stub(hasPin));
  await page.goto(`http://127.0.0.1:8765/dashboard.html#settings`);
  await page.waitForTimeout(700);
  return { page, errors };
}
(async () => {
  const browser = await chromium.launch();
  {
    const { page, errors } = await open(browser, false);
    const card = page.locator(".fg-card", { has: page.getByRole("heading", { name: "PIN", exact: true }) });
    check("no PIN: the PIN card is there", (await card.count()) === 1);
    await card.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${OUT}/settings-pin-none.png` });
    await card.getByRole("button", { name: "Generate a PIN" }).click();
    await page.waitForTimeout(200);
    const shown = (await card.locator(".fg-pin-reveal__value").textContent()) || "";
    check("generating shows six digits", /^\d{6}$/.test(shown), shown);
    const save = card.getByRole("button", { name: "I have saved it, set PIN" });
    check("the save button says it was saved", (await save.count()) === 1 && (await save.isEnabled()));
    await page.screenshot({ path: `${OUT}/settings-pin-generated.png` });
    await save.click();
    await page.waitForTimeout(300);
    const msgs = await page.evaluate(() => window.__sent);
    check("saves exactly that PIN", msgs.length === 1 && msgs[0].type === "password/set" && msgs[0].newPassword === shown && !("currentPassword" in msgs[0]), JSON.stringify(msgs));
    check("says PIN saved, and the reveal is gone", (await card.getByText("PIN saved.").count()) === 1 && (await card.locator(".fg-pin-reveal").count()) === 0);
    check("no page errors", errors.length === 0, errors.join(" | "));
  }
  {
    const { page, errors } = await open(browser, true);
    const card = page.locator(".fg-card", { has: page.getByRole("heading", { name: "PIN", exact: true }) });
    await card.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${OUT}/settings-pin-set.png` });
    await card.getByLabel("Current PIN").fill("0000");
    await card.getByRole("button", { name: "Remove PIN" }).click();
    await page.waitForTimeout(300);
    check("a wrong current PIN is explained", (await card.getByText("That PIN is not correct.").count()) === 1);
    await card.getByLabel("Current PIN").fill("1111");
    await card.getByRole("button", { name: "Remove PIN" }).click();
    await page.waitForTimeout(300);
    check("the right one removes it", (await card.getByText("PIN removed.").count()) === 1);
    check("no page errors", errors.length === 0, errors.join(" | "));
  }
  await browser.close();
  const failed = results.filter((ok) => !ok).length;
  console.log(`\n${results.length - failed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();
