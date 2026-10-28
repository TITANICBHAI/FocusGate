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

    const extended = await handle({ type: "session/extend", minutes: 15 });
    expect(extended).toMatchObject({ ok: true });
    expect(service.extend).toHaveBeenCalledWith(15);
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
      code: "INVALID_MESSAGE",
      message: "Invalid session message.",
    });
    expect(service.start).not.toHaveBeenCalled();
  });

  it("installs the shortcut callback as a handler without registering listeners", async () => {
    const service = {
      toggleFromShortcut: vi.fn(async () => ({
        action: "started" as const,
        durationMin: 25,
      })),
    } as unknown as SessionService;
    const handleCommand = createToggleFocusCommandHandler(service);
    const callback = vi.fn();

    handleCommand("toggle-focus", callback);
    expect(callback).toHaveBeenCalledWith({ action: "started", durationMin: 25 });
    expect(service.toggleFromShortcut).toHaveBeenCalledTimes(1);

    const unrelated = vi.fn();
    handleCommand("another-command", unrelated);
    expect(unrelated).not.toHaveBeenCalled();
  });
});
