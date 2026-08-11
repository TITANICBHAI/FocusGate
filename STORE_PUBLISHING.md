# Browser store publishing checklist

This project produces browser-specific Manifest V3 ZIPs. Store review is
separate from building the ZIPs: each store requires its own listing, assets,
privacy disclosures, and review submission.

## Chrome Web Store

1. Create a Chrome Web Store developer account.
2. Upload `build/focusgate-chrome.zip` from a successful GitHub Actions run.
3. Add the store name, short and detailed descriptions, category, language,
   screenshots, and a 1280×800 or 640×400 promotional image if requested.
4. Explain why the extension needs each permission, especially broad host
   access, tabs, scripting, web navigation, alarms, notifications, and
   declarative network request access.
5. Publish a public privacy-policy URL. The policy should accurately describe
   what is stored locally and whether any data leaves the device.
6. Submit the item for review.

## Microsoft Edge Add-ons

Edge accepts Chromium extension packages, but it has a separate partner
account, listing, review, and privacy-policy process.

1. Create or use a Microsoft Partner Center account.
2. Upload the same ZIP after testing it in Edge.
3. Complete the Edge listing and permission disclosures.
4. Add screenshots and the public privacy-policy URL.
5. Submit the listing for certification.

## Firefox Add-ons (AMO)

Do not assume the Chromium ZIP is ready for Firefox publication. Before
submitting to AMO:

- Test the extension in Firefox and address API differences.
- Add Firefox-specific manifest metadata, including a stable Gecko extension
  ID when required by the AMO submission.
- Confirm that the background service worker, declarative networking rules,
  notifications, navigation listeners, and content-script behavior work in
  Firefox.
- Review the permissions and host access requested by the Firefox build.
- Upload the Firefox-tested ZIP to Mozilla Add-ons and complete its source-code
  review requirements.

The temporary-install instructions are in the main
[`README.md`](README.md). Firefox-specific compatibility work should be
completed before advertising the extension as Firefox-supported.

## Release checklist

- [ ] Update the version in `public/manifest.json`.
- [ ] Run the GitHub Actions build successfully.
- [ ] Download and inspect the ZIP; `manifest.json` must be at its root.
- [ ] Test installation in every browser being listed.
- [ ] Test a fresh install and an upgrade from the previous version.
- [ ] Check the extension's permission warnings and store disclosures.
- [ ] Confirm the privacy policy and support URLs are public and current.
- [ ] Create a version tag such as `v1.0.0` and attach the generated ZIP to
      the GitHub Release.