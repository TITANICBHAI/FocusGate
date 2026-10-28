---
name: Lockfile-based dependency recovery
description: Recovery when the package installer cannot resolve dependencies in this project.
---

When the Replit package installer fails with npm Arborist's `Cannot read properties of null (reading 'edgesOut')`, this project's existing `package-lock.json` was restored successfully with `npm ci --no-audit`; the package manifests and lockfiles stayed unchanged.

**Why:** The failure occurred during npm's dependency-tree resolution, while the lockfile-based install reproduced the pinned dependency tree and enabled typecheck, tests, and build.

**How to apply:** First confirm `package-lock.json` exists and package files are clean. If the same internal resolver failure occurs, use `npm ci` once rather than changing versions or regenerating lockfiles, then verify the project scripts.
