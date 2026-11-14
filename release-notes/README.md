# Release notes

The GitHub release page for a version is built by `scripts/release-notes.cjs`. It shows a banner, the
Firefox, Edge and Chrome buttons, a "What's new" list, the Chrome install steps, the three files, and the
full changelog tucked into a collapsible block.

"What's new" comes from `release-notes/<version>.md` when that file exists. Write it for people who are
deciding whether to update, not for developers: short bullets, a bold lead-in, one idea each.

```md
---
tagline: One line that sells this release.
---
- **Short lead-in.** One sentence on what it does for the person using it.
- **Another one.** Keep each to a single sentence.
```

Without the file, the script falls back to the first sentence of each paragraph in that version's
`## [version]` section of `CHANGELOG.md`, so a release is never blocked on this step. Check what a
release will look like before publishing:

```bash
node scripts/release-notes.cjs --tag v1.0.2            # print it
npm run release:github -- --dry-run                    # also builds the files, publishes nothing
```

Screenshots and the banner are the files in `store-assets/marketplace/`, linked at the release's tag,
so they must be committed before the tag is pushed.
