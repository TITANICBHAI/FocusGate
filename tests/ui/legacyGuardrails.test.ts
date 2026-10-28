import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const legacyUi = readFileSync(
  new URL("../../src/App.tsx", import.meta.url),
  "utf8",
);

describe("active legacy UI guardrails", () => {
  it("keeps feedback non-blocking and closes extension tabs through the tabs API", () => {
    expect(legacyUi).not.toMatch(/\balert\s*\(/);
    expect(legacyUi).not.toMatch(/\bconfirm\s*\(/);
    expect(legacyUi).not.toMatch(/\bprompt\s*\(/);
    expect(legacyUi).not.toMatch(/window\.close\s*\(/);
    expect(legacyUi).toContain("chrome.tabs.remove");
    expect(legacyUi).toContain('aria-live="polite"');
  });

  it("keeps the 12px text floor and avoids banned overclaims", () => {
    expect(legacyUi).not.toMatch(/text-\[(?:10|11)px\]/);
    expect(legacyUi).not.toMatch(/\b(?:completely|instantly|cannot|guaranteed|unbreakable)\b/i);
    expect(legacyUi).toContain('reducedMotion="user"');
  });

  it("limits commitment-task deletion to its linked active session", () => {
    expect(legacyUi).toContain(
      "isDeleteLocked={isActive && activeTaskId === task.id && timerLockLevel === 'commitment'}",
    );
    expect(legacyUi).toContain("isDeleteLocked ? (");
  });
});
