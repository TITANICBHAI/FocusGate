import { describe, expect, it, vi } from "vitest";
import {
  canRequestHostAccess,
  checkProtection,
  extensionSettingsUrl,
  requestHostAccess,
  summarizeProtectionGaps,
} from "../../src/ui/lib/protectionStatus.ts";

describe("protection status helpers", () => {
  it("reports each permission independently", async () => {
    const status = await checkProtection({
      userAgent: "Chrome/120",
      isAllowedIncognitoAccess: async () => false,
      permissions: {
        contains: async (query) =>
          query.origins?.includes("<all_urls>") === true,
      },
    });
    expect(status).toEqual({
      incognito: "review",
      siteAccess: "available",
      notifications: "review",
    });
  });

  it("marks missing browser APIs unavailable rather than available", async () => {
    await expect(checkProtection(null)).resolves.toEqual({
      incognito: "unavailable",
      siteAccess: "unavailable",
      notifications: "unavailable",
    });
    await expect(
      checkProtection({ userAgent: "Firefox/120" }),
    ).resolves.toEqual({
      incognito: "unavailable",
      siteAccess: "unavailable",
      notifications: "unavailable",
    });
  });

  it("requests site access only when declared as optional", async () => {
    const request = vi.fn(async () => true);
    const requiredOnly = {
      userAgent: "Firefox/120",
      permissions: { contains: async () => false, request },
    };
    expect(canRequestHostAccess(requiredOnly)).toBe(false);
    await expect(requestHostAccess(requiredOnly)).resolves.toEqual({
      requested: false,
      granted: false,
    });
    expect(request).not.toHaveBeenCalled();

    const optional = {
      ...requiredOnly,
      optionalHostPermissions: ["<all_urls>"],
    };
    expect(canRequestHostAccess(optional)).toBe(true);
    await expect(requestHostAccess(optional)).resolves.toEqual({
      requested: true,
      granted: true,
    });
    expect(request).toHaveBeenCalledWith({ origins: ["<all_urls>"] });
  });

  it("links to the right extension settings for supported browsers", () => {
    expect(
      extensionSettingsUrl("Chrome/120", "abc"),
    ).toBe("chrome://extensions/?id=abc");
    expect(
      extensionSettingsUrl("Edg/120 Chrome/120", "abc"),
    ).toBe("edge://extensions/?id=abc");
    expect(extensionSettingsUrl("Firefox/120", "abc")).toBe("about:addons");
    expect(extensionSettingsUrl("Safari/17", "abc")).toBeNull();
  });

  it("counts distinct protection gaps overlapping the last seven days", () => {
    const now = 10 * 24 * 60 * 60_000;
    const history = [
      {
        id: "1",
        startedAt: 0,
        endedAt: 1,
        plannedMs: 1,
        elapsedMs: 1,
        status: "completed" as const,
        lockLevel: "none" as const,
        blockedAttempts: 0,
        gaps: [
          { from: now - 8 * 24 * 60 * 60_000, to: now - 6 * 24 * 60 * 60_000 },
          { from: now - 60_000, to: now + 60_000 },
        ],
      },
    ];
    const activeGaps = [
      { from: now - 60_000, to: now + 60_000 },
      { from: now - 30_000, to: now - 10_000 },
    ];
    expect(summarizeProtectionGaps(history, activeGaps, now)).toEqual({
      count: 3,
      durationMs: 86_480_000,
    });
  });
});
