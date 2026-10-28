# WP1b browser de-risking spikes

**Initial run date:** 2026-10-19
**Latest environment recheck:** 2026-10-28
**Status:** blocked; the browser-dependent claims below are not verified.  
**Scope:** WP1b browser validation. On 2026-10-28, the owner deferred these tests so WP2/WP3 module and unit work can proceed under the fallbacks below; WP1b remains a gate before WP5 cutover and M1 green.

## Test environment

- Host: Replit Linux, kernel `6.18.57`, x86_64.
- Chromium available: `152.0.7977.64`.
- Firefox and Microsoft Edge binaries unavailable.
- `DISPLAY=:0` reported an 800×600 display and `xdotool` was present; Xvfb and browser automation packages were unavailable.
- No external site was used. The S1 harness mapped `example.com` and `source.test` to loopback and ran a local HTTP server.

## S1 — DNR redirect preserves the original URL

**Result: BLOCKED / no behavioral conclusion.** No test case reached a readable result page. The intended case set was not passed.

The throwaway harness attempted a dynamic MV3 DNR rule using `requestDomains: ["example.com"]`, `regexFilter: "^(https?://.+)$"`, and `regexSubstitution` to `blocked.html#\\1`. It included a local page to represent a link source and a local HTTP redirect route. Variants with and without `web_accessible_resources` were prepared.

| Case | Chromium 152 | Edge | Firefox |
|---|---|---|---|
| Typed URL with `?`, `&`, and `#` | Not verified; harness produced no page output | Not available | Not available |
| Link click from another site | Not run | Not available | Not available |
| `window.open` | Not run | Not available | Not available |
| HTTP redirect chain | Not run | Not available | Not available |
| Repeat cases with and without `web_accessible_resources` | Not run | Not available | Not available |

Harness attempts: the first DevTools WebSocket connection received HTTP 403; a retry with Chromium's local remote-origin allowance hit a harness client error, and its corrected retry timed out without output. Separate headless `--dump-dom` runs for dynamic and static DNR variants also timed out without output. A headful app-mode launch did not create a window/profile that `xdotool` could inspect. These are test-harness failures, not evidence that the redirect works or fails.

**Redirect design decision:** Plan B (`webNavigation.onBeforeNavigate` stores the original URL in `storage.session`, then DNR redirects to `/blocked.html`) is the provisional choice because Plan A has not been demonstrated to preserve fragments and all navigation paths. Plan B is also unverified. Do not treat either design as proven or start WP3 enforcement until S1 is repeated in a controllable Chrome, Edge, and Firefox environment.

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

- Chromium is still available at `152.0.7977.64`; no Firefox or Microsoft Edge executable is available.
- No Playwright, Puppeteer, WebSocket, or Chrome DevTools Protocol client package is installed. The X display and `xdotool` command exist, but prior headful Chromium attempts did not yield an inspectable browser window.
- A generic headless control page did render `PAGE_OUTPUT_OK` using `chromium --headless --no-sandbox --disable-gpu --disable-dev-shm-usage --user-data-dir=/tmp/focusgate-wp1b-headless-baseline --dump-dom 'data:text/html,<title>wp1b-baseline</title><p>PAGE_OUTPUT_OK</p>'`. D-Bus warnings appeared, but the command exited successfully.
- This control page does **not** exercise an extension, DNR, alarms, focus/idle sampling, or Firefox APIs. No new S1–S4 behavior result was obtained; the prior blocked outcomes and provisional decisions above remain unchanged.
- To complete WP1b, use a controllable environment with Chrome, Edge, and Firefox extension loading and readable test-page output. Do not infer browser support from packaging or a generic Chromium page render.
