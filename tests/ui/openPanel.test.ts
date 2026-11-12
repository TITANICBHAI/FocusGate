import { describe, expect, it, vi } from "vitest";
import { openFocusGatePanel, type PanelOpenerApi } from "../../src/ui/lib/openPanel";

function api(overrides: Partial<PanelOpenerApi> = {}): PanelOpenerApi & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    runtime: { getURL: (path: string) => `chrome-extension://id/${path}` },
    tabs: {
      create: vi.fn(async () => {
        calls.push("tabs.create");
        return { id: 9 };
      }),
      getCurrent: vi.fn(async () => ({ id: 5 })),
      remove: vi.fn(async () => {
        calls.push("tabs.remove");
      }),
    },
    ...overrides,
  };
}

describe("opening FocusGate from the finished setup", () => {
  it("opens the Chrome and Edge side panel before waiting for anything, so the click still counts", () => {
    const open = vi.fn(async () => undefined);
    const a = api({ sidePanel: { open } });
    void openFocusGatePanel(a, 77);
    expect(open).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledWith({ windowId: 77 });
  });

  it("reports that the side panel opened and closes the setup tab", async () => {
    const a = api({ sidePanel: { open: vi.fn(async () => undefined) } });
    await expect(openFocusGatePanel(a, 77)).resolves.toBe("sidepanel");
    expect(a.tabs.remove).toHaveBeenCalledWith(5);
  });

  it("opens the Firefox sidebar with no arguments, before waiting for anything", () => {
    const open = vi.fn(async () => undefined);
    const a = api({ sidebarAction: { open } });
    void openFocusGatePanel(a, undefined);
    expect(open).toHaveBeenCalledTimes(1);
    expect(open.mock.calls[0]).toEqual([]);
  });

  it("reports the Firefox sidebar", async () => {
    const a = api({ sidebarAction: { open: vi.fn(async () => undefined) } });
    await expect(openFocusGatePanel(a, undefined)).resolves.toBe("sidebar");
  });

  it("opens the panel page in a tab when there is no side panel or sidebar (Firefox on Android)", async () => {
    const a = api();
    await expect(openFocusGatePanel(a, undefined)).resolves.toBe("tab");
    expect(a.tabs.create).toHaveBeenCalledWith({ url: "chrome-extension://id/panel.html" });
    expect(a.calls).toEqual(["tabs.create", "tabs.remove"]);
  });

  it("falls back to a tab when the side panel refuses to open", async () => {
    const a = api({ sidePanel: { open: vi.fn(async () => { throw new Error("user gesture required"); }) } });
    await expect(openFocusGatePanel(a, 3)).resolves.toBe("tab");
  });

  it("falls back to a tab when the Firefox sidebar refuses to open", async () => {
    const a = api({ sidebarAction: { open: vi.fn(async () => { throw new Error("not allowed"); }) } });
    await expect(openFocusGatePanel(a, undefined)).resolves.toBe("tab");
  });

  it("reports failure when nothing at all can be opened", async () => {
    const a = api();
    a.tabs.create = vi.fn(async () => { throw new Error("no"); });
    await expect(openFocusGatePanel(a, undefined)).resolves.toBe("failed");
    expect(a.tabs.remove).not.toHaveBeenCalled();
  });

  it("still reports success when the setup tab cannot be closed", async () => {
    const a = api({ sidePanel: { open: vi.fn(async () => undefined) } });
    a.tabs.remove = vi.fn(async () => { throw new Error("gone"); });
    await expect(openFocusGatePanel(a, 1)).resolves.toBe("sidepanel");
  });
});
