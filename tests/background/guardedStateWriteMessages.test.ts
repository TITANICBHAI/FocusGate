import { describe, expect, it, vi } from "vitest";
import { createGuardedStateWriteMessageHandler } from "../../src/background/messages.ts";

describe("guarded state write messages", () => {
  it("validates and dispatches supported user-state writes", async () => {
    const service = {
      write: vi.fn(async () => ({ ok: true as const })),
    };
    const handle = createGuardedStateWriteMessageHandler(service);

    await expect(
      handle({
        type: "state/write",
        key: "blockedSites",
        value: ["example.com"],
      }),
    ).resolves.toEqual({ ok: true });
    expect(service.write).toHaveBeenCalledWith({
      key: "blockedSites",
      value: ["example.com"],
    });
  });

  it("rejects malformed and unsupported keys without calling the service", async () => {
    const service = { write: vi.fn() };
    const handle = createGuardedStateWriteMessageHandler(service);

    await expect(
      handle({ type: "state/write", key: "password", value: null }),
    ).resolves.toMatchObject({ ok: false, code: "INVALID_MESSAGE" });
    await expect(
      handle({
        type: "state/write",
        key: "blockedSites",
        value: [],
        currentPassword: 123,
      }),
    ).resolves.toMatchObject({ ok: false, code: "INVALID_MESSAGE" });
    await expect(handle({ type: "other/write" })).resolves.toMatchObject({
      ok: false,
      code: "UNKNOWN_MESSAGE",
    });
    expect(service.write).not.toHaveBeenCalled();
  });
});
