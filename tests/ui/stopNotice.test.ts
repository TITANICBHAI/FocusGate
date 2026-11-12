import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { STOP_EARLY_NOTICE } from "../../src/ui/lib/stopNotice.ts";

const read = (path: string): string => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

describe("telling a person what stopping early does to their numbers", () => {
  it("says the minutes show as focused time but do not count toward the goal or the streak", () => {
    expect(STOP_EARLY_NOTICE).toBe(
      "Minutes before you stop show as focused time, but they don’t count toward today’s goal or your streak.",
    );
  });

  it("uses none of the words the copy rules ban", () => {
    expect(STOP_EARLY_NOTICE).not.toMatch(/completely|instantly|cannot|always|guaranteed/i);
  });

  it("is shown in the stop dialog, ahead of the password or phrase field", () => {
    const focus = read("src/ui/panel/views/FocusScreen.tsx");
    const form = focus.slice(focus.indexOf('<form id="stop-session-form"'));
    expect(focus).toContain('from "../../lib/stopNotice.ts"');
    expect(form).toContain("{STOP_EARLY_NOTICE}");
    expect(form.indexOf("{STOP_EARLY_NOTICE}")).toBeLessThan(form.indexOf('id="stop-credential"'));
  });

  it("is also shown when no lock is set, where the dialog has no field at all", () => {
    const focus = read("src/ui/panel/views/FocusScreen.tsx");
    const form = focus.slice(focus.indexOf('<form id="stop-session-form"'));
    const notice = form.indexOf("{STOP_EARLY_NOTICE}");
    const lockCheck = form.indexOf('lockLevel !== "none"');
    expect(notice).toBeGreaterThan(-1);
    expect(notice).toBeLessThan(lockCheck);
  });
});
