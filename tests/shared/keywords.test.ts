import { describe, expect, it } from "vitest";
import {
  extractSearchText,
  matchKeyword,
  splitKeywords,
} from "../../src/shared/keywords.ts";

describe("keyword helpers", () => {
  it("splits comma and newline lists, trims and deduplicates", () => {
    expect(splitKeywords(" funny shorts, #gaming\nFUNNY SHORTS ,, ")).toEqual([
      "funny shorts",
      "#gaming",
    ]);
  });

  it("supports substring, whole-word, hashtag, and Unicode matching", () => {
    expect(matchKeyword("essex", ["sex"], "substring")).toBe("sex");
    expect(matchKeyword("essex", ["sex"], "wholeWord")).toBeNull();
    expect(matchKeyword("A #Gaming stream", ["#gaming"], "wholeWord")).toBe(
      "#gaming",
    );
    expect(matchKeyword("café", ["café"], "wholeWord")).toBe("café");
  });

  it("reads generic and host-specific search parameters without generic p", () => {
    expect(extractSearchText(new URL("https://google.com/search?q=focus"))).toEqual([
      "focus",
    ]);
    expect(extractSearchText(new URL("https://www.youtube.com/results?search_query=study"))).toEqual([
      "study",
    ]);
    expect(extractSearchText(new URL("https://yahoo.com/search?p=work"))).toEqual([
      "work",
    ]);
    expect(extractSearchText(new URL("https://example.com/page?p=7"))).toEqual([]);
    expect(extractSearchText(new URL("https://yandex.ru/search?text=plans"))).toEqual([
      "plans",
    ]);
    expect(extractSearchText(new URL("https://baidu.com/s?wd=focus"))).toEqual([
      "focus",
    ]);
    expect(extractSearchText(new URL("https://amazon.com/s?k=books"))).toEqual([
      "books",
    ]);
  });
});
