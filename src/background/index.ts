// WP5 atomic cutover: the v2 worker composition is the active background.
// The v1 bridge was removed together with the manifest's v1 routes in the
// same change.
import { createChromeWorker } from "./chrome.ts";

const worker = createChromeWorker();
worker.start();
