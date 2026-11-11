// The one-time setup offer in the side panel, the You tab's Run setup row, and the last screen of setup.
const { chromium } = require("playwright");
const fs = require("fs");
const S = "/tmp/claude-0/-home-claude/1d3d810c-0866-503f-8b36-d437fcdf9427/scratchpad/store";
const OUT = process.argv[2] || `${S}/out8`;
const THEME = process.argv[3] || "light";
fs.mkdirSync(OUT, { recursive: true });
const defaults = JSON.parse(fs.readFileSync(`${S}/default-state.json`, "utf8"));
const shell = (title, bodyClass, script) => `<!doctype html><html lang="en" data-theme="${THEME}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title><link rel="stylesheet" href="styles.css"></head><body class="${bodyClass}"><div id="root"></div><script src="${script}"></script></body></html>`;
fs.writeFileSync(`${S}/panel.html`, shell("FocusGate", "panel-page", "panel.js"));
fs.writeFileSync(`${S}/onboarding.html`, shell("FocusGate setup", "full-page", "onboarding.js"));
const stub = (o) => `(() => {
  window.__tabs = []; window.__sent = []; window.__failTabs = ${!!o.failTabs};
  const defaults = ${JSON.stringify(defaults)};
  const state = Object.assign({}, defaults, ${o.rules ? '{ blockedSites: ["reddit.com"] }' : "{}"}, { settings: Object.assign({}, defaults.settings, { theme: "${THEME}" }) });
  for (const [k, v] of Object.entries(state)) { if (localStorage.getItem(k) === null) localStorage.setItem(k, JSON.stringify(v)); }
  window.chrome = { runtime: { id: "t", getURL: (p) => "chrome-extension://t/" + p, getManifest: () => ({ version: "1.0.1" }),
      sendMessage: async (m) => { window.__sent.push(m); return m.type === "password/set" ? { ok: true, passwordSet: true } : { ok: false, code: "X", message: "x" }; } },
    tabs: { create: (o) => { if (window.__failTabs) return Promise.reject(new Error("no window")); window.__tabs.push(o); return Promise.resolve({}); } } };
})();`;
const results = [];
const check = (n, ok, d) => { results.push(ok); console.log((ok ? "PASS " : "FAIL ") + n + (d ? " :: " + d : "")); };
async function open(browser, url, o, viewport) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, colorScheme: THEME === "light" ? "light" : "dark" });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 300)));
  await page.route("file:///icon.png", (r) => r.fulfill({ path: `${S}/public/icon.png`, contentType: "image/png" }));
  await page.addInitScript(stub(o));
  await page.goto(`http://127.0.0.1:8765/${url}`);
  await page.waitForTimeout(700);
  return { ctx, page, errors };
}
const OFFER = "Set up FocusGate in full screen";
(async () => {
  const browser = await chromium.launch();
  const panel = { width: 400, height: 700 };

  // A: a first-time user, and "Not now"
  let { page, errors } = await open(browser, "panel.html", {}, panel);
  check("A offer shown to a first-time user", (await page.getByRole("heading", { name: OFFER }).count()) === 1);
  const openBtn = page.getByRole("button", { name: "Open full-screen setup" });
  const box = await openBtn.boundingBox();
  check("A both buttons are on screen without scrolling", box && box.y + box.height <= 700, JSON.stringify(box));
  const heroTop = await page.locator(".fg-hero").first().boundingBox();
  const cardBox = await page.locator(".fg-setup-offer").boundingBox();
  check("A offer sits above the Focus screen", cardBox && heroTop && cardBox.y + cardBox.height <= heroTop.y + 1, `${cardBox && cardBox.y + cardBox.height} <= ${heroTop && heroTop.y}`);
  check("A Start stays the one primary button", (await page.locator(".fg-btn--primary:visible").count()) === 1, String(await page.locator(".fg-btn--primary:visible").count()));
  check("A no sideways scroll", await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await page.screenshot({ path: `${OUT}/setup-offer-panel.png` });
  await page.getByRole("button", { name: "Not now" }).click();
  await page.waitForTimeout(1000); // let the browser write local storage before the reload
  check("A Not now removes it", (await page.getByRole("heading", { name: OFFER }).count()) === 0);
  check("A Not now opens nothing", (await page.evaluate(() => window.__tabs.length)) === 0);
  await page.reload(); await page.waitForTimeout(600);
  check("A it stays gone after a reload", (await page.getByRole("heading", { name: OFFER }).count()) === 0);
  check("A it is remembered with the hidden hints", (await page.evaluate(() => localStorage.getItem("focusgate.hidden-hints"))).includes("setup-offer"));
  check("A no page errors", errors.length === 0, errors.join(" | "));

  // B: Open full-screen setup
  ({ page, errors } = await open(browser, "panel.html", {}, panel));
  await page.getByRole("button", { name: "Open full-screen setup" }).click();
  await page.waitForTimeout(1000);
  const tabs = await page.evaluate(() => window.__tabs);
  check("B opens the setup page in a new tab", tabs.length === 1 && tabs[0].url === "chrome-extension://t/onboarding.html", JSON.stringify(tabs));
  check("B the offer is gone afterwards", (await page.getByRole("heading", { name: OFFER }).count()) === 0);
  await page.reload(); await page.waitForTimeout(600);
  check("B and stays gone after a reload", (await page.getByRole("heading", { name: OFFER }).count()) === 0);
  check("B no page errors", errors.length === 0, errors.join(" | "));

  // C: the tab cannot be opened
  ({ page, errors } = await open(browser, "panel.html", { failTabs: true }, panel));
  await page.getByRole("button", { name: "Open full-screen setup" }).click();
  await page.waitForTimeout(300);
  check("C says it could not be opened, and keeps the offer", (await page.getByText("Setup could not be opened. Try again.").count()) === 1 && (await page.getByRole("heading", { name: OFFER }).count()) === 1);
  await page.screenshot({ path: `${OUT}/setup-offer-failed.png` });
  await page.evaluate(() => { window.__failTabs = false; });
  await page.getByRole("button", { name: "Open full-screen setup" }).click();
  await page.waitForTimeout(300);
  check("C works on the second try", (await page.evaluate(() => window.__tabs.length)) === 1 && (await page.getByRole("heading", { name: OFFER }).count()) === 0);
  check("C no page errors", errors.length === 0, errors.join(" | "));

  // D: someone with a rule is not a first-time user
  ({ page, errors } = await open(browser, "panel.html", { rules: true }, panel));
  check("D no offer when a rule exists", (await page.getByRole("heading", { name: OFFER }).count()) === 0);
  check("D no page errors", errors.length === 0, errors.join(" | "));

  // E: the You tab keeps a Run setup row
  ({ page, errors } = await open(browser, "panel.html", { rules: true }, panel));
  await page.getByRole("tab", { name: "You" }).click();
  await page.waitForTimeout(300);
  const row = page.getByRole("button", { name: "Open setup" });
  await row.scrollIntoViewIfNeeded();
  check("E Run setup row is on the You tab", (await page.getByText("Run setup", { exact: true }).count()) === 1 && (await row.count()) === 1);
  await page.screenshot({ path: `${OUT}/setup-you-row.png` });
  await row.click();
  await page.waitForTimeout(300);
  const t2 = await page.evaluate(() => window.__tabs);
  check("E Open setup opens the setup page", t2.length === 1 && t2[0].url === "chrome-extension://t/onboarding.html", JSON.stringify(t2));
  check("E no page errors", errors.length === 0, errors.join(" | "));

  // F: the last screen of setup shows a generated PIN once more, and marks setup as dealt with
  ({ page, errors } = await open(browser, "onboarding.html", {}, { width: 1000, height: 900 }));
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Generate a PIN" }).click();
  await page.waitForTimeout(200);
  const pin = (await page.locator(".fg-pin-reveal__value").textContent()).trim();
  check("F a six-digit PIN was generated", /^\d{6}$/.test(pin), pin);
  await page.getByRole("button", { name: "I have saved it, continue" }).click();
  await page.getByRole("button", { name: "Save setup" }).click();
  await page.getByRole("heading", { name: "Your setup is saved" }).waitFor({ timeout: 5000 });
  check("F the last screen shows the same PIN", (await page.locator(".fg-pin-reveal__value").textContent()).trim() === pin);
  check("F and says to write it down", (await page.getByText("Write your PIN down").count()) === 1 && (await page.getByText("scrambled copy").count()) === 1);
  const sent = await page.evaluate(() => window.__sent);
  check("F the PIN was saved with the setup", sent.some((m) => m.type === "password/set" && m.newPassword === pin), JSON.stringify(sent.map((m) => m.type)));
  check("F setup is marked as dealt with", (await page.evaluate(() => localStorage.getItem("focusgate.hidden-hints") || "")).includes("setup-offer"));
  await page.screenshot({ path: `${OUT}/setup-done-pin.png`, fullPage: true });
  check("F no page errors", errors.length === 0, errors.join(" | "));

  // G: no PIN chosen, no PIN shown again
  ({ page, errors } = await open(browser, "onboarding.html", {}, { width: 1000, height: 900 }));
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Save setup" }).click();
  await page.getByRole("heading", { name: "Your setup is saved" }).waitFor({ timeout: 5000 });
  check("G no PIN shown when none was generated", (await page.locator(".fg-pin-reveal").count()) === 0);
  check("G no page errors", errors.length === 0, errors.join(" | "));

  await browser.close();
  const failed = results.filter((ok) => !ok).length;
  console.log(`\n${results.length - failed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();
