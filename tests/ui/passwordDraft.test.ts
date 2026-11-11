import { describe, expect, it } from "vitest";
import {
  confirmHelper,
  emptyPasswordDraft,
  generatedPasswordDraft,
  passwordDraftError,
  passwordHelper,
  typedPasswordDraft,
} from "../../src/ui/lib/passwordDraft.ts";

const GENERATED = "kT7mXp2RhN4cWv9QbJ6sY3dFg";

describe("password draft: what can be saved", () => {
  it("starts empty and cannot be saved", () => {
    expect(emptyPasswordDraft()).toEqual({ password: "", confirmation: "", generated: false });
    expect(passwordDraftError(emptyPasswordDraft())).toBe("Use at least 8 characters.");
  });

  it("needs 8 to 28 characters", () => {
    const draft = (password: string) => ({ password, confirmation: password, generated: false });
    expect(passwordDraftError(draft("x".repeat(7)))).toBe("Use at least 8 characters.");
    expect(passwordDraftError(draft("x".repeat(8)))).toBeNull();
    expect(passwordDraftError(draft("x".repeat(28)))).toBeNull();
    expect(passwordDraftError(draft("x".repeat(29)))).toBe("Use at most 28 characters.");
  });

  it("needs the second entry to match the first", () => {
    expect(
      passwordDraftError({ password: "correct-horse", confirmation: "correct-horsf", generated: false }),
    ).toBe("The passwords do not match.");
    expect(
      passwordDraftError({ password: "correct-horse", confirmation: "", generated: false }),
    ).toBe("The passwords do not match.");
  });
});

describe("password draft: a generated password", () => {
  it("is 20 to 28 characters, already confirmed and ready to save", () => {
    const draft = generatedPasswordDraft();
    expect(draft.generated).toBe(true);
    expect(draft.password.length).toBeGreaterThanOrEqual(20);
    expect(draft.password.length).toBeLessThanOrEqual(28);
    expect(draft.confirmation).toBe(draft.password);
    expect(passwordDraftError(draft)).toBeNull();
  });

  it("can be given a password, for a test or a retry", () => {
    expect(generatedPasswordDraft(GENERATED)).toEqual({
      password: GENERATED,
      confirmation: GENERATED,
      generated: true,
    });
  });

  it("turns into a typed password as soon as the person types, keeping what they typed", () => {
    const generated = generatedPasswordDraft(GENERATED);
    expect(typedPasswordDraft(generated, "password", "my-own-secret")).toEqual({
      password: "my-own-secret",
      confirmation: GENERATED,
      generated: false,
    });
    expect(typedPasswordDraft(emptyPasswordDraft(), "confirmation", "12")).toEqual({
      password: "",
      confirmation: "12",
      generated: false,
    });
  });
});

describe("password helper text", () => {
  it("says what is allowed before anything is typed", () => {
    expect(passwordHelper("")).toBe("Use 8–28 characters, or generate one.");
  });

  it("counts what is still missing", () => {
    expect(passwordHelper("12")).toBe("Add 6 more characters to reach the minimum of 8.");
    expect(passwordHelper("1234567")).toBe("Add 1 more character to reach the minimum of 8.");
  });

  it("says a short password works and a longer one is harder to guess", () => {
    expect(passwordHelper("x".repeat(8))).toBe("This works. A longer password is harder to guess.");
    expect(passwordHelper("x".repeat(11))).toBe("This works. A longer password is harder to guess.");
    expect(passwordHelper("x".repeat(12))).toBe("Good. Make sure you can remember it or have it saved.");
  });

  it("says when it is too long", () => {
    expect(passwordHelper("x".repeat(29))).toBe("Use at most 28 characters.");
  });
});

describe("confirmation helper text", () => {
  it("asks for the password again while the second entry is empty", () => {
    expect(confirmHelper({ password: "correct-horse", confirmation: "", generated: false })).toBe(
      "Type it again to confirm.",
    );
  });

  it("says when the two entries differ, and when they match", () => {
    expect(confirmHelper({ password: "correct-horse", confirmation: "correct", generated: false })).toBe(
      "The passwords do not match.",
    );
    expect(
      confirmHelper({ password: "correct-horse", confirmation: "correct-horse", generated: false }),
    ).toBe("The passwords match.");
  });
});
