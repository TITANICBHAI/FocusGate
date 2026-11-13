import { normalizeDomain } from "../../shared/domains.ts";
import { BUILT_IN_PRESETS } from "../../shared/presets.ts";
import type { AppState } from "../../shared/types.ts";

export interface PickableGroup {
  id: string;
  label: string;
  domains: string[];
}

/** Splits the sites box into trimmed entries (one per line or comma). */
export function siteEntries(value: string): string[] {
  return value
    .split(/[,\n]/)
    .map((site) => site.trim())
    .filter(Boolean);
}

/** The normalized domains currently in the sites box, without duplicates. */
export function domainsInText(value: string): string[] {
  return [
    ...new Set(
      siteEntries(value)
        .map(normalizeDomain)
        .filter((site): site is string => site !== null),
    ),
  ];
}

/** Adds domains to the sites box, one per line, skipping ones already there. */
export function addDomainsToText(
  value: string,
  domains: readonly string[],
): string {
  const present = new Set(domainsInText(value));
  const fresh = [...new Set(domains)].filter((domain) => !present.has(domain));
  if (fresh.length === 0) return value;
  const base = value.trimEnd();
  return `${base}${base ? "\n" : ""}${fresh.join("\n")}`;
}

/** Removes every entry that resolves to one of the domains. */
export function removeDomainsFromText(
  value: string,
  domains: readonly string[],
): string {
  const drop = new Set(domains);
  return siteEntries(value)
    .filter((entry) => {
      const domain = normalizeDomain(entry);
      return domain === null || !drop.has(domain);
    })
    .join("\n");
}

/** Adds the domain when it is missing, removes it when it is already listed. */
export function toggleDomainInText(value: string, domain: string): string {
  return domainsInText(value).includes(domain)
    ? removeDomainsFromText(value, [domain])
    : addDomainsToText(value, [domain]);
}

/**
 * The groups of sites a person can pick from when starting Block now: the
 * sites they already block in Rules, then the built-in and custom presets.
 * Domains that are already part of the running block are left out.
 */
export function pickableGroups(
  state: Pick<
    AppState,
    "blockedSites" | "alwaysBlockedSites" | "customPresets" | "standalone"
  >,
  exclude: readonly string[] = [],
): PickableGroup[] {
  const skip = new Set(exclude);
  const clean = (domains: readonly string[]) => [
    ...new Set(
      domains
        .map(normalizeDomain)
        .filter((domain): domain is string => domain !== null && !skip.has(domain)),
    ),
  ];
  const groups: PickableGroup[] = [
    { id: "focus", label: "Your focus sites", domains: clean(state.blockedSites) },
    {
      id: "always",
      label: "Your always-blocked sites",
      domains: clean(state.alwaysBlockedSites),
    },
    ...state.customPresets.map((preset) => ({
      id: `custom-${preset.id}`,
      label: `${preset.emoji} ${preset.name}`,
      domains: clean(preset.domains),
    })),
    ...BUILT_IN_PRESETS.filter((preset) => preset.id !== "deep-focus").map(
      (preset) => ({
        id: `preset-${preset.id}`,
        label: `${preset.emoji} ${preset.name}`,
        domains: clean(preset.domains),
      }),
    ),
  ];
  return groups.filter((group) => group.domains.length > 0);
}
