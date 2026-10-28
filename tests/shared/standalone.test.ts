import { describe, expect, it } from "vitest";
import {
  countMatchingStandaloneTabs,
  fromLocalDateTimeInput,
  isValidStandaloneExpiry,
  normalizeStandaloneSites,
  toLocalDateTimeInput,
} from "../../src/shared/standalone.ts";

describe("standalone helpers", () => {
  it("accepts finite absolute expiry values from five minutes through thirty days", () => {
    const now = 1_000_000;
    expect(isValidStandaloneExpiry(now + 5 * 60_000, now)).toBe(true);
    expect(isValidStandaloneExpiry(now + 30 * 24 * 60 * 60_000, now)).toBe(true);
    expect(isValidStandaloneExpiry(now + 4 * 60_000, now)).toBe(false);
    expect(isValidStandaloneExpiry(now + 30 * 24 * 60 * 60_000 + 1, now)).toBe(false);
    expect(isValidStandaloneExpiry(now + 5 * 60_000 + 0.5, now)).toBe(false);
    expect(isValidStandaloneExpiry(Number.NaN, now)).toBe(false);
  });

  it("normalizes and de-duplicates the standalone site list", () => {
    expect(
      normalizeStandaloneSites([
        "https://www.example.com/path",
        "example.com",
      ]),
    ).toEqual(["example.com"]);
    expect(normalizeStandaloneSites(["example.com", "bad domain"])).toBeNull();
    expect(normalizeStandaloneSites([])).toBeNull();
  });

  it("matches supported open tabs against exact domains and subdomains", () => {
    expect(
      countMatchingStandaloneTabs(
        [
          { url: "https://example.com" },
          { url: "https://www.example.com/path" },
          { url: "https://notexample.com" },
          { url: "chrome://extensions" },
          {},
        ],
        ["example.com"],
      ),
    ).toBe(2);
  });

  it("round-trips local datetime input and rejects malformed dates", () => {
    const timestamp = new Date(2026, 9, 29, 13, 45).getTime();
    const input = toLocalDateTimeInput(timestamp);
    expect(fromLocalDateTimeInput(input)).toBe(timestamp);
    expect(fromLocalDateTimeInput("not-a-date")).toBeNull();
    expect(fromLocalDateTimeInput("2026-02-30T09:15")).toBeNull();
  });
});
