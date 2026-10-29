import { describe, expect, it } from "vitest";
import {
  BUILT_IN_PRESETS,
  deepFocusDomains,
  getPresetDomains,
} from "../../src/shared/presets.ts";

describe("built-in presets", () => {
  it("provides the six categories and deep focus without applying them implicitly", () => {
    expect(BUILT_IN_PRESETS.map((preset) => preset.id)).toEqual([
      "social",
      "video",
      "news",
      "shopping",
      "gaming",
      "messaging",
      "deep-focus",
    ]);
    expect(getPresetDomains(["social"])).toContain("x.com");
    expect(getPresetDomains(["deep-focus"])).toContain("twitch.tv");
    expect(getPresetDomains(["unknown"])).toEqual([]);
  });

  it("combines selected categories into a deduplicated deep-focus list", () => {
    const domains = deepFocusDomains();
    expect(domains).toContain("twitch.tv");
    expect(domains.indexOf("twitch.tv")).toBe(domains.lastIndexOf("twitch.tv"));
  });
});
