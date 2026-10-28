---
name: WP3 cutover sequence
description: Owner-confirmed boundary between WP3 staged checks and later UI/cutover work.
---

Keep WP3 focused on the staged engine and deterministic module/unit verification. The owner confirmed on 2026-10-28 to preserve the WP5/WP7 sequence rather than pull those UI and cutover pieces into WP3.

**Why:** The plan assigns Rules/block-page and Check-a-URL/alias UI to later work packages and requires the WP5 atomic cutover before replacing the active v1 path. Activating v2 enforcement before S1 and cutover would bypass those gates.

**How to apply:** Do not integrate WP5/WP7 screens, remove the v1 fallback, or activate v2 enforcement as part of WP3. Keep browser-dependent acceptance criteria open until a controlled browser verification is run after the cutover.
