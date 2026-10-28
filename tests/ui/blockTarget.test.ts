import { describe, expect, it } from "vitest";
import { parseBlockTarget } from "../../src/ui/lib/blockTarget.ts";

describe("block page target parsing", () => {
  it("accepts unencoded and encoded web URLs", () => {
    expect(parseBlockTarget("#https://www.example.com/a?q=one%20two")).toBe(
      "https://www.example.com/a?q=one%20two",
    );
    expect(
      parseBlockTarget(`#${encodeURIComponent("https://example.com/path?q=hello world")}`),
    ).toBe("https://example.com/path?q=hello%20world");
  });

  it("rejects non-web, malformed, and empty fragments", () => {
    expect(parseBlockTarget("#javascript:alert(1)")).toBeNull();
    expect(parseBlockTarget("#chrome://settings")).toBeNull();
    expect(parseBlockTarget("#%E0%A4%A")).toBeNull();
    expect(parseBlockTarget("#")).toBeNull();
  });
});
