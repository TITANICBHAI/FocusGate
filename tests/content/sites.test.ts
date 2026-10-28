import { describe, expect, it } from "vitest";
import {
  buildFilterCss,
  CONTENT_SCRIPT_MATCHES,
  CONTENT_SITES,
  getContentSiteForHost,
  getContentSiteForUrl,
  getEnabledKeywordTargets,
  getSiteSelectors,
} from "../../src/content/sites.ts";
import { EXISTING_USER_CONTENT_FILTER_DEFAULTS } from "../../src/shared/contentFilterDefaults.ts";
import { createDefaultState } from "../../src/shared/defaults.ts";

describe("content filter site table", () => {
  it("matches exact hosts and dot-boundary subdomains only", () => {
    expect(getContentSiteForHost("youtube.com")?.hosts).toContain("youtube.com");
    expect(getContentSiteForHost("m.youtube.com")?.hosts).toContain("youtube.com");
    expect(getContentSiteForHost("notyoutube.com")).toBeUndefined();
    expect(getContentSiteForHost("youtube.com.evil.test")).toBeUndefined();
  });

  it("limits Google result filtering to www.google.com/search", () => {
    expect(
      getContentSiteForUrl(new URL("https://www.google.com/search?q=focus")),
    ).toBeDefined();
    expect(
      getContentSiteForUrl(new URL("https://www.google.com/")),
    ).toBeUndefined();
    expect(
      getContentSiteForUrl(new URL("https://www.google.co.uk/search?q=focus")),
    ).toBeUndefined();
  });

  it("keeps content script host patterns aligned with the active manifest", async () => {
    const manifest = await import("../../public/manifest.json");
    expect(manifest.content_scripts[0].matches).toEqual(CONTENT_SCRIPT_MATCHES);
    expect(manifest.content_scripts[0].js).toEqual(["content.js"]);
  });

  it("keeps the three legacy unconditional filters enabled for migrated users", () => {
    const filters = CONTENT_SITES.flatMap((site) => site.filters);
    for (const [id, expected] of Object.entries(
      EXISTING_USER_CONTENT_FILTER_DEFAULTS,
    )) {
      expect(filters.find((filter) => filter.id === id)?.defaultForExistingUsers)
        .toBe(expected);
    }
  });

  it("keeps new-user content filters off by default", () => {
    expect(createDefaultState().settings.contentFilters).toEqual({});
  });

  it("builds reversible CSS only for enabled filters", () => {
    const youtube = getContentSiteForHost("www.youtube.com");
    expect(youtube).toBeDefined();
    const enabled = buildFilterCss(youtube!, { ytShorts: true }, false);
    expect(enabled).toContain("ytd-reel-shelf-renderer");
    expect(enabled).not.toContain("ytd-rich-grid-renderer");
    expect(buildFilterCss(youtube!, {}, false)).toBe("");
    expect(buildFilterCss(youtube!, {}, true)).toContain(
      '[data-fg-hidden="1"]',
    );
  });

  it("returns keyword targets only for enabled filters", () => {
    const linkedIn = getContentSiteForHost("www.linkedin.com");
    expect(linkedIn).toBeDefined();
    expect(getEnabledKeywordTargets(linkedIn!, {})).toEqual([]);
    expect(
      getEnabledKeywordTargets(linkedIn!, { linkedinFeed: true }),
    ).toHaveLength(1);
  });

  it("provides unique selectors for the development health report", () => {
    const youtube = getContentSiteForHost("www.youtube.com");
    expect(youtube).toBeDefined();
    const selectors = getSiteSelectors(youtube!);
    expect(new Set(selectors).size).toBe(selectors.length);
    expect(selectors).toContain("ytd-rich-item-renderer, ytd-compact-video-renderer, ytd-video-renderer, ytd-reel-item-renderer");
  });
});
