import { describe, expect, it, vi } from "vitest";
import { createGuardedStateWriteService } from "../../src/background/guardedStateWrites.ts";
import { createDefaultState } from "../../src/shared/defaults.ts";
import type { AppState, PasswordState } from "../../src/shared/types.ts";

const password: PasswordState = {
  algo: "pbkdf2-sha256",
  iter: 1_000,
  salt: "salt",
  hash: "hash",
};

function setup(initial: AppState) {
  let state = structuredClone(initial);
  const store = {
    readState: vi.fn(async () => structuredClone(state)),
    writeState: vi.fn(async (patch: Partial<AppState>) => {
      state = { ...state, ...patch };
    }),
  };
  const service = createGuardedStateWriteService({
    store,
    now: () => 1_000,
    verifyPassword: vi.fn(async (input: string) => ({
      valid: input === "correct password",
    })),
  });
  return { service, store };
}

function withFilterOn(): AppState {
  const state = createDefaultState();
  state.settings.contentFilters = { ytShorts: true };
  return state;
}

function settingsWithFilterOff(state: AppState) {
  return {
    ...state.settings,
    contentFilters: { ...state.settings.contentFilters, ytShorts: false },
  };
}

describe("turning a content filter off", () => {
  it("starts every filter off for a new install", () => {
    expect(createDefaultState().settings.contentFilters).toEqual({});
  });

  it("is allowed freely when there is no password and nothing is locked", async () => {
    const state = withFilterOn();
    const { service, store } = setup(state);
    await expect(
      service.write({ key: "settings", value: settingsWithFilterOff(state) }),
    ).resolves.toEqual({ ok: true });
    expect(store.writeState).toHaveBeenCalledOnce();
  });

  it("needs the password when one is set", async () => {
    const state = withFilterOn();
    state.password = password;
    const { service, store } = setup(state);
    const value = settingsWithFilterOff(state);

    await expect(service.write({ key: "settings", value })).resolves.toMatchObject({
      ok: false,
      code: "PASSWORD_REQUIRED",
    });
    await expect(
      service.write({ key: "settings", value, currentPassword: "wrong" }),
    ).resolves.toMatchObject({ ok: false, code: "BAD_PASSWORD" });
    expect(store.writeState).not.toHaveBeenCalled();
    await expect(
      service.write({ key: "settings", value, currentPassword: "correct password" }),
    ).resolves.toEqual({ ok: true });
  });

  it("is refused while Block now is running, even with the correct password", async () => {
    const state = withFilterOn();
    state.password = password;
    state.standalone = {
      ...state.standalone,
      active: true,
      startsAt: 0,
      until: 10_000,
      sites: ["reddit.com"],
    };
    const { service, store } = setup(state);

    await expect(
      service.write({
        key: "settings",
        value: settingsWithFilterOff(state),
        currentPassword: "correct password",
      }),
    ).resolves.toMatchObject({
      ok: false,
      code: "LOCKED",
      message: expect.stringContaining("by Block now."),
    });
    expect(store.writeState).not.toHaveBeenCalled();
  });

  it("is refused during Block now without a password too", async () => {
    const state = withFilterOn();
    state.standalone = {
      ...state.standalone,
      active: true,
      startsAt: 0,
      until: 10_000,
      sites: ["reddit.com"],
    };
    const { service } = setup(state);
    await expect(
      service.write({ key: "settings", value: settingsWithFilterOff(state) }),
    ).resolves.toMatchObject({ ok: false, code: "LOCKED" });
  });

  it("lets a filter be turned on during Block now", async () => {
    const state = createDefaultState();
    state.standalone = {
      ...state.standalone,
      active: true,
      startsAt: 0,
      until: 10_000,
      sites: ["reddit.com"],
    };
    const { service } = setup(state);
    await expect(
      service.write({
        key: "settings",
        value: {
          ...state.settings,
          contentFilters: { ytShorts: true },
        },
      }),
    ).resolves.toEqual({ ok: true });
  });
});
