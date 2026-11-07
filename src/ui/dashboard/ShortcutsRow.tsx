import { useEffect, useState } from "react";
import { Button } from "../components/primitives.tsx";

export const SHORTCUTS_URL = "chrome://extensions/shortcuts";

export interface ShortcutCommand {
  name?: string;
  description?: string;
  shortcut?: string;
}

export interface ShortcutRow {
  name: string;
  label: string;
  /** null when nothing is bound to the command. */
  key: string | null;
}

/** The browser's own toolbar-click command is not a keyboard shortcut we offer. */
const BROWSER_COMMANDS = new Set(["_execute_action", "_execute_browser_action"]);

export function shortcutRows(commands: readonly ShortcutCommand[]): ShortcutRow[] {
  const rows: ShortcutRow[] = [];
  for (const command of commands) {
    const name = command.name ?? "";
    if (!name || BROWSER_COMMANDS.has(name)) continue;
    rows.push({
      name,
      label: command.description || name,
      key: command.shortcut ? command.shortcut : null,
    });
  }
  return rows;
}

/** Reads the live bindings. Returns an empty list when the browser will not say. */
export async function loadCommands(): Promise<ShortcutCommand[]> {
  try {
    return (await chrome.commands.getAll()) ?? [];
  } catch {
    return [];
  }
}

export function openShortcutsPage(): void {
  try {
    void chrome.tabs.create({ url: SHORTCUTS_URL });
  } catch {
    // No tabs api (a test, or a page outside the extension): nothing to open.
  }
}

export function ShortcutsList({
  commands,
  onChange,
}: {
  commands: readonly ShortcutCommand[];
  onChange: () => void;
}) {
  const rows = shortcutRows(commands);
  return (
    <>
      {rows.length === 0 && (
        <p className="fg-muted">
          FocusGate could not read your shortcuts here. Chrome has the full list.
        </p>
      )}
      {rows.map((row) => (
        <div className="fg-row" key={row.name}>
          <div className="fg-row__copy">
            <span>{row.label}</span>
            {row.key === null && (
              <span className="fg-field__helper">
                Not set. Another app or Chrome itself may be using this key.
              </span>
            )}
          </div>
          <div className="fg-row__actions">
            {row.key !== null ? <kbd className="fg-kbd">{row.key}</kbd> : <strong>Not set</strong>}
          </div>
        </div>
      ))}
      <div className="fg-wrap">
        <Button onClick={onChange}>Change in Chrome</Button>
      </div>
    </>
  );
}

export function ShortcutsRow() {
  const [commands, setCommands] = useState<ShortcutCommand[]>([]);
  useEffect(() => {
    let live = true;
    void loadCommands().then((found) => {
      if (live) setCommands(found);
    });
    return () => {
      live = false;
    };
  }, []);
  return <ShortcutsList commands={commands} onChange={openShortcutsPage} />;
}
