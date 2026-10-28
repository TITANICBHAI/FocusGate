import { describe, expect, it, vi } from "vitest";
import { createDefaultState } from "../../src/shared/defaults.ts";
import type { SessionService } from "../../src/background/session.ts";
import {
  createSessionMessageHandler,
  createToggleFocusCommandHandler,
} from "../../src/background/messages.ts";

describe("staged background message handlers", () => {
  it("validates and dispatches session messages to the service", async () => {
    const service = {
      start: vi.fn(async () => ({
        ok: true as const,
        session: createDefaultState().session,
      })),
      extend: vi.fn(async () => ({
        ok: true as const,
        session: createDefaultState().session,
      })),
      stop: vi.fn(async () => ({
        ok: true as const,
        session: createDefaultState().session,
      })),
      skipBreak: vi.fn(async () => ({
        ok: true as const,
        session: createDefaultState().session,
      })),
    } as unknown as SessionService;
    const handle = createSessionMessageHandler(service);

    const reply = await handle({
      type: "session/start",
      durationMin: 25,
      lockLevel: "strict",
    });
    expect(reply).toMatchObject({ ok: true });
    expect(service.start).toHaveBeenCalledWith({
      durationMin: 25,
      lockLevel: "strict",
    });

    const stopped = await handle({ type: "session/stop", phrase: "I GIVE UP" });
    expect(stopped).toMatchObject({ ok: true });
    expect(service.stop).toHaveBeenCalledWith({
      phrase: "I GIVE UP",
    });

    const extended = await handle({ type: "session/extend", minutes: 15 });
    expect(extended).toMatchObject({ ok: true });
    expect(service.extend).toHaveBeenCalledWith(15);

    const skipped = await handle({ type: "session/skipBreak" });
    expect(skipped).toMatchObject({ ok: true });
    expect(service.skipBreak).toHaveBeenCalledOnce();
  });

  it("rejects malformed and unknown message payloads", async () => {
    const service = {
      start: vi.fn(),
      stop: vi.fn(),
    } as unknown as SessionService;
    const handle = createSessionMessageHandler(service);

    expect(await handle({ type: "session/start", durationMin: "25" })).toEqual({
      ok: false,
      code: "INVALID_MESSAGE",
      message: "Invalid session message.",
    });
    expect(await handle({ type: "session/unknown" })).toEqual({
      ok: false,
      code: "UNKNOWN_MESSAGE",
      message: "This session action is not supported.",
    });
    expect(service.start).not.toHaveBeenCalled();
  });

  it("handles only the toggle-focus command without registering listeners", async () => {
    const service = {
      toggleFromShortcut: vi.fn(async () => ({
        action: "started" as const,
        durationMin: 25,
      })),
    } as unknown as SessionService;
    const handleCommand = createToggleFocusCommandHandler(service);

    await expect(handleCommand("toggle-focus")).resolves.toBe(true);
    expect(service.toggleFromShortcut).toHaveBeenCalledTimes(1);

    await expect(handleCommand("another-command")).resolves.toBe(false);
    expect(service.toggleFromShortcut).toHaveBeenCalledTimes(1);
  });
});
