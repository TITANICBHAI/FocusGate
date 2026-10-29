import { aliasGroup, normalizeDomain } from "../../shared/domains.ts";

export function aliasesForSiteDisplay(
  site: string,
  excluded: readonly string[] = [],
): string[] {
  const normalized = normalizeDomain(site);
  if (!normalized) return [];
  const excludedSet = new Set(excluded.map(normalizeDomain));
  return aliasGroup(normalized).filter(
    (alias) => alias !== normalized && !excludedSet.has(alias),
  );
}
