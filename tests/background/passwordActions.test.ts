import { describe, expect, it, vi } from "vitest";
import { createPasswordActionService } from "../../src/background/passwordActions.ts";
import { createDefaultState } from "../../src/shared/defaults.ts";
import type {
  AppState,
  PasswordRecord,
  PasswordState,
} from "../../src/shared/types.ts";

const CURRENT: PasswordRecord = {
  algo: "pbkdf2-sha256",
  iter: 1_000,
  salt: "00",
  hash: "11",
};
const NEXT: PasswordRecord = {
  algo: "pbkdf2-sha256",
  iter: 1_000,
  salt: "22",
  hash: "33",
};

function setup(initialPassword: PasswordState = null) {
  let state: AppState = {
    ...createDefaultState(),
    password: initialPassword,
  };
  const store = {
    readState: vi.fn(async () => structuredClone(state)),
    writeState: vi.fn(async (patch: Partial<AppState>) => {
      state = { ...state, ...patch };
    }),
  };
  const hashPassword = vi.fn(async () => NEXT);
  const verifyPassword = vi.fn(async (input: string, record: PasswordState) => ({
    valid: input === "current secret" && record?.hash === CURRENT.hash,
  }));
  const service = createPasswordActionService({
    store,
    now: () => 10_000,
    hashPassword,
    verifyPassword,
  });
  return {
    service,
    store,
    hashPassword,
    verifyPassword,
    getState: () => state,
    setState: (next: AppState) => {
      state = next;
    },
  };
}

describe("background password actions", () => {
  it("sets a password only within the 8–64 character policy", async () => {
    const context = setup();
    await expect(
      context.service.setPassword({ newPassword: "short" }),
    ).resolves.toMatchObject({ ok: false, code: "INVALID_PASSWORD" });
    expect(context.hashPassword).not.toHaveBeenCalled();
    expect(context.store.writeState).not.toHaveBeenCalled();

    await expect(
      context.service.setPassword({ newPassword: "correct horse battery" }),
    ).resolves.toEqual({ ok: true, passwordSet: true });
    expect(context.hashPassword).toHaveBeenCalledWith("correct horse battery");
    expect(context.store.writeState).toHaveBeenCalledWith({ password: NEXT });
    expect(context.getState().password).toEqual(NEXT);
  });

  it("requires background verification before changing or removing a password", async () => {
    const context = setup(CURRENT);
    await expect(
      context.service.setPassword({
        currentPassword: "wrong",
        newPassword: "replacement secret",
      }),
    ).resolves.toMatchObject({ ok: false, code: "BAD_PASSWORD" });
    expect(context.hashPassword).not.toHaveBeenCalled();
    expect(context.store.writeState).not.toHaveBeenCalled();

    await expect(
      context.service.removePassword({ currentPassword: "current secret" }),
    ).resolves.toEqual({ ok: true, passwordSet: false });
    expect(context.store.writeState).toHaveBeenCalledWith({ password: null });
    expect(context.getState().password).toBeNull();
  });

  it("refuses password changes during strict, commitment, or standalone locks", async () => {
    for (const lockLevel of ["strict", "commitment"] as const) {
      const context = setup(CURRENT);
      context.setState({
        ...context.getState(),
        session: {
          ...createDefaultState().session,
          status: "work",
          lockLevel,
          phaseEndsAt: 50_000,
        },
      });
      await expect(
        context.service.removePassword({ currentPassword: "current secret" }),
      ).resolves.toMatchObject({ ok: false, code: "LOCKED" });
      expect(context.store.writeState).not.toHaveBeenCalled();
    }

    const standalone = setup(CURRENT);
    standalone.setState({
      ...standalone.getState(),
      standalone: {
        ...createDefaultState().standalone,
        active: true,
        startsAt: 1,
        until: 50_000,
      },
    });
    await expect(
      standalone.service.setPassword({
        currentPassword: "current secret",
        newPassword: "replacement secret",
      }),
    ).resolves.toMatchObject({ ok: false, code: "LOCKED" });
    expect(standalone.store.writeState).not.toHaveBeenCalled();
    expect(standalone.hashPassword).not.toHaveBeenCalled();
  });

  it("rechecks the lock after password hashing before committing", async () => {
    const context = setup();
    context.hashPassword.mockImplementationOnce(async () => {
      context.setState({
        ...context.getState(),
        standalone: {
          ...createDefaultState().standalone,
          active: true,
          startsAt: 1,
          until: 50_000,
        },
      });
      return NEXT;
    });

    await expect(
      context.service.setPassword({ newPassword: "correct horse battery" }),
    ).resolves.toMatchObject({ ok: false, code: "LOCKED" });
    expect(context.store.writeState).not.toHaveBeenCalled();
  });
});
