import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The secret is a password, in the words a person reads and in the code too. "PIN" was its name in
 * an earlier Phase 8 build; the owner chose "password" because a long password is harder to guess
 * and harder to type. This reads every source file, comments and names included, so a half-finished
 * rename or a pasted "PIN" is caught.
 */
function sourceFiles(directory: string): string[] {
  const files: string[] = [];
  for (const name of readdirSync(directory)) {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) files.push(...sourceFiles(path));
    else if (/\.(ts|tsx|css)$/.test(name)) files.push(path);
  }
  return files;
}

/**
 * The word PIN or PINs; a constant such as PIN_MAX_LENGTH; names such as PinPicker, hasPin and
 * pinDraft; and class names or ids such as fg-pin-reveal. Ordinary words (spinner, pinned,
 * mapping, typing) are not matched.
 */
const LEFTOVER =
  /\bPINs?\b|\bPIN_[A-Z_]+|\bPin(?=[A-Z])|(?<=[a-z0-9])Pin(?=[A-Z]|\b)|\bpin(?=[A-Z])|[-_]pin(?![A-Za-z])|(?<![A-Za-z])pin[-_]/;

export function pinLeftovers(file: string, source: string): string[] {
  const found: string[] = [];
  source.split("\n").forEach((line, index) => {
    if (LEFTOVER.test(line)) found.push(`${file}:${index + 1}: ${line.trim()}`);
  });
  return found;
}

describe("password wording", () => {
  it("never says PIN in the source, in words, comments or names", () => {
    const found: string[] = [];
    for (const file of sourceFiles("src")) {
      found.push(...pinLeftovers(file, readFileSync(file, "utf8")));
    }
    expect(found).toEqual([]);
  });

  it("has no PIN-named source files", () => {
    const names = sourceFiles("src").filter((file) => /(^|[\\/])(.*[a-z])?[Pp]in[A-Z]/.test(file));
    expect(names).toEqual([]);
  });

  it("flags the old words and names", () => {
    expect(pinLeftovers("a.tsx", 'const m = "Enter your PIN";')).toHaveLength(1);
    expect(pinLeftovers("a.tsx", "// A PIN is shown once")).toHaveLength(1);
    expect(pinLeftovers("a.ts", "export const PIN_MAX_LENGTH = 64;")).toHaveLength(1);
    expect(pinLeftovers("a.tsx", "<PinPicker />")).toHaveLength(1);
    expect(pinLeftovers("a.ts", "const hasPin = true;")).toHaveLength(1);
    expect(pinLeftovers("a.ts", "import { pinDraftError } from './x';")).toHaveLength(1);
    expect(pinLeftovers("a.css", ".fg-pin-reveal { color: red; }")).toHaveLength(1);
  });

  it("leaves ordinary words alone", () => {
    const text = [
      "const spinner = typing + mapping + shipping;",
      "// Pin FocusGate to the toolbar, then open the pinned tab.",
      'const label = "Pin the extension";',
      "const opinion = spinning;",
    ].join("\n");
    expect(pinLeftovers("a.ts", text)).toEqual([]);
  });
});
