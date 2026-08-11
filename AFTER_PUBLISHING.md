# What to do after publishing FocusGate

Publishing the docs site and submitting store listings are two different
steps. Use this sequence after the public docs site is live.

## 1. Copy the public docs URL

Open the published site and confirm these pages work in an incognito window:

- `https://your-published-domain/privacy-policy.html`
- `https://your-published-domain/support.html`

Replace the placeholder URLs in `STORE_LISTING.md` with that real public URL.
Do not use a `.replit.dev` preview URL for store listings.

## 2. Build the final upload bundle

Run:

```bash
npm run package:all
```

Use the files inside `build/store-submission/`:

- `focusgate-extension.zip` — upload to Chrome Web Store and Edge Add-ons.
- `focusgate-firefox.zip` — upload to Firefox Add-ons after Firefox testing.
- `STORE_LISTING.md` — copy the descriptions and disclosures.
- `store-assets/` — upload the icon and screenshots.
- `LICENSE` — keep with the release materials.

## 3. Submit to Chrome Web Store

1. Create or open the FocusGate item in the Chrome Web Store developer
   dashboard.
2. Upload `focusgate-extension.zip`.
3. Copy the name, short description, detailed description, category, and
   permission explanations from `STORE_LISTING.md`.
4. Add the public privacy-policy URL and support URL.
5. Upload the 128×128 icon and 1280×800 screenshots.
6. Complete the data-use form accurately:
   - No data sold.
   - No advertising use.
   - No analytics.
   - Focus rules and statistics stay in browser-local storage.
7. Submit for review.

## 4. Submit to Microsoft Edge Add-ons

Repeat the same process in Microsoft Partner Center using the same
`focusgate-extension.zip`. Edge accepts the Chromium package, but its listing
and review are separate from Chrome.

## 5. Submit to Firefox Add-ons

Only do this after loading and testing `focusgate-firefox.zip` in Firefox.
The Firefox package includes Gecko metadata, but store readiness also requires
runtime compatibility testing.

Upload `focusgate-firefox.zip`, then provide the same privacy URL, support URL,
listing copy, screenshots, and permission explanations.

## 6. After each store approves

1. Install the approved listing from that store.
2. Test a fresh install and an update over the previous version.
3. Test onboarding, a blocked site, keyword blocking, schedules, daily
   allowances, focus sessions, notifications, and settings lock behavior.
4. Check the browser's extensions page for errors.
5. Keep the store listing, privacy policy, and actual behavior synchronized.

## 7. Future releases

For every release:

1. Increase the version in `public/manifest.json`.
2. Run `npm run lint`.
3. Run `npm run package:all`.
4. Test the browser packages.
5. Upload the new ZIP to each store.
6. Publish a release note explaining user-visible changes.

The store dashboards, publisher verification, payment/tax forms, and review
decisions must be completed by the publisher account owner.