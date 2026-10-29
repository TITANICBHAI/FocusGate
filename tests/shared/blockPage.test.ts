import { describe, expect, it } from "vitest";
import { quoteForLocalDate } from "../../src/shared/blockPage.ts";
import { createDefaultState } from "../../src/shared/defaults.ts";

describe("daily block-page quote", () => {
  it("uses the requested default message", () => {
    expect(createDefaultState().settings.blockPage.message).toBe(
      "Stay focused. You've got this.",
    );
  });

  it("selects one stable non-empty quote per local date", () => {
    const quotes = [" First ", "", "Second"];
    expect(quoteForLocalDate(quotes, "2026-10-29")).toBe(
      quoteForLocalDate(quotes, "2026-10-29"),
    );
    expect(["First", "Second"]).toContain(
      quoteForLocalDate(quotes, "2026-10-29"),
    );
    expect(quoteForLocalDate(["", "  "], "2026-10-29")).toBeUndefined();
  });
});
