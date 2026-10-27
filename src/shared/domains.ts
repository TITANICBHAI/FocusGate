export const ALIASES: Readonly<Record<string, readonly string[]>> = {
  "x.com": ["twitter.com", "t.co"],
  "youtube.com": ["youtu.be", "youtube-nocookie.com"],
  "facebook.com": ["fb.com", "fb.watch", "messenger.com"],
  "reddit.com": ["redd.it"],
};

const ALIAS_GROUPS = new Map<string, readonly string[]>();
for (const [canonical, aliases] of Object.entries(ALIASES)) {
  const group = [canonical, ...aliases];
  for (const member of group) ALIAS_GROUPS.set(member, group);
}

function isIpLiteral(host: string): boolean {
  if (host.startsWith("[") && host.endsWith("]")) {
    return /^[\[\]a-f\d:.]+$/i.test(host);
  }
  const parts = host.split(".");
  return (
    parts.length === 4 &&
    parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255)
  );
}

export function normalizeDomain(input: string): string | null {
  const raw = input.trim();
  if (!raw || /[\s,]/.test(raw)) return null;

  let url: URL;
  try {
    url = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;

  let host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (host.startsWith("www.")) host = host.slice(4);
  if (!host || host.startsWith(".") || host.endsWith(".")) return null;
  if (host === "localhost" || isIpLiteral(host)) return host;

  const labels = host.split(".");
  if (
    labels.some(
      (label) =>
        !label ||
        label.length > 63 ||
        !/^[a-z\d](?:[a-z\d-]*[a-z\d])?$/.test(label),
    )
  ) {
    return null;
  }
  return host;
}

export function matchesDomain(hostname: string, domain: string): boolean {
  const host = normalizeDomain(hostname);
  const normalizedDomain = normalizeDomain(domain);
  return Boolean(
    host &&
      normalizedDomain &&
      (host === normalizedDomain || host.endsWith(`.${normalizedDomain}`)),
  );
}

export function aliasGroup(input: string): string[] {
  const domain = normalizeDomain(input);
  if (!domain) return [];
  return [...(ALIAS_GROUPS.get(domain) ?? [domain])];
}

export function expandAliases(domains: string[]): string[] {
  return [...new Set(domains.flatMap(aliasGroup))];
}

export function normalizeException(input: string): string | null {
  const raw = input.trim();
  if (!raw || raw.length > 200) return null;

  let url: URL;
  try {
    url = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;

  const host = normalizeDomain(url.hostname);
  if (!host) return null;
  const entry = `${host}${url.pathname.replace(/\/+$/, "")}${url.search}`;
  return entry.length <= 200 ? entry : null;
}

export function matchException(urlValue: string, entries: string[]): boolean {
  let url: URL;
  try {
    url = new URL(urlValue);
  } catch {
    return false;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  const host = normalizeDomain(url.hostname);
  if (!host) return false;
  const key = `${host}${url.pathname.replace(/\/+$/, "")}${url.search}`;

  return entries.some((entry) => {
    const normalized = normalizeException(entry);
    if (!normalized) return false;
    return (
      key === normalized ||
      (key.startsWith(normalized) && "/?&#".includes(key[normalized.length] ?? ""))
    );
  });
}

export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
