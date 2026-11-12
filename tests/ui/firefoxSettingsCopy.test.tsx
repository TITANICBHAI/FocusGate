import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { extensionSettingsAccess, isFirefox } from "../../src/ui/lib/protectionStatus.ts";
import { ShortcutsList } from "../../src/ui/dashboard/ShortcutsRow.tsx";

const commands = [
  { name: "toggle-focus", description: "Toggle Focus Session", shortcut: "Alt+Shift+F" },
  { name: "block-current-site", description: "Block the current site", shortcut: "" },
];
const FIREFOX = "Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0";
const CHROME = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36";

describe("telling Firefox apart", () => {
  it("is Firefox for desktop and for Android, and not Chrome", () => {
    expect(isFirefox(FIREFOX)).toBe(true);
    expect(isFirefox("Mozilla/5.0 (Android 15; Mobile; rv:140.0) Gecko/140.0 Firefox/140.0")).toBe(true);
    expect(isFirefox(CHROME)).toBe(false);
    expect(isFirefox("")).toBe(false);
  });
});

describe("the Shortcuts card in Firefox", () => {
  const html = renderToStaticMarkup(<ShortcutsList commands={commands} browser="firefox" onChange={() => undefined} />);

  it("names the browser correctly and does not offer a Chrome page", () => {
    expect(html).toContain("Firefox itself may be using this key.");
    expect(html).not.toContain("Chrome");
    expect(html).not.toContain("chrome://");
  });

  it("does not offer a button, because an extension cannot open Firefox's shortcut page", () => {
    expect(html).not.toContain("<button");
  });

  it("explains where to change a key, in order", () => {
    expect(html).toContain("Add-ons and themes");
    expect(html).toContain("Manage Extension Shortcuts");
  });

  it("explains the same when no shortcut could be read, as on Android", () => {
    const empty = renderToStaticMarkup(<ShortcutsList commands={[]} browser="firefox" onChange={() => undefined} />);
    expect(empty).toContain("Firefox has the full list");
    expect(empty).not.toContain("Chrome");
  });
});

describe("the Shortcuts card in Chrome is as it was", () => {
  it("keeps its wording and button", () => {
    const html = renderToStaticMarkup(<ShortcutsList commands={commands} onChange={() => undefined} />);
    expect(html).toContain("Change in Chrome");
    expect(html).toContain("Chrome itself may be using this key");
  });
});

describe("extension settings in Firefox", () => {
  it("gives steps, not a link, because Firefox does not let a page open about:addons", () => {
    const access = extensionSettingsAccess(FIREFOX, "focusgate@tbtechs.com");
    expect(access.href).toBeNull();
    expect(access.help).toContain("Add-ons and themes");
    expect(access.help).toContain("Permissions");
  });

  it("is a link in Chrome and Edge, with no steps", () => {
    expect(extensionSettingsAccess(CHROME, "abc")).toEqual({ href: "chrome://extensions/?id=abc", help: null });
    expect(extensionSettingsAccess("Edg/120 Chrome/120", "abc")).toEqual({ href: "edge://extensions/?id=abc", help: null });
  });

  it("is neither for a browser it does not know", () => {
    expect(extensionSettingsAccess("Safari/17", "abc")).toEqual({ href: null, help: null });
  });
});
