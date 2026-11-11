import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Every place in the UI that starts a session must ask about the password first
 * when the lock is Strict. Nothing here can click a button, so this reads the
 * sources: a new start point that skips the question fails this test.
 */
function sourceFiles(directory: string): string[] {
  const files: string[] = [];
  for (const name of readdirSync(directory)) {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) files.push(...sourceFiles(path));
    else if (/\.(ts|tsx)$/.test(name)) files.push(path);
  }
  return files;
}

const START = /type: "session\/start"/g;
const ASK = /strictPassword\.ask\(/g;

function positions(text: string, pattern: RegExp): number[] {
  return [...text.matchAll(new RegExp(pattern.source, "g"))].map((match) => match.index ?? -1);
}

const startFiles = sourceFiles("src/ui")
  .map((file) => ({ file: file.split("\\").join("/"), text: readFileSync(file, "utf8") }))
  .filter(({ text }) => positions(text, START).length > 0);

describe("Strict start asks about the password", () => {
  it("starts sessions from the Focus screen and the Tasks list, and nowhere else", () => {
    expect(startFiles.map(({ file }) => file).sort()).toEqual([
      "src/ui/panel/views/FocusScreen.tsx",
      "src/ui/panel/views/TasksView.tsx",
    ]);
  });

  it("asks before each start, and shows the question", () => {
    for (const { file, text } of startFiles) {
      const starts = positions(text, START);
      const asks = positions(text, ASK);
      expect(asks.length, `${file}: one question per start`).toBe(starts.length);
      starts.forEach((start, index) => {
        expect(asks[index], `${file}: the question comes before the start`).toBeLessThan(start);
      });
      expect(text, `${file}: the sheet is on screen`).toContain("{strictPassword.sheet}");
      expect(text, `${file}: the hook is used`).toContain("useStrictPassword(");
    }
  });

  it("stops when the question is cancelled", () => {
    for (const { file, text } of startFiles) {
      const asked = text.match(/await strictPassword\.ask\(/g)?.length ?? 0;
      const returnsOnCancel =
        text.match(/if \(!\(await strictPassword\.ask\([^)]*\)\)\) return;/g)?.length ?? 0;
      expect(returnsOnCancel, `${file}: every question returns when cancelled`).toBe(asked);
    }
  });
});
