import { describe, expect, it } from "vitest";
import { aliasesForSiteDisplay } from "../../src/ui/lib/aliasPresentation.ts";

describe("site alias presentation", () => {
  it("shows the other members of a known alias group", () => {
    expect(aliasesForSiteDisplay("x.com")).toEqual(["twitter.com", "t.co"]);
    expect(aliasesForSiteDisplay("https://www.twitter.com/profile")).toEqual([
      "x.com",
      "t.co",
    ]);
  });

  it("returns no alias chips for invalid or ungrouped domains", () => {
    expect(aliasesForSiteDisplay("example.com")).toEqual([]);
    expect(aliasesForSiteDisplay("not a domain")).toEqual([]);
  });
});
