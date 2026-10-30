import { describe, expect, it } from "vitest";
import { blockScopeSummary } from "../../src/ui/lib/blockSummary.ts";

describe("blockScopeSummary", () => {
  it("pluralizes counts above one and keeps the spec example singular", () => {
    expect(blockScopeSummary(6, 3, 1)).toBe("6 sites · 3 keywords · 1 schedule");
  });

  it("uses singular forms for one and zero counts", () => {
    expect(blockScopeSummary(1, 1, 1)).toBe("1 site · 1 keyword · 1 schedule");
    expect(blockScopeSummary(0, 0, 0)).toBe("0 sites · 0 keywords · 0 schedules");
    expect(blockScopeSummary(2, 0, 1)).toBe("2 sites · 0 keywords · 1 schedule");
  });
});
