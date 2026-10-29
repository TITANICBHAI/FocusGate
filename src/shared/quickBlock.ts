import { aliasGroup, normalizeDomain } from "./domains.ts";

export interface QuickBlockTarget {
  url: string;
  domain: string;
  domains: string[];
}

export function quickBlockTarget(value: string | undefined): QuickBlockTarget | null {
  if (!value) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  const domain = normalizeDomain(url.hostname);
  if (!domain) return null;
  return {
    url: url.href,
    domain,
    domains: aliasGroup(domain),
  };
}
