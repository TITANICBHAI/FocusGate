// Interaction check of the Strict-session password sheet in real Chromium, with a stub for the extension messages.
const { chromium } = require("playwright");
const fs = require("fs");
const S = "/tmp/claude-0/-home-claude/1d3d810c-0866-503f-8b36-d437fcdf9427/scratchpad/store";
const OUT = process.argv[2] || `${S}/out8`;
const THEME = process.argv[3] || "light";
fs.mkdirSync(OUT, { recursive: true });
const defaults = JSON.parse(fs.readFileSync(`${S}/default-state.json`, "utf8"));
const shell = `<!doctype html><html lang="en" data-theme="${THEME}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>FocusGate</title><link rel="stylesheet" href="styles.css"></head><body class="panel-page"><div id="root"></div><script src="panel.js"></script></body></html>`;
fs.writeFileSync(`${S}/panel.html`, shell);

const stub = (hasPassword) => `(() => {
  window.__sent = [];
  window.__hasPassword = ${hasPassword};
  const defaults = ${JSON.stringify(defaults)};
  const state = Object.assign({}, defaults, {
    blockedSites: ["reddit.com", "x.com"],
    settings: Object.assign({}, defaults.settings, { theme: "${THEME}" }),
    password: ${hasPassword} ? { algo: "pbkdf2-sha256", iter: 1, salt: "00", hash: "11" } : null,
  });
  for (const [k, v] of Object.entries(state)) localStorage.setItem(k, JSON.stringify(v));
  window.chrome = { runtime: { id: "test-id", sendMessage: async (m) => {
    window.__sent.push(m);
    if (m.type === "session/start") return { ok: true, session: Object.assign({}, defaults.session, { status: "work", lockLevel: m.lockLevel }) };
    if (m.type === "password/set") {
      if (window.__hasPassword && m.currentPassword !== "1111") return { ok: false, code: "BAD_PASSWORD", message: "That password is not correct." };
      window.__hasPassword = true;
      return { ok: true, passwordSet: true };
    }
    return { ok: false, code: "UNKNOWN", message: "unknown" };
  } } };
})();`;

const results = [];
function check(name, ok, detail) { results.push({ name, ok: !!ok, detail }); console.log((ok ? "PASS " : "FAIL ") + name + (detail ? "  :: " + detail : "")); }

async function open(browser, hasPassword, W = 400) {
  const ctx = await browser.newContext({ viewport: { width: W, height: 700 }, deviceScaleFactor: 2, colorScheme: THEME === "light" ? "light" : "dark", permissions: ["clipboard-read", "clipboard-write"] });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 300)));
  page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text().slice(0, 300)); });
  await page.route("file:///icon.png", (route) => route.fulfill({ path: `${S}/public/icon.png`, contentType: "image/png" }));
  await page.addInitScript(stub(hasPassword));
  await page.goto(`http://127.0.0.1:8765/panel.html`);
  await page.waitForTimeout(600);
  return { page, errors, ctx };
}
const sent = (page) => page.evaluate(() => window.__sent);
const dialog = (page) => page.getByRole("dialog");

(async () => {
  const browser = await chromium.launch();
  // The longest password FocusGate can make is 28 characters. Show 28 of the widest letters (and a plain run of m)
  // in the Strict sheet at three widths: the panel's usual 400 px, 320 px, and 200 px (a 400 px panel at 200% zoom).
  for (const width of [400, 320, 200]) {
    const { page, errors } = await open(browser, false, width);
    await page.getByRole("button", { name: "Strict" }).click();
    await page.getByRole("button", { name: "Start focus" }).click();
    await page.waitForTimeout(300);
    await dialog(page).getByRole("button", { name: "Generate a password" }).click();
    await page.waitForTimeout(200);
    for (const sample of ["W".repeat(28), "m".repeat(28), "kT7mXp2RhN4cWv9QbJ6sY3dFgHnA"]) {
      const m = await page.evaluate((text) => {
        const el = document.querySelector(".fg-password-reveal__value");
        el.textContent = text;
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        const lineHeight = parseFloat(cs.lineHeight);
        const rects = [...el.getClientRects()];
        return {
          text: el.textContent.length,
          lines: Math.round(r.height / lineHeight),
          width: Math.round(r.width),
          scrollW: el.scrollWidth,
          clientW: el.clientWidth,
          docScrollW: document.documentElement.scrollWidth,
          innerW: window.innerWidth,
          font: cs.fontFamily.split(",")[0],
          wrap: cs.overflowWrap,
          right: Math.round(r.right),
        };
      }, sample);
      const fits = m.scrollW <= m.clientW + 1 && m.docScrollW <= m.innerW;
      check(`${width}px: 28 characters (${sample.slice(0, 3)}...) never run past the sheet or the page`, fits, JSON.stringify(m));
      if (sample[0] === "W") await page.screenshot({ path: `${OUT}/longpw-${width}.png` });
    }
    check(`${width}px: no page errors`, errors.length === 0, errors.join(" | "));
    await page.close();
  }
  await browser.close();
  const failed = results.filter((r) => !r.ok).length;
  const text = results.map((r) => (r.ok ? "PASS " : "FAIL ") + r.name + (r.detail ? "  :: " + r.detail : "")).join("\n") + `\n\n${results.length - failed} passed, ${failed} failed\n`;
  fs.writeFileSync(`${OUT}/longpw-${THEME}-log.txt`, text);
  console.log(`\n${results.length - failed} passed, ${failed} failed`);
})();
