import { describe, expect, it, vi } from "vitest";
import type { PasswordActionResult } from "../../src/background/passwordActions.ts";
import { emptyPasswordDraft, generatedPasswordDraft } from "../../src/ui/lib/passwordDraft.ts";
import {
  applyStrictPasswordChoice,
  createStrictAsk,
  needsPasswordQuestion,
  strictSheetChoice,
  strictSheetPrimaryLabel,
} from "../../src/ui/lib/strictStart.ts";

const typed = (password: string) => ({ password, confirmation: password, generated: false });

const GOOD = "blue-river-42";
const SHORT = "short77";
const GENERATED = "kT7mXp2RhN4cWv9QbJ6sY3dFg";

describe("which starts ask about the password", () => {
  it("only a Strict session asks", () => {
    expect(needsPasswordQuestion("strict")).toBe(true);
    expect(needsPasswordQuestion("none")).toBe(false);
    expect(needsPasswordQuestion("commitment")).toBe(false);
  });
});

describe("what the Strict sheet will do", () => {
  const noPassword = { hasPassword: false, mode: "keep" as const, currentPassword: "" };

  it("with no password saved, chooses nothing until a good password is typed twice or generated", () => {
    expect(strictSheetChoice({ ...noPassword, draft: emptyPasswordDraft() })).toBeNull();
    expect(strictSheetChoice({ ...noPassword, draft: typed(SHORT) })).toBeNull();
    expect(
      strictSheetChoice({
        ...noPassword,
        draft: { password: GOOD, confirmation: "blue", generated: false },
      }),
    ).toBeNull();
    expect(strictSheetChoice({ ...noPassword, draft: typed(GOOD) })).toEqual({
      kind: "set",
      password: GOOD,
    });
    expect(strictSheetChoice({ ...noPassword, draft: generatedPasswordDraft(GENERATED) })).toEqual({
      kind: "set",
      password: GENERATED,
    });
  });

  it("with a password saved, using it needs nothing more", () => {
    expect(
      strictSheetChoice({ hasPassword: true, mode: "keep", currentPassword: "", draft: emptyPasswordDraft() }),
    ).toEqual({ kind: "keep" });
  });

  it("with a password saved, a new one needs the current password and a good new password", () => {
    const base = { hasPassword: true, mode: "new" as const };
    expect(strictSheetChoice({ ...base, currentPassword: "", draft: typed(GOOD) })).toBeNull();
    expect(strictSheetChoice({ ...base, currentPassword: "old-secret-1", draft: emptyPasswordDraft() })).toBeNull();
    expect(strictSheetChoice({ ...base, currentPassword: "old-secret-1", draft: typed(SHORT) })).toBeNull();
    expect(strictSheetChoice({ ...base, currentPassword: "old-secret-1", draft: typed(GOOD) })).toEqual({
      kind: "set",
      password: GOOD,
      currentPassword: "old-secret-1",
    });
    expect(
      strictSheetChoice({ ...base, currentPassword: "old-secret-1", draft: generatedPasswordDraft(GENERATED) }),
    ).toEqual({ kind: "set", password: GENERATED, currentPassword: "old-secret-1" });
  });

  it("names the main button for what it does", () => {
    expect(
      strictSheetPrimaryLabel({ hasPassword: false, mode: "keep", currentPassword: "", draft: typed(GOOD) }),
    ).toBe("Set password and start");
    expect(
      strictSheetPrimaryLabel({
        hasPassword: false,
        mode: "keep",
        currentPassword: "",
        draft: generatedPasswordDraft(GENERATED),
      }),
    ).toBe("I have saved it, start");
    expect(
      strictSheetPrimaryLabel({ hasPassword: true, mode: "keep", currentPassword: "", draft: emptyPasswordDraft() }),
    ).toBe("Use my password and start");
    expect(
      strictSheetPrimaryLabel({ hasPassword: true, mode: "new", currentPassword: "", draft: typed(GOOD) }),
    ).toBe("Change password and start");
    expect(
      strictSheetPrimaryLabel({
        hasPassword: true,
        mode: "new",
        currentPassword: "",
        draft: generatedPasswordDraft(GENERATED),
      }),
    ).toBe("I have saved it, change password and start");
  });
});

describe("carrying out the choice", () => {
  const saved: PasswordActionResult = { ok: true, passwordSet: true };

  it("keeps a saved password without touching it", async () => {
    const setPassword = vi.fn();
    await expect(applyStrictPasswordChoice({ kind: "keep" }, true, setPassword)).resolves.toEqual({
      ok: true,
    });
    expect(setPassword).not.toHaveBeenCalled();
  });

  it("does not pretend a password is saved when none is", async () => {
    const setPassword = vi.fn();
    await expect(applyStrictPasswordChoice({ kind: "keep" }, false, setPassword)).resolves.toEqual({
      ok: false,
      message: "There is no saved password yet. Set one to continue.",
    });
    expect(setPassword).not.toHaveBeenCalled();
  });

  it("lets someone with no password start with the phrase instead", async () => {
    const setPassword = vi.fn();
    await expect(applyStrictPasswordChoice({ kind: "skip" }, false, setPassword)).resolves.toEqual({
      ok: true,
    });
    expect(setPassword).not.toHaveBeenCalled();
  });

  it("does not let someone with a password skip it, because stopping early would still ask for it", async () => {
    const setPassword = vi.fn();
    await expect(applyStrictPasswordChoice({ kind: "skip" }, true, setPassword)).resolves.toEqual({
      ok: false,
      message: "A password is saved, so stopping early will ask for it.",
    });
    expect(setPassword).not.toHaveBeenCalled();
  });

  it("saves a first password", async () => {
    const setPassword = vi.fn(async () => saved);
    await expect(
      applyStrictPasswordChoice({ kind: "set", password: GOOD }, false, setPassword),
    ).resolves.toEqual({ ok: true });
    expect(setPassword).toHaveBeenCalledWith({ newPassword: GOOD });
  });

  it("saves a new password with the current one", async () => {
    const setPassword = vi.fn(async () => saved);
    await expect(
      applyStrictPasswordChoice({ kind: "set", password: GOOD, currentPassword: "old-secret-1" }, true, setPassword),
    ).resolves.toEqual({ ok: true });
    expect(setPassword).toHaveBeenCalledWith({ currentPassword: "old-secret-1", newPassword: GOOD });
  });

  it("asks for the current password before replacing one", async () => {
    const setPassword = vi.fn();
    await expect(
      applyStrictPasswordChoice({ kind: "set", password: GOOD }, true, setPassword),
    ).resolves.toEqual({ ok: false, message: "Enter your current password to set a new one." });
    expect(setPassword).not.toHaveBeenCalled();
  });

  it("passes on the reason when the password could not be saved", async () => {
    const setPassword = vi.fn(
      async (): Promise<PasswordActionResult> => ({
        ok: false,
        code: "BAD_PASSWORD",
        message: "That password is not correct.",
      }),
    );
    await expect(
      applyStrictPasswordChoice({ kind: "set", password: GOOD, currentPassword: "wrong-secret" }, true, setPassword),
    ).resolves.toEqual({ ok: false, message: "That password is not correct." });

    const silent = vi.fn(
      async (): Promise<PasswordActionResult> => ({ ok: false, code: "X", message: "" }),
    );
    await expect(
      applyStrictPasswordChoice({ kind: "set", password: GOOD }, false, silent),
    ).resolves.toEqual({ ok: false, message: "The password could not be saved." });
  });
});

describe("asking before a start", () => {
  it("lets a start without Strict go straight through, without opening anything", async () => {
    const changes: boolean[] = [];
    const asker = createStrictAsk((open) => changes.push(open));
    await expect(asker.ask("none")).resolves.toBe(true);
    await expect(asker.ask("commitment")).resolves.toBe(true);
    expect(changes).toEqual([]);
  });

  it("opens for Strict and waits for the answer", async () => {
    const changes: boolean[] = [];
    const asker = createStrictAsk((open) => changes.push(open));
    let answer: boolean | undefined;
    const pending = asker.ask("strict").then((value) => {
      answer = value;
      return value;
    });
    await Promise.resolve();
    expect(changes).toEqual([true]);
    expect(answer).toBeUndefined();

    asker.finish(true);
    await expect(pending).resolves.toBe(true);
    expect(changes).toEqual([true, false]);
  });

  it("says no when it is cancelled", async () => {
    const asker = createStrictAsk(() => undefined);
    const pending = asker.ask("strict");
    asker.finish(false);
    await expect(pending).resolves.toBe(false);
  });

  it("cancels the first question when a second one comes", async () => {
    const changes: boolean[] = [];
    const asker = createStrictAsk((open) => changes.push(open));
    const first = asker.ask("strict");
    const second = asker.ask("strict");
    await expect(first).resolves.toBe(false);
    asker.finish(true);
    await expect(second).resolves.toBe(true);
  });

  it("ignores a finish when nothing is asked", () => {
    const changes: boolean[] = [];
    const asker = createStrictAsk((open) => changes.push(open));
    asker.finish(true);
    expect(changes).toEqual([]);
  });
});
