'use strict';

/**
 * Turns the shared Chromium Manifest V3 into the one Firefox loads.
 *
 * - Firefox does not run service workers, so the background runs as scripts.
 * - `sidePanel` and `minimum_chrome_version` mean nothing to Firefox, so they
 *   are dropped. Its own sidebar takes the place of the side panel (desktop).
 * - The toolbar button has no popup: the background handles the click (opens
 *   the sidebar, or the panel in a tab on Firefox for Android).
 * - A stable add-on id, a no-data declaration and the first Firefox versions
 *   that support both are added.
 *
 * It does not change the manifest it is given.
 */
function toFirefoxManifest(manifest) {
  if (manifest.manifest_version !== 3) {
    throw new Error('The Firefox manifest must use Manifest V3.');
  }
  const serviceWorker = manifest.background && manifest.background.service_worker;
  if (!serviceWorker) {
    throw new Error('The shared manifest must declare its Chromium service worker.');
  }

  const result = JSON.parse(JSON.stringify(manifest));
  const background = { ...result.background };
  delete background.service_worker;
  result.background = { ...background, scripts: [serviceWorker] };

  delete result.side_panel;
  delete result.minimum_chrome_version;
  result.permissions = (result.permissions || []).filter(
    (permission) => permission !== 'sidePanel',
  );

  result.sidebar_action = {
    default_title: 'FocusGate',
    default_panel: 'panel.html',
    default_icon: result.icons,
    open_at_install: false,
  };

  result.browser_specific_settings = {
    gecko: {
      id: 'focusgate@tbtechs.com',
      data_collection_permissions: { required: ['none'] },
      // Firefox desktop added built-in data consent in version 140.
      strict_min_version: '140.0',
    },
    gecko_android: {
      // Firefox for Android added built-in data consent in version 142.
      strict_min_version: '142.0',
    },
  };
  return result;
}

module.exports = { toFirefoxManifest };
