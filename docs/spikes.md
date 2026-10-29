# WP1b browser de-risking spikes

**Initial run date:** 2026-10-19
**Latest environment recheck:** 2026-10-29
**Status:** blocked; S1 has partial Chromium-only evidence, and S2–S4 remain unverified.
**Scope:** WP1b browser validation. On 2026-10-29, the owner chose to complete M1 before starting WP7. Chromium-only results below do not satisfy the full browser matrix or close WP1b.

## Test environment

- Host: Replit Linux, kernel `6.18.57`, x86_64.
- Chromium available: `152.0.7977.64`; a throwaway Manifest V3 extension can be loaded in headless mode.
- Firefox and Microsoft Edge binaries unavailable.
- `DISPLAY=:0` reported an 800×600 display and `xdotool` was present; Xvfb and browser automation packages were unavailable.
- No external site was used. The S1 harness mapped `example.com` and `source.test` to loopback and ran a local HTTP server.

## S1 — DNR redirect preserves the original URL

**Result: PARTIAL — Chromium 152 only.** Tested a throwaway MV3 extension with a DNR regex redirect and a local HTTP server. With `web_accessible_resources`, the tested direct navigation, synthetic link click, `window.open(..., "_self")`, and HTTP 302 chain displayed the full original URL, including `?a=1&b=2#frag`. The same direct navigation and 302 chain passed without `web_accessible_resources`; the link and `_self` cases without it ended on Chromium's `ERR_BLOCKED_BY_CLIENT` page.

The throwaway harness attempted a dynamic MV3 DNR rule using `requestDomains: ["example.com"]`, `regexFilter: "^(https?://.+)$"`, and `regexSubstitution` to `blocked.html#\\1`. It included a local page to represent a link source and a local HTTP redirect route. Variants with and without `web_accessible_resources` were prepared.

| Case | Chromium 152 with WAR | Chromium 152 without WAR | Edge | Firefox |
|---|---|---|---|---|
| Direct top-level URL with `?`, `&`, and `#` | Pass; full URL shown | Pass; full URL shown | Not available | Not available |
| Link click from another site | Pass; synthetic anchor click | `ERR_BLOCKED_BY_CLIENT` | Not available | Not available |
| `window.open` | Pass using `_self`, not a new window | `ERR_BLOCKED_BY_CLIENT` | Not available | Not available |
| HTTP 302 redirect chain | Pass; full URL shown | Pass; full URL shown | Not available | Not available |

The direct navigation was opened by Chromium's command line, not typed into an interactive address bar. The link case used a scripted anchor click, and `window.open` used `_self`; neither proves a trusted user click or a separate popup tab. The cases ran only in Chromium and do not establish Chrome Stable, Edge, or Firefox behavior.

**Redirect design decision:** Plan A remains provisional. The tested Chromium cases preserved the full URL with WAR, while two no-WAR cases were blocked. This is not the full S1 matrix: repeat it in Chrome, Edge, and Firefox with an interactive address bar, a real link click, and a new `window.open` tab before selecting a design or activating WP3 enforcement. Plan B remains unverified.

## S2 — Attention sampling

**Result: BLOCKED / no sampling observations collected.**

No focused/unfocused, minimized, locked-screen, second-monitor, idle, or audible-tab measurements were obtained. The available display was 800×600, but the headful Chromium test did not create an inspectable window; headless Chromium cannot establish the required OS window-focus/minimized conditions. Browser and OS differences therefore remain unknown.

**Interim decision:** use the plan's conservative fallback: count only a focused window with an active tab; background-audio counting stays opt-in and off by default. This is a safety policy, not a verified sampling result. Re-test before relying on attention-based accounting.

## S3 — Alarm persistence, idempotency, and minimum period

**Result: BLOCKED / not tested in a running extension context.**

No `alarms.getAll()` observation was collected before/after worker stop, browser restart, same-name alarm recreation, or a minimum-period probe. The Chromium harness did not produce a controllable extension page. No alarm persistence or timing claim is made.

**Interim decision:** do not assume alarms survive worker/browser lifecycle events. Follow the plan's fallback by re-arming alarms idempotently on install, startup, and at the top of every alarm handler. Keep periodic work at the existing one-minute cadence until a browser probe establishes the supported minimum.

## S4 — Firefox MV3 APIs and permissions

**Result: BLOCKED / Firefox runtime unavailable.**

The Firefox binary was absent, so none of these were exercised in Firefox: MV3 `background.scripts` with `type: "module"`, DNR `regexSubstitution` to a `moz-extension://` URL, host-permission `contains`/user-gesture `request`, `idle`, `notifications` without buttons, or `storage.session`. WP1's temporary Firefox archive/manifest transformation check is only packaging evidence; it is not an API compatibility test.

**Interim decision:** Firefox remains best effort; feature-detect APIs and permissions and report unavailable protection features. Do not make Firefox compatibility claims until S4 is run in Firefox.

## Gate and changed assumptions

- The runtime spikes are not green. WP1b is **not complete**; WP2/WP3 code and unit work may proceed, while affected runtime acceptance and WP5 cutover remain gated.
- Plan A is no longer an assumed working redirect; Plan B is provisional pending the S1 browser matrix.
- Do not activate WP3 navigation enforcement until S1 is verified.
- Use conservative attention sampling and lifecycle alarm re-arming until their browser tests pass.
- Firefox packaging success does not imply Firefox runtime support; feature detection and a Firefox test remain mandatory.

## Environment recheck — 2026-10-28

- Chromium is available at `152.0.7977.64`; no Firefox or Microsoft Edge executable is available.
- No Playwright, Puppeteer, WebSocket, or Chrome DevTools Protocol client package is installed. The X display and `xdotool` command exist, but no controllable headful browser window was obtained.
- A throwaway MV3 extension loaded in headless Chromium and returned readable `blocked.html` output for the partial S1 matrix above. The extension fixture and loopback server were created under `/tmp` and removed after the run; no project runtime was activated.
- This partial S1 result does **not** exercise an interactive address bar, a separate `window.open` tab, worker restart, alarms, attention sampling, or Firefox APIs.
- To complete WP1b, use a controllable environment with Chrome, Edge, and Firefox extension loading, readable output, and interactive controls. Do not infer support from packaging or a generic Chromium page render.
