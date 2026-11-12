/**
 * Opens FocusGate's own panel from the finished setup screen.
 *
 * Chrome and Edge only open the side panel while the click that asked for it is still "fresh",
 * and Firefox only opens its sidebar the same way. So the first call below is made before
 * anything is awaited. Where neither exists (Firefox on Android) the panel page opens in a tab.
 */

export interface PanelOpenerApi {
  runtime: { getURL(path: string): string };
  tabs: {
    create(options: { url: string }): Promise<unknown>;
    getCurrent(): Promise<{ id?: number } | undefined>;
    remove(tabId: number): Promise<void>;
  };
  sidePanel?: { open(options: { windowId: number }): Promise<void> };
  sidebarAction?: { open(): Promise<void> };
}

export type PanelOpenResult = "sidepanel" | "sidebar" | "tab" | "failed";

/** The id Chrome accepts for "the window this page is in". */
const CURRENT_WINDOW = -2;

async function closeSetupTab(api: PanelOpenerApi): Promise<void> {
  try {
    const tab = await api.tabs.getCurrent();
    if (tab?.id !== undefined) await api.tabs.remove(tab.id);
  } catch {
    // The panel is open; a setup tab that stays is harmless.
  }
}

export async function openFocusGatePanel(api: PanelOpenerApi, windowId: number | undefined): Promise<PanelOpenResult> {
  let opened: PanelOpenResult | null = null;
  try {
    if (api.sidePanel) {
      await api.sidePanel.open({ windowId: windowId ?? CURRENT_WINDOW });
      opened = "sidepanel";
    } else if (api.sidebarAction) {
      await api.sidebarAction.open();
      opened = "sidebar";
    }
  } catch {
    opened = null;
  }
  if (opened) {
    await closeSetupTab(api);
    return opened;
  }
  try {
    await api.tabs.create({ url: api.runtime.getURL("panel.html") });
  } catch {
    return "failed";
  }
  await closeSetupTab(api);
  return "tab";
}
