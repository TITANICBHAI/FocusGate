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

async function open(browser, hasPassword) {
  const ctx = await browser.newContext({ viewport: { width: 400, height: 700 }, deviceScaleFactor: 2, colorScheme: THEME === "light" ? "light" : "dark", permissions: ["clipboard-read", "clipboard-write"] });
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

  // A. Lock None: no question.
  {
    const { page, errors } = await open(browser, false);
    await page.getByRole("button", { name: "Start focus" }).click();
    await page.waitForTimeout(300);
    const msgs = await sent(page);
    check("A none: starts at once", msgs.length === 1 && msgs[0].type === "session/start" && msgs[0].lockLevel === "none", JSON.stringify(msgs));
    check("A none: no dialog", (await dialog(page).count()) === 0);
    check("A none: no page errors", errors.length === 0, errors.join(" | "));
  }

  // B. Strict, no password: generate, see it, save, start.
  {
    const { page, errors } = await open(browser, false);
    await page.getByRole("button", { name: "Strict" }).click();
    await page.getByRole("button", { name: "Start focus" }).click();
    await page.waitForTimeout(300);
    check("B sheet opens with its title", (await dialog(page).getByText("Protect this session with a password").count()) > 0);
    check("B nothing sent yet", (await sent(page)).length === 0);
    const primary = dialog(page).getByRole("button", { name: "Set password and start" });
    check("B main button is off until a password is chosen", await primary.isDisabled());
    await page.screenshot({ path: `${OUT}/strict-1-no-password.png` });

    await dialog(page).getByRole("button", { name: "Generate a password" }).click();
    await page.waitForTimeout(200);
    const shown = (await dialog(page).locator(".fg-password-reveal__value").textContent()) || "";
    check("B a 20 to 28 character password without look-alike characters is shown", /^[A-HJ-NP-Za-km-z2-9]{20,28}$/.test(shown), shown);
    check("B says to write it down", (await dialog(page).getByText(/Write it down/).count()) > 0);
    await page.screenshot({ path: `${OUT}/strict-2-generated.png` });
    await dialog(page).getByRole("button", { name: "Copy password" }).click();
    await page.waitForTimeout(200);
    const clip = await page.evaluate(() => navigator.clipboard.readText()).catch(() => "unreadable");
    check("B Copy password puts the password on the clipboard", clip === shown, clip);
    check("B the button says Copied", (await dialog(page).getByRole("button", { name: "Copied" }).count()) === 1);
    const save = dialog(page).getByRole("button", { name: "I have saved it, start" });
    check("B main button now says it was saved, and is on", await save.isEnabled());
    await save.click();
    await page.waitForTimeout(400);
    const msgs = await sent(page);
    check("B sends the password first, then starts Strict", msgs.length === 2 && msgs[0].type === "password/set" && msgs[0].newPassword === shown && !("currentPassword" in msgs[0]) && msgs[1].type === "session/start" && msgs[1].lockLevel === "strict", JSON.stringify(msgs));
    check("B sheet closed", (await dialog(page).count()) === 0);
    check("B no page errors", errors.length === 0, errors.join(" | "));
  }

  // C. Strict, no password: type your own; mismatch is explained; skip works.
  {
    const { page, errors } = await open(browser, false);
    await page.getByRole("button", { name: "Strict" }).click();
    await page.getByRole("button", { name: "Start focus" }).click();
    await page.waitForTimeout(300);
    await dialog(page).getByLabel("Password", { exact: true }).fill("blue-river-42");
    await dialog(page).getByLabel("Confirm password").fill("482");
    check("C a mismatch is explained", (await dialog(page).getByText("The passwords do not match.").count()) === 1);
    check("C and the main button stays off", await dialog(page).getByRole("button", { name: "Set password and start" }).isDisabled());
    await dialog(page).getByLabel("Confirm password").fill("blue-river-42");
    check("C a match is said", (await dialog(page).getByText("The passwords match.").count()) === 1);
    await page.screenshot({ path: `${OUT}/strict-3-typed.png` });
    await dialog(page).getByRole("button", { name: "Start without a password" }).click();
    await page.waitForTimeout(400);
    const msgs = await sent(page);
    check("C skipping sends only the start", msgs.length === 1 && msgs[0].type === "session/start" && msgs[0].lockLevel === "strict", JSON.stringify(msgs));
    check("C no page errors", errors.length === 0, errors.join(" | "));
  }

  // D. Password saved: one click.
  {
    const { page, errors } = await open(browser, true);
    await page.getByRole("button", { name: "Strict" }).click();
    await page.getByRole("button", { name: "Start focus" }).click();
    await page.waitForTimeout(300);
    check("D asks whether to use the password", (await dialog(page).getByText("Use your password for this session?").count()) > 0);
    await page.screenshot({ path: `${OUT}/strict-4-saved.png` });
    await dialog(page).getByRole("button", { name: "Use my password and start" }).click();
    await page.waitForTimeout(400);
    const msgs = await sent(page);
    check("D one click starts Strict with no password message", msgs.length === 1 && msgs[0].type === "session/start" && msgs[0].lockLevel === "strict", JSON.stringify(msgs));
    check("D no page errors", errors.length === 0, errors.join(" | "));
  }

  // E. Password saved: a new password needs the current one.
  {
    const { page, errors } = await open(browser, true);
    await page.getByRole("button", { name: "Strict" }).click();
    await page.getByRole("button", { name: "Start focus" }).click();
    await page.waitForTimeout(300);
    await dialog(page).getByRole("button", { name: "Set a new password" }).click();
    await page.waitForTimeout(200);
    check("E fields appear", (await dialog(page).getByLabel("Current password").count()) === 1 && (await dialog(page).getByLabel("New password").count()) === 1);
    const change = dialog(page).getByRole("button", { name: "Change password and start" });
    check("E main button off while empty", await change.isDisabled());
    await dialog(page).getByLabel("Current password").fill("0000");
    await dialog(page).getByLabel("New password").fill("fresh-secret-9");
    await dialog(page).getByLabel("Confirm password").fill("fresh-secret-9");
    check("E main button on when filled", await change.isEnabled());
    await page.screenshot({ path: `${OUT}/strict-5-new.png` });
    await change.click();
    await page.waitForTimeout(400);
    check("E a wrong current password is explained in the sheet", (await dialog(page).getByRole("alert").textContent()) === "That password is not correct.");
    let msgs = await sent(page);
    check("E and no session started", msgs.length === 1 && msgs[0].type === "password/set" && msgs[0].currentPassword === "0000", JSON.stringify(msgs));
    await dialog(page).getByLabel("Current password").fill("1111");
    check("E the message clears when the password is edited", (await dialog(page).getByRole("alert").count()) === 0);
    await change.click();
    await page.waitForTimeout(400);
    msgs = await sent(page);
    check("E the right current password changes it, then starts", msgs.length === 3 && msgs[1].type === "password/set" && msgs[1].currentPassword === "1111" && msgs[1].newPassword === "fresh-secret-9" && msgs[2].type === "session/start", JSON.stringify(msgs));
    check("E no page errors", errors.length === 0, errors.join(" | "));
  }

  // F. Cancel and Escape change nothing.
  {
    const { page, errors } = await open(browser, true);
    await page.getByRole("button", { name: "Strict" }).click();
    await page.getByRole("button", { name: "Start focus" }).click();
    await page.waitForTimeout(300);
    await dialog(page).getByRole("button", { name: "Cancel" }).click();
    await page.waitForTimeout(200);
    check("F Cancel closes it and sends nothing", (await dialog(page).count()) === 0 && (await sent(page)).length === 0);
    await page.getByRole("button", { name: "Start focus" }).click();
    await page.waitForTimeout(300);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);
    check("F Escape closes it and sends nothing", (await dialog(page).count()) === 0 && (await sent(page)).length === 0);
    await page.getByRole("button", { name: "Start focus" }).click();
    await page.waitForTimeout(300);
    check("F it can be opened again, from a clean form", (await dialog(page).count()) === 1);
    check("F no page errors", errors.length === 0, errors.join(" | "));
  }

  // G. Fit: the sheet in a 400x700 panel, tallest state.
  {
    const { page } = await open(browser, false);
    await page.getByRole("button", { name: "Strict" }).click();
    await page.getByRole("button", { name: "Start focus" }).click();
    await page.waitForTimeout(300);
    await dialog(page).getByRole("button", { name: "Generate a password" }).click();
    await page.waitForTimeout(200);
    const box = await dialog(page).boundingBox();
    const info = await page.evaluate(() => { const d = document.querySelector(".fg-sheet"); return { sh: d.scrollHeight, ch: d.clientHeight, ov: getComputedStyle(d).overflowY, bw: document.documentElement.scrollWidth > document.documentElement.clientWidth }; });
    check("G the sheet fits the panel or scrolls inside itself", box.y >= 0 && box.y + box.height <= 700.5 && (info.sh <= info.ch || /auto|scroll/.test(info.ov)), JSON.stringify({ box, info }));
    check("G no sideways scroll", !info.bw);
  }

  await browser.close();
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();
