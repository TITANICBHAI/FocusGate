import { afterEach, describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  SHORTCUTS_URL,
  ShortcutsList,
  loadCommands,
  openShortcutsPage,
  shortcutRows,
} from "../../src/ui/dashboard/ShortcutsRow.tsx";

type Fake = { chrome?: unknown };
afterEach(() => {
  delete (globalThis as Fake).chrome;
});

const commands = [
  { name: "toggle-focus", description: "Toggle Focus Session", shortcut: "Alt+Shift+F" },
  { name: "block-current-site", description: "Block the current site", shortcut: "" },
];

describe("shortcut rows", () => {
  it("shows the live key, or Not set", () => {
    expect(shortcutRows(commands)).toEqual([
      { name: "toggle-focus", label: "Toggle Focus Session", key: "Alt+Shift+F" },
      { name: "block-current-site", label: "Block the current site", key: null },
    ]);
  });

  it("falls back to the command name when there is no description", () => {
    expect(shortcutRows([{ name: "x", shortcut: "Ctrl+Q" }])[0]?.label).toBe("x");
  });

  it("skips the browser's own action command", () => {
    expect(shortcutRows([{ name: "_execute_action", shortcut: "" }])).toEqual([]);
  });
});

describe("shortcut list", () => {
  it("names each key and explains an empty one", () => {
    const html = renderToStaticMarkup(<ShortcutsList commands={commands} onChange={() => undefined} />);
    expect(html).toContain("Toggle Focus Session");
    expect(html).toContain("Alt+Shift+F");
    expect(html).toContain("Not set. Another app or Chrome itself may be using this key.");
    expect(html).toContain("Change in Chrome");
  });

  it("still offers the button when nothing could be read", () => {
    const html = renderToStaticMarkup(<ShortcutsList commands={[]} onChange={() => undefined} />);
    expect(html).toContain("Change in Chrome");
  });
});

describe("browser calls", () => {
  it("reads chrome.commands.getAll", async () => {
    (globalThis as Fake).chrome = { commands: { getAll: async () => commands } };
    expect(await loadCommands()).toEqual(commands);
  });

  it("returns an empty list when the call fails", async () => {
    (globalThis as Fake).chrome = {
      commands: {
        getAll: async () => {
          throw new Error("no");
        },
      },
    };
    expect(await loadCommands()).toEqual([]);
    delete (globalThis as Fake).chrome;
    expect(await loadCommands()).toEqual([]);
  });

  it("opens Chrome's shortcut page in a new tab", () => {
    const created: unknown[] = [];
    (globalThis as Fake).chrome = { tabs: { create: (props: unknown) => created.push(props) } };
    openShortcutsPage();
    expect(created).toEqual([{ url: "chrome://extensions/shortcuts" }]);
    expect(SHORTCUTS_URL).toBe("chrome://extensions/shortcuts");
  });

  it("does nothing without the tabs api", () => {
    expect(() => openShortcutsPage()).not.toThrow();
  });
});
