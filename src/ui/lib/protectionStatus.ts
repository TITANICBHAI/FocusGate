import type { SessionGap, SessionRecord } from "../../shared/types.ts";

export type ProtectionPermission = "checking" | "available" | "review" | "unavailable";

export interface ProtectionStatus {
  incognito: ProtectionPermission;
  siteAccess: ProtectionPermission;
  notifications: ProtectionPermission;
}

export interface ProtectionPermissionsApi {
  contains(query: { origins?: string[]; permissions?: string[] }): Promise<boolean>;
  request?(query: { origins?: string[]; permissions?: string[] }): Promise<boolean>;
}

export interface ProtectionApi {
  id?: string;
  userAgent: string;
  isAllowedIncognitoAccess?: () => Promise<boolean>;
  permissions?: ProtectionPermissionsApi;
  optionalHostPermissions?: string[];
}

export function getBrowserProtectionApi(): ProtectionApi | null {
  if (typeof chrome === "undefined" || !chrome.runtime?.id) return null;
  const manifest = chrome.runtime.getManifest() as {
    optional_host_permissions?: string[];
  };
  return {
    id: chrome.runtime.id,
    userAgent: typeof navigator === "undefined" ? "" : navigator.userAgent,
    isAllowedIncognitoAccess: chrome.extension?.isAllowedIncognitoAccess
      ? () => chrome.extension.isAllowedIncognitoAccess()
      : undefined,
    permissions: chrome.permissions
      ? {
          contains: (query) => chrome.permissions.contains(query),
          request: (query) => chrome.permissions.request(query),
        }
      : undefined,
    optionalHostPermissions: manifest.optional_host_permissions ?? [],
  };
}

export async function checkProtection(
  api: ProtectionApi | null,
): Promise<ProtectionStatus> {
  if (!api) {
    return {
      incognito: "unavailable",
      siteAccess: "unavailable",
      notifications: "unavailable",
    };
  }
  const [incognito, siteAccess, notifications] = await Promise.allSettled([
    api.isAllowedIncognitoAccess?.(),
    api.permissions?.contains({ origins: ["<all_urls>"] }),
    api.permissions?.contains({ permissions: ["notifications"] }),
  ]);
  return {
    incognito: toPermissionStatus(incognito),
    siteAccess: toPermissionStatus(siteAccess),
    notifications: toPermissionStatus(notifications),
  };
}

function toPermissionStatus(
  result: PromiseSettledResult<boolean | undefined>,
): ProtectionPermission {
  if (result.status === "rejected") return "review";
  if (result.value === undefined) return "unavailable";
  return result.value ? "available" : "review";
}

export function canRequestHostAccess(api: ProtectionApi | null): boolean {
  return Boolean(
    api?.permissions?.request &&
      api.optionalHostPermissions?.some(
        (origin) => origin === "<all_urls>" || origin === "*://*/*",
      ),
  );
}

export async function requestHostAccess(
  api: ProtectionApi | null,
): Promise<{ requested: boolean; granted: boolean }> {
  if (!canRequestHostAccess(api) || !api?.permissions?.request) {
    return { requested: false, granted: false };
  }
  try {
    return {
      requested: true,
      granted: await api.permissions.request({ origins: ["<all_urls>"] }),
    };
  } catch {
    return { requested: true, granted: false };
  }
}

export function extensionSettingsUrl(
  userAgent: string,
  extensionId?: string,
): string | null {
  if (/Firefox\//i.test(userAgent)) return "about:addons";
  const encodedId = extensionId ? `?id=${encodeURIComponent(extensionId)}` : "";
  if (/Edg\//i.test(userAgent)) return `edge://extensions/${encodedId}`;
  if (/Chrome\//i.test(userAgent)) return `chrome://extensions/${encodedId}`;
  return null;
}

export function summarizeProtectionGaps(
  history: readonly SessionRecord[],
  activeGaps: readonly SessionGap[],
  now: number,
): { count: number; durationMs: number } {
  const since = now - 7 * 24 * 60 * 60_000;
  const unique = new Map<string, SessionGap>();
  for (const gap of [
    ...history.flatMap((record) => record.gaps),
    ...activeGaps,
  ]) {
    if (
      Number.isFinite(gap.from) &&
      Number.isFinite(gap.to) &&
      gap.to > since &&
      gap.from < now &&
      gap.to > gap.from
    ) {
      unique.set(`${gap.from}:${gap.to}`, gap);
    }
  }
  const gaps = [...unique.values()];
  return {
    count: gaps.length,
    durationMs: gaps.reduce(
      (total, gap) =>
        total + Math.max(0, Math.min(gap.to, now) - Math.max(gap.from, since)),
      0,
    ),
  };
}
