import { describe, expect, it, vi } from "vitest";
import {
  createDataActionService,
} from "../../src/background/dataActions.ts";
import { createDataActionMessageHandler } from "../../src/background/messages.ts";
import { createBackupJson } from "../../src/shared/backup.ts";
import { RESET_CONFIRMATION_PHRASE } from "../../src/shared/dataActions.ts";
import { createDefaultState } from "../../src/shared/defaults.ts";
import type { AppState, PasswordState } from "../../src/shared/types.ts";

const password: PasswordState = {
  algo: "pbkdf2-sha256",
  iter: 600_000,
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
  const afterChange = vi.fn(async () => undefined);
  const service = createDataActionService({
    store,
    now: () => 1_000,
    verifyPassword,
    afterChange,
  });
  return {
    service,
    store,
    verifyPassword,
    afterChange,
    getState: () => state,
    setState: (next: AppState) => {
      state = next;
    },
  };
}

describe("background backup and reset actions", () => {
  it("restores exportable data into an empty state without importing a password", async () => {
    const source = createDefaultState();
    source.blockedSites = ["example.com"];
    source.exceptions = ["https://example.com/allowed"];
    source.sessionHistory = [
      {
        id: "history-1",
        startedAt: 10,
        endedAt: 20,
        plannedMs: 10,
        elapsedMs: 10,
        status: "completed",
        lockLevel: "none",
        blockedAttempts: 0,
        gaps: [],
      },
    ];
    const context = setup();

    const result = await context.service.importBackup(createBackupJson(source));

    expect(result).toMatchObject({
      ok: true,
      mode: "restore",
    });
    expect(context.getState()).toMatchObject({
      blockedSites: ["example.com"],
      exceptions: ["https://example.com/allowed"],
      sessionHistory: [{ id: "history-1" }],
      password: null,
    });
    expect(context.store.writeState).toHaveBeenCalledOnce();
    expect(context.afterChange).toHaveBeenCalledOnce();
  });

  it("supports exporting, resetting, and restoring the exported data", async () => {
    const source = createDefaultState();
    source.blockedSites = ["example.com"];
    source.tasks = [
      {
        id: "task-1",
        title: "Focus block",
        durationMin: 25,
        priority: "medium",
        tags: [],
        recurring: "none",
        lockLevel: "none",
        completed: false,
        createdAt: 1,
      },
    ];
    const backup = createBackupJson(source);
    const context = setup(source);

    await expect(
      context.service.resetData({ confirm: RESET_CONFIRMATION_PHRASE }),
    ).resolves.toMatchObject({ ok: true, mode: "reset" });
    expect(context.getState()).toEqual(createDefaultState());

    await expect(context.service.importBackup(backup)).resolves.toMatchObject({
      ok: true,
      mode: "restore",
    });
    expect(context.getState()).toMatchObject({
      blockedSites: ["example.com"],
      tasks: [{ id: "task-1", title: "Focus block" }],
    });
  });

  it("merges safely during a strict lock without password or history changes", async () => {
    const current = createDefaultState();
    current.blockedSites = ["example.com"];
    current.password = password;
    current.session = {
      ...current.session,
      status: "work",
      lockLevel: "strict",
      phaseEndsAt: 9_000,
    };
    const source = createDefaultState();
    source.blockedSites = ["news.example"];
    source.exceptions = ["https://news.example/allowed"];
    source.sessionHistory = [
      {
        id: "not-imported",
        startedAt: 10,
        endedAt: 20,
        plannedMs: 10,
        elapsedMs: 10,
        status: "completed",
        lockLevel: "none",
        blockedAttempts: 0,
        gaps: [],
      },
    ];
    const context = setup(current);

    const result = await context.service.importBackup(createBackupJson(source));

    expect(result).toMatchObject({
      ok: true,
      mode: "merge",
      skipped: expect.arrayContaining([
        expect.stringContaining("exceptions"),
        expect.stringContaining("history"),
      ]),
    });
    expect(context.getState().blockedSites).toEqual([
      "example.com",
      "news.example",
    ]);
    expect(context.getState().exceptions).toEqual([]);
    expect(context.getState().sessionHistory).toEqual([]);
    expect(context.getState().password).toEqual(password);
    expect(context.getState().session.lockLevel).toBe("strict");
  });

  it("rejects invalid import without writing", async () => {
    const context = setup();
    await expect(context.service.importBackup("{")).resolves.toMatchObject({
      ok: false,
      code: "INVALID_BACKUP",
    });
    expect(context.store.writeState).not.toHaveBeenCalled();
  });

  it("refuses reset while locked", async () => {
    const current = createDefaultState();
    current.standalone.active = true;
    current.standalone.startsAt = 0;
    current.standalone.until = 9_000;
    const context = setup(current);

    await expect(
      context.service.resetData({ confirm: RESET_CONFIRMATION_PHRASE }),
    ).resolves.toMatchObject({ ok: false, code: "LOCKED" });
    expect(context.store.writeState).not.toHaveBeenCalled();
  });

  it("requires the typed phrase and resets all state only after confirmation", async () => {
    const current = createDefaultState();
    current.blockedSites = ["example.com"];
    const context = setup(current);

    await expect(
      context.service.resetData({ confirm: "reset" }),
    ).resolves.toMatchObject({ ok: false, code: "CONFIRMATION_REQUIRED" });
    expect(context.store.writeState).not.toHaveBeenCalled();

    await expect(
      context.service.resetData({ confirm: RESET_CONFIRMATION_PHRASE }),
    ).resolves.toMatchObject({ ok: true, mode: "reset" });
    expect(context.store.writeState).toHaveBeenCalledOnce();
    expect(context.getState()).toEqual(createDefaultState());
  });

  it("requires a correct current password to reset protected data", async () => {
    const current = createDefaultState();
    current.blockedSites = ["example.com"];
    current.password = password;
    const context = setup(current);

    await expect(
      context.service.resetData({ confirm: RESET_CONFIRMATION_PHRASE }),
    ).resolves.toMatchObject({ ok: false, code: "PASSWORD_REQUIRED" });
    await expect(
      context.service.resetData({
        confirm: RESET_CONFIRMATION_PHRASE,
        password: "wrong",
      }),
    ).resolves.toMatchObject({ ok: false, code: "BAD_PASSWORD" });
    await expect(
      context.service.resetData({
        confirm: RESET_CONFIRMATION_PHRASE,
        password: "correct password",
      }),
    ).resolves.toMatchObject({ ok: true, mode: "reset" });
    expect(context.verifyPassword).toHaveBeenCalled();
    expect(context.getState()).toEqual(createDefaultState());
  });

  it("rechecks for state changes after password verification", async () => {
    const current = createDefaultState();
    current.blockedSites = ["example.com"];
    current.password = password;
    const context = setup(current);
    context.verifyPassword.mockImplementationOnce(async () => {
      context.setState({
        ...context.getState(),
        standalone: {
          ...context.getState().standalone,
          active: true,
          startsAt: 0,
          until: 9_000,
        },
      });
      return { valid: true };
    });

    await expect(
      context.service.resetData({
        confirm: RESET_CONFIRMATION_PHRASE,
        password: "correct password",
      }),
    ).resolves.toMatchObject({ ok: false, code: "STATE_CHANGED" });
    expect(context.store.writeState).not.toHaveBeenCalled();
  });

  it("validates the staged message contract and has no replace action", async () => {
    const service = {
      importBackup: vi.fn(async (json: string) => ({ ok: json.length > 0 })),
      resetData: vi.fn(async () => ({ ok: true })),
    };
    const handle = createDataActionMessageHandler(service);

    await expect(
      handle({ type: "backup/import", json: "{}" }),
    ).resolves.toEqual({ ok: true });
    await expect(
      handle({
        type: "data/reset",
        confirm: RESET_CONFIRMATION_PHRASE,
        password: "secret",
      }),
    ).resolves.toEqual({ ok: true });
    await expect(
      handle({ type: "backup/replace", json: "{}" }),
    ).resolves.toMatchObject({ ok: false, code: "UNKNOWN_MESSAGE" });
  });
});
