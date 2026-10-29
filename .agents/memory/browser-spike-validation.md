---
name: Browser-spike validation limits
description: Headless Chromium 152 supports selected MV3 DNR probes here, but interactive and cross-browser claims need separate evidence.
---

Treat a browser harness timeout or missing page output as a harness failure, not evidence that an extension API passes or fails. Headless Chromium 152 can load a temporary MV3 extension and produce readable output for selected DNR redirect cases; a result applies only to the paths actually exercised.

**Why:** A temporary DNR fixture produced a readable blocked-page marker in headless Chromium 152. Tested link and `window.open(..., "_self")` paths failed with `ERR_BLOCKED_BY_CLIENT` when the target extension page was not declared web-accessible; this does not cover a real popup tab, address-bar input, Edge, Firefox, focus, or worker lifecycle.

**How to apply:** Use a temporary, isolated MV3 fixture and require page output before recording a result. Keep interactive, lifecycle, attention, and cross-browser gates open until those conditions are observed in their target browsers.
