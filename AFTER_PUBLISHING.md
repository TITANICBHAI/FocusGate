# What to do after publishing FocusGate

Publishing the docs site and submitting a store listing are two different
steps. Start with Edge using the sequence below.

## 1. Publish the FocusGate website

In Replit, click **Publish** and publish the configured static site. The
deployment is configured to serve the `docs/` folder.

After publishing, copy the public site URL and confirm these pages work in an
incognito window:

- `https://YOUR-PUBLISHED-DOMAIN/privacy-policy.html`
- `https://YOUR-PUBLISHED-DOMAIN/support.html`

Replace the placeholder URL fields in `STORE_LISTING.md` with that real public
URL. Do not use a `.replit.dev` preview URL for store listings.

## 2. Create the Edge listing and upload the extension

Open the official Microsoft Edge Add-ons developer dashboard:

<https://partner.microsoft.com/dashboard/microsoftedge/public/login>

1. Sign in with the Microsoft account that will own the extension.
2. Register as an Edge extension developer if Microsoft asks you to do so.
3. Choose **Create new extension**.
4. Upload `build/store-submission/focusgate-extension.zip`.
5. Use the name, descriptions, permission explanations, privacy URL, support
   URL, icon, and screenshots from `STORE_LISTING.md` and
   `build/store-submission/store-assets/`.
6. Choose public visibility and the markets where you want FocusGate
   available.
7. Submit the listing for certification.

Upload only the Chromium package for Edge. Do not upload `focusgate-firefox.zip`,
`zipFile.zip`, the repository ZIP, the `dist/` folder, or the whole `build/`
folder. The uploaded ZIP must contain `manifest.json` at its root.

## 3. Build the final upload bundle

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

## 4. Submit to Chrome Web Store

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

## 5. Submit to Microsoft Edge Add-ons

Edge submission is documented in Step 2 above. Edge accepts the Chromium
package, but its listing and review are separate from Chrome.

## 6. Submit to Firefox Add-ons

Only do this after loading and testing `focusgate-firefox.zip` in Firefox.
The Firefox package includes Gecko metadata, but store readiness also requires
runtime compatibility testing.

Upload `focusgate-firefox.zip`, then provide the same privacy URL, support URL,
listing copy, screenshots, and permission explanations.

## 7. After each store approves

1. Install the approved listing from that store.
2. Test a fresh install and an update over the previous version.
3. Test onboarding, a blocked site, keyword blocking, schedules, daily
   allowances, focus sessions, notifications, and settings lock behavior.
4. Check the browser's extensions page for errors.
5. Keep the store listing, privacy policy, and actual behavior synchronized.

## 8. Future releases

For every release:

1. Increase the version in `public/manifest.json`.
2. Run `npm run lint`.
3. Run `npm run package:all`.
4. Test the browser packages.
5. Upload the new ZIP to each store.
6. Publish a release note explaining user-visible changes.

The store dashboards, publisher verification, payment/tax forms, and review
decisions must be completed by the publisher account owner.