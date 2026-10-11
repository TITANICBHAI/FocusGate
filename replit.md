# FocusGate

## Running locally

- `npm run dev` previews the extension popup at port 3000.
- `npm run docs:dev` previews the public policy and support site at port 5000.
- `npm run package:all` builds both store packages in `build/`.

## Store release files

- `build/focusgate-chrome.zip` is the Chrome package.
- `build/focusgate-edge.zip` is the Edge package.
- `build/focusgate-firefox.zip` is the Firefox package with stable Gecko
  metadata.
- `build/store-submission/` is the complete upload bundle with all three ZIPs,
  listing text, license, icon, and store screenshots.
- GitHub Actions uploads Chrome, Edge, and Firefox as separate artifacts on
  every build; each downloaded artifact contains one browser ZIP. A `v*` tag
  also attaches the ZIPs directly to a GitHub Release. Firefox validation checks
  the Gecko ID, Firefox-only background scripts, and data-collection declaration.
- `STORE_LISTING.md` contains the store copy, permission justifications, data
  disclosures, and required URLs.
- `AFTER_PUBLISHING.md` explains what to do after the docs site and store
  listings are published.
- `docs/privacy-policy.html` and `docs/support.html` must be published before
  submitting store listings.

The store dashboards still require the publisher to upload the ZIPs, provide
screenshots, verify the publisher account, and submit each listing for review.