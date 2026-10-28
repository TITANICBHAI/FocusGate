import { describe, expect, it } from "vitest";
import {
  ALIASES,
  aliasGroup,
  expandAliases,
  matchException,
  matchesDomain,
  normalizeDomain,
  normalizeException,
} from "../../src/shared/domains.ts";

describe("domain and exception helpers", () => {
  it("normalizes pasted URLs, case, www, ports, and IDNs", () => {
    expect(normalizeDomain("https://www.Reddit.com/r/all")).toBe("reddit.com");
    expect(normalizeDomain("example.com:8443/path")).toBe("example.com");
    expect(normalizeDomain("bücher.example")).toBe("xn--bcher-kva.example");
  });

  it("accepts exact local and IP hosts and rejects malformed input", () => {
    expect(normalizeDomain("localhost")).toBe("localhost");
    expect(normalizeDomain("127.0.0.1")).toBe("127.0.0.1");
    expect(normalizeDomain("[2001:db8::1]")).toBe("[2001:db8::1]");
    for (const value of ["", "bad host", "site,other", "https://", "ftp://example.com"]) {
      expect(normalizeDomain(value)).toBeNull();
    }
  });

  it("matches only exact domains and dot-boundary subdomains", () => {
    expect(matchesDomain("a.b.example.com", "example.com")).toBe(true);
    expect(matchesDomain("example.com", "example.com")).toBe(true);
    expect(matchesDomain("notexample.com", "example.com")).toBe(false);
    expect(matchesDomain("example.com.au", "example.com")).toBe(false);
  });

  it("expands alias groups without duplicates", () => {
    expect(ALIASES["x.com"]).toContain("twitter.com");
    expect(aliasGroup("www.twitter.com")).toEqual(["x.com", "twitter.com", "t.co"]);
    expect(expandAliases(["x.com", "twitter.com"])).toEqual([
      "x.com",
      "twitter.com",
      "t.co",
    ]);
  });

  it("normalizes path exceptions and matches only URL boundaries", () => {
    const exception = normalizeException("youtube.com/watch?v=abc");
    expect(exception).toBe("youtube.com/watch?v=abc");
    expect(
      matchException("https://www.youtube.com/watch?v=abc&t=5", [exception!]),
    ).toBe(true);
    expect(
      matchException("https://www.youtube.com/watch?v=abc#comments", [exception!]),
    ).toBe(true);
    expect(normalizeException("youtube.com/watch?v=abc#comments")).toBe(exception);
    expect(matchException("https://youtube.com/watch?v=abcd", [exception!])).toBe(
      false,
    );
    expect(matchException("https://youtube.com.evil.test/watch?v=abc", [exception!])).toBe(
      false,
    );
    expect(matchException("https://youtube.com/", ["youtube.com"])).toBe(true);
    expect(normalizeException(`example.com/${"x".repeat(205)}`)).toBeNull();
  });
});
