# FocusGate

## Running locally

- `npm run dev` previews the extension popup at port 3000.
- `npm run docs:dev` previews the public policy and support site at port 5000.
- `npm run package:all` builds both store packages in `build/`.

## Store release files

- `build/focusgate-extension.zip` is the Chromium package for Chrome and Edge.
- `build/focusgate-firefox.zip` is the Firefox package with stable Gecko
  metadata.
- `build/store-submission/` is the complete upload bundle with both ZIPs,
  listing text, license, icon, and store screenshots.
- `STORE_LISTING.md` contains the store copy, permission justifications, data
  disclosures, and required URLs.
- `docs/privacy-policy.html` and `docs/support.html` must be published before
  submitting store listings.

The store dashboards still require the publisher to upload the ZIPs, provide
screenshots, verify the publisher account, and submit each listing for review.