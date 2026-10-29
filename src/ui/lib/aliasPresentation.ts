import { aliasGroup, normalizeDomain } from "../../shared/domains.ts";

export function aliasesForSiteDisplay(site: string): string[] {
  const normalized = normalizeDomain(site);
  if (!normalized) return [];
  return aliasGroup(normalized).filter((alias) => alias !== normalized);
}
