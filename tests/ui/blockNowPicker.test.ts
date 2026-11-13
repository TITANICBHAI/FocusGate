import { describe, expect, it } from "vitest";
import { createDefaultState } from "../../src/shared/defaults.ts";
import {
  addDomainsToText,
  domainsInText,
  pickableGroups,
  removeDomainsFromText,
  toggleDomainInText,
} from "../../src/ui/lib/blockNowPicker.ts";

describe("Block now site picker", () => {
  it("adds domains one per line and skips ones already typed", () => {
    expect(addDomainsToText("", ["reddit.com", "x.com"])).toBe("reddit.com\nx.com");
    expect(addDomainsToText("https://www.reddit.com/r/a", ["reddit.com", "x.com"])).toBe(
      "https://www.reddit.com/r/a\nx.com",
    );
    expect(addDomainsToText("reddit.com", ["reddit.com"])).toBe("reddit.com");
  });

  it("toggles a domain on and off, even when typed as a URL", () => {
    let text = toggleDomainInText("", "reddit.com");
    expect(domainsInText(text)).toEqual(["reddit.com"]);
    text = toggleDomainInText("https://www.reddit.com/\nx.com", "reddit.com");
    expect(domainsInText(text)).toEqual(["x.com"]);
  });

  it("keeps unreadable entries when removing domains", () => {
    expect(removeDomainsFromText("reddit.com, not a site!!", ["reddit.com"])).toBe(
      "not a site!!",
    );
  });

  it("offers rule sites first and hides ones already in the running block", () => {
    const state = createDefaultState();
    state.blockedSites = ["youtube.com", "https://www.reddit.com/"];
    state.alwaysBlockedSites = ["bet365.com"];
    const groups = pickableGroups(state, ["reddit.com"]);
    expect(groups[0]).toMatchObject({ id: "focus", domains: ["youtube.com"] });
    expect(groups[1]).toMatchObject({ id: "always", domains: ["bet365.com"] });
    expect(groups.some((group) => group.id === "preset-social")).toBe(true);
    expect(groups.some((group) => group.id === "preset-deep-focus")).toBe(false);
    expect(groups.flatMap((group) => group.domains)).not.toContain("reddit.com");
  });

  it("drops empty groups", () => {
    const groups = pickableGroups(createDefaultState());
    expect(groups.some((group) => group.id === "focus")).toBe(false);
    expect(groups.some((group) => group.id === "always")).toBe(false);
  });
});
