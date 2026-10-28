---
name: Staged work vs cutover gates
description: Owner-authorized staged WP4/WP6 work may precede acceptance, but runtime activation and cutover remain gated.
---

Keep WP3 focused on the staged engine and deterministic module/unit verification. The owner confirmed on 2026-10-28 to preserve the WP5/WP7 sequence rather than pull those UI and cutover pieces into WP3.

On 2026-10-28, the owner authorized starting WP4 staged content-script work while WP3 remains open. This does not waive the WP5 cutover gate or close WP3's deferred UI/runtime work.

On 2026-10-28, the owner authorized staged WP6 implementation and deterministic verification while WP5 browser/accessibility verification and atomic cutover remain open. This does not authorize registering v2 message handlers, migrating live storage, deleting v1 consumers, or claiming WP5/M1 complete.

**Why:** The plan assigns Rules/block-page and Check-a-URL/alias UI to later work packages and requires the WP5 atomic cutover before replacing the active v1 path. Activating v2 enforcement before S1 and cutover would bypass those gates.

**How to apply:** Allow staged WP4/WP6 module and UI work without declaring preceding packages complete. Do not activate v2 runtime consumers, migrate live storage, remove v1 paths, or perform the atomic cutover before the required browser gates pass. Keep browser-dependent acceptance criteria open until controlled verification after cutover.
