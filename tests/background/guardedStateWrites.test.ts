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

function setup(initial: AppState = createDefaultState()) {
  let state = structuredClone(initial);
  const store = {
    readState: vi.fn(async () => structuredClone(state)),
    writeState: vi.fn(async (patch: Partial<AppState>) => {
      state = { ...state, ...patch };
    }),
  };
  const verifyPassword = vi.fn(async (input: string) => ({
    valid: input === "correct password",
  }));
  const service = createGuardedStateWriteService({
    store,
    now: () => 1_000,
    verifyPassword,
  });
  return {
    service,
    store,
    verifyPassword,
    getState: () => state,
    setState: (next: AppState) => {
      state = next;
    },
  };
}

describe("background guarded state writes", () => {
  it("requires and verifies the password before a weakening write", async () => {
    const initial = createDefaultState();
    initial.blockedSites = ["example.com"];
    initial.password = password;
    const context = setup(initial);

    await expect(
      context.service.write({ key: "blockedSites", value: [] }),
    ).resolves.toMatchObject({ ok: false, code: "PASSWORD_REQUIRED" });
    await expect(
      context.service.write({
        key: "blockedSites",
        value: [],
        currentPassword: "wrong",
      }),
    ).resolves.toMatchObject({ ok: false, code: "BAD_PASSWORD" });
    expect(context.store.writeState).not.toHaveBeenCalled();

    await expect(
      context.service.write({
        key: "blockedSites",
        value: [],
        currentPassword: "correct password",
      }),
    ).resolves.toEqual({ ok: true });
    expect(context.store.writeState).toHaveBeenCalledWith({ blockedSites: [] });
    expect(context.getState().blockedSites).toEqual([]);
  });

  it("refuses weakening while locked but permits strengthening", async () => {
    const initial = createDefaultState();
    initial.blockedSites = ["example.com"];
    initial.session = {
      ...initial.session,
      status: "work",
      lockLevel: "strict",
      phaseEndsAt: 9_000,
    };
    const context = setup(initial);

    await expect(
      context.service.write({ key: "blockedSites", value: [] }),
    ).resolves.toMatchObject({ ok: false, code: "LOCKED" });
    await expect(
      context.service.write({
        key: "blockedSites",
        value: ["example.com", "more.example"],
      }),
    ).resolves.toEqual({ ok: true });
    expect(context.store.writeState).toHaveBeenCalledTimes(1);
  });

  it("prevents deleting a linked task during a strict or commitment session", async () => {
    const initial = createDefaultState();
    initial.tasks = [
      {
        id: "task-1",
        title: "Focus",
        durationMin: 25,
        priority: "medium",
        tags: [],
        recurring: "none",
        lockLevel: "commitment",
        completed: false,
        createdAt: 0,
      },
    ];
    initial.session = {
      ...initial.session,
      status: "work",
      lockLevel: "commitment",
      taskId: "task-1",
      phaseEndsAt: 9_000,
    };
    const context = setup(initial);

    await expect(
      context.service.write({ key: "tasks", value: [] }),
    ).resolves.toMatchObject({ ok: false, code: "LOCKED" });
    expect(context.store.writeState).not.toHaveBeenCalled();
  });

  it("rechecks the state and lock after password verification", async () => {
    const initial = createDefaultState();
    initial.blockedSites = ["example.com"];
    initial.password = password;
    const context = setup(initial);
    context.verifyPassword.mockImplementationOnce(async () => {
      context.setState({
        ...context.getState(),
        standalone: {
          ...context.getState().standalone,
          active: true,
          startsAt: 0,
          until: 5_000,
        },
      });
      return { valid: true };
    });

    await expect(
      context.service.write({
        key: "blockedSites",
        value: [],
        currentPassword: "correct password",
      }),
    ).resolves.toMatchObject({ ok: false, code: "STATE_CHANGED" });
    expect(context.store.writeState).not.toHaveBeenCalled();
  });

  it("rejects writes to keys that do not belong to UI state mutation", async () => {
    const context = setup();
    await expect(
      context.service.write({
        key: "session" as never,
        value: {},
      }),
    ).resolves.toMatchObject({ ok: false, code: "INVALID_STATE_WRITE" });
    expect(context.store.writeState).not.toHaveBeenCalled();
  });
});
