import { matchesDomain } from "./domains.ts";

const HOST_PARAMS: Readonly<Record<string, readonly string[]>> = {
  "yahoo.com": ["p"],
  "search.yahoo.com": ["p"],
  "yandex.com": ["text"],
  "yandex.ru": ["text"],
  "baidu.com": ["wd"],
  "youtube.com": ["search_query"],
  "amazon.com": ["k"],
};
const GENERIC_PARAMS = ["q", "query"];

export function splitKeywords(value: string): string[] {
  return [
    ...new Set(
      value
        .split(/[,\n]/)
        .map((entry) => entry.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
}

export function matchKeyword(
  text: string,
  keywords: string[],
  mode: "substring" | "wholeWord" = "substring",
): string | null {
  const lowerText = text.toLocaleLowerCase();
  for (const rawKeyword of keywords) {
    const keyword = rawKeyword.trim().toLocaleLowerCase();
    if (!keyword) continue;
    if (mode === "substring") {
      if (lowerText.includes(keyword)) return rawKeyword;
      continue;
    }
    const expression = new RegExp(
      `(^|[^\\p{L}\\p{N}_])${escapeRegex(keyword)}($|[^\\p{L}\\p{N}_])`,
      "u",
    );
    if (expression.test(lowerText)) return rawKeyword;
  }
  return null;
}

export function extractSearchText(url: URL): string[] {
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const hostParams = Object.entries(HOST_PARAMS)
    .filter(([domain]) => matchesDomain(host, domain))
    .flatMap(([, params]) => params);
  const params = [...new Set([...GENERIC_PARAMS, ...hostParams])];
  return params
    .map((parameter) => url.searchParams.get(parameter))
    .filter((value): value is string => Boolean(value));
}

export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
