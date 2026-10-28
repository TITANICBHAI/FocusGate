import { describe, expect, it, vi } from "vitest";
import { createStandaloneActionService } from "../../src/background/standaloneActions.ts";
import { createStandaloneMessageHandler } from "../../src/background/messages.ts";
import { createDefaultState } from "../../src/shared/defaults.ts";
import type { AppState } from "../../src/shared/types.ts";

function setup(initial: AppState = createDefaultState()) {
  let state = structuredClone(initial);
  let now = 1_000_000;
  const store = {
    readState: vi.fn(async () => structuredClone(state)),
    writeState: vi.fn(async (patch: Partial<AppState>) => {
      state = { ...state, ...patch };
    }),
  };
  const afterChange = vi.fn(async () => undefined);
  const service = createStandaloneActionService({
    store,
    now: () => now,
    afterChange,
  });
  return {
    service,
    store,
    afterChange,
    getState: () => state,
    setNow: (value: number) => {
      now = value;
    },
  };
}

describe("standalone action service", () => {
  it("starts one atomic, finite block with normalized owned sites", async () => {
    const context = setup();

    const result = await context.service.start({
      minutes: 60,
      sites: ["https://www.example.com/path", "reddit.com"],
    });

    expect(result).toMatchObject({
      ok: true,
      standalone: {
        active: true,
        startsAt: 1_000_000,
        until: 1_000_000 + 60 * 60_000,
        sites: ["example.com", "reddit.com"],
      },
    });
    expect(context.store.writeState).toHaveBeenCalledTimes(1);
    expect(context.store.writeState).toHaveBeenCalledWith({
      standalone: result.standalone,
    });
    expect(context.afterChange).toHaveBeenCalledOnce();
  });

  it("enforces the five-minute to thirty-day range and requires a site", async () => {
    const context = setup();

    await expect(
      context.service.start({ minutes: 4, sites: ["example.com"] }),
    ).resolves.toMatchObject({ ok: false, code: "INVALID_DURATION" });
    await expect(
      context.service.start({ minutes: 43_201, sites: ["example.com"] }),
    ).resolves.toMatchObject({ ok: false, code: "INVALID_DURATION" });
    await expect(
      context.service.start({ minutes: 5, sites: [] }),
    ).resolves.toMatchObject({ ok: false, code: "INVALID_SITES" });
    await expect(
      context.service.start({ minutes: 5, sites: ["not a domain"] }),
    ).resolves.toMatchObject({ ok: false, code: "INVALID_SITES" });
    expect(context.store.writeState).not.toHaveBeenCalled();
  });

  it("rejects a second active start and never exposes an early-stop operation", async () => {
    const context = setup();
    await context.service.start({ minutes: 30, sites: ["example.com"] });

    await expect(
      context.service.start({ minutes: 30, sites: ["other.example"] }),
    ).resolves.toMatchObject({ ok: false, code: "ALREADY_ACTIVE" });
    expect("stop" in context.service).toBe(false);
    expect("end" in context.service).toBe(false);
    expect(context.store.writeState).toHaveBeenCalledOnce();
  });

  it("extends only an active block and caps its end at thirty days from now", async () => {
    const context = setup();
    await context.service.start({ minutes: 5, sites: ["example.com"] });
    const initialUntil = context.getState().standalone.until;

    const extended = await context.service.extend(5);
    expect(extended).toMatchObject({
      ok: true,
      standalone: { until: initialUntil + 5 * 60_000 },
    });
    expect(context.getState().standalone.until).toBeGreaterThan(initialUntil);

    context.setNow(context.getState().standalone.until - 5 * 60_000);
    await expect(context.service.extend(30 * 24 * 60)).resolves.toMatchObject({
      ok: false,
      code: "MAX_EXPIRY",
    });
    context.setNow(context.getState().standalone.until);
    await expect(context.service.extend(5)).resolves.toMatchObject({
      ok: false,
      code: "NOT_ACTIVE",
    });
  });

  it("only appends new sites during an active block", async () => {
    const context = setup();
    await context.service.start({ minutes: 60, sites: ["example.com"] });

    await expect(
      context.service.addSites(["https://www.reddit.com/r/focus"]),
    ).resolves.toMatchObject({
      ok: true,
      standalone: { sites: ["example.com", "reddit.com"] },
    });
    await expect(
      context.service.addSites(["reddit.com"]),
    ).resolves.toMatchObject({ ok: false, code: "NO_NEW_SITES" });
    await expect(
      context.service.addSites(["bad domain"]),
    ).resolves.toMatchObject({ ok: false, code: "INVALID_SITES" });
    expect(context.getState().standalone.sites).toEqual([
      "example.com",
      "reddit.com",
    ]);
  });

  it("reports reconciliation failure without hiding the saved block", async () => {
    const context = setup();
    context.afterChange.mockRejectedValueOnce(new Error("sync error"));

    const result = await context.service.start({
      minutes: 5,
      sites: ["example.com"],
    });
    expect(result).toMatchObject({
      ok: true,
      warning: expect.stringContaining("could not be refreshed"),
    });
    expect(context.getState().standalone.active).toBe(true);
  });

  it("accepts only start, extend, and append messages", async () => {
    const service = {
      start: vi.fn(async () => ({ ok: true })),
      extend: vi.fn(async () => ({ ok: true })),
      addSites: vi.fn(async () => ({ ok: true })),
    };
    const handle = createStandaloneMessageHandler(service);

    await expect(
      handle({
        type: "standalone/start",
        minutes: 60,
        sites: ["example.com"],
      }),
    ).resolves.toEqual({ ok: true });
    await expect(
      handle({ type: "standalone/extend", minutes: 15 }),
    ).resolves.toEqual({ ok: true });
    await expect(
      handle({ type: "standalone/addSites", sites: ["reddit.com"] }),
    ).resolves.toEqual({ ok: true });
    await expect(
      handle({ type: "standalone/stop" }),
    ).resolves.toMatchObject({ ok: false, code: "UNKNOWN_MESSAGE" });
    await expect(
      handle({ type: "standalone/start", minutes: 30, sites: "example.com" }),
    ).resolves.toMatchObject({ ok: false, code: "INVALID_MESSAGE" });
    expect(Object.keys(service)).toEqual(["start", "extend", "addSites"]);
  });
});
