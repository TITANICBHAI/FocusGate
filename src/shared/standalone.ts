import { normalizeDomain } from "./domains.ts";

export const MIN_STANDALONE_MINUTES = 5;
export const MAX_STANDALONE_MINUTES = 30 * 24 * 60;
export const MAX_STANDALONE_SITES = 500;
export const STANDALONE_ACKNOWLEDGEMENT_MS = 24 * 60 * 60_000;

export function normalizeStandaloneSites(
  input: readonly string[],
): string[] | null {
  if (input.length === 0 || input.length > MAX_STANDALONE_SITES) return null;
  const normalized = new Set<string>();
  for (const value of input) {
    const domain = normalizeDomain(value);
    if (!domain) return null;
    normalized.add(domain);
  }
  return normalized.size > 0 && normalized.size <= MAX_STANDALONE_SITES
    ? [...normalized]
    : null;
}

export function isValidStandaloneExpiry(until: number, now: number): boolean {
  const minimum = MIN_STANDALONE_MINUTES * 60_000;
  const maximum = MAX_STANDALONE_MINUTES * 60_000;
  return (
    Number.isSafeInteger(until) &&
    Number.isFinite(now) &&
    until - now >= minimum &&
    until - now <= maximum
  );
}

export function toLocalDateTimeInput(timestamp: number): string {
  const date = new Date(timestamp);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function fromLocalDateTimeInput(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) &&
    toLocalDateTimeInput(timestamp) === value
    ? timestamp
    : null;
}

export function countMatchingStandaloneTabs(
  tabs: readonly { url?: string }[],
  sites: readonly string[],
): number {
  const domains = new Set(
    sites.map((site) => normalizeDomain(site)).filter((site): site is string => site !== null),
  );
  if (domains.size === 0) return 0;

  return tabs.filter((tab) => {
    if (!tab.url) return false;
    let hostname: string;
    try {
      const url = new URL(tab.url);
      if (url.protocol !== "http:" && url.protocol !== "https:") return false;
      hostname = normalizeDomain(url.hostname) ?? "";
    } catch {
      return false;
    }
    return [...domains].some(
      (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
    );
  }).length;
}
