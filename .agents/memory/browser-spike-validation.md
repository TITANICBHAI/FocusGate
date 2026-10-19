---
name: Browser-spike validation limits
description: Replit's command-line Chromium may not provide a usable surface for extension runtime spikes.
---

Treat a browser harness timeout or missing page output as a harness failure, not evidence that an extension API passes or fails. Keep browser-dependent gates blocked until the test page itself produces a readable result.

**Why:** In this workspace, Chromium was available but repeated headless DNR runs yielded no page output, and a headful launch did not create an inspectable window. Firefox and Edge were unavailable.

**How to apply:** For extension behavior spikes, arrange a controllable browser environment first; do not infer browser behavior from a failed launch or use the limitation to claim support.
