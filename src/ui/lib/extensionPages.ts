/**
 * Opens a page of this extension in a new tab. Says whether it worked and
 * never throws: a browser with no window to open it in is an answer, not a crash.
 */
export async function openExtensionPage(path: string): Promise<boolean> {
  if (typeof chrome === "undefined" || !chrome.tabs?.create) return false;
  try {
    await chrome.tabs.create({ url: chrome.runtime.getURL(path) });
    return true;
  } catch {
    return false;
  }
}
