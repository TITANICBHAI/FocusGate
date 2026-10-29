import { describe, expect, it } from "vitest";
import { quickBlockTarget } from "../../src/shared/quickBlock.ts";

describe("quick block target", () => {
  it("normalizes the current web URL and includes its alias group", () => {
    expect(quickBlockTarget("https://www.x.com/post/1?x=2")).toEqual({
      url: "https://www.x.com/post/1?x=2",
      domain: "x.com",
      domains: ["x.com", "twitter.com", "t.co"],
    });
  });

  it("rejects unsupported and malformed URLs", () => {
    expect(quickBlockTarget("chrome://extensions")).toBeNull();
    expect(quickBlockTarget("not a url")).toBeNull();
    expect(quickBlockTarget(undefined)).toBeNull();
  });
});
