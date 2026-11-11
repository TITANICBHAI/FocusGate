import { describe, expect, it } from "vitest";
import { spokenPassword } from "../../src/ui/lib/spokenPassword.ts";

describe("a password read out character by character", () => {
  it("says each digit and lowercase letter on its own", () => {
    expect(spokenPassword("k7m2")).toBe("k, 7, m, 2");
  });

  it("names a capital letter, because the password is case sensitive", () => {
    expect(spokenPassword("kT7mXp")).toBe("k, capital T, 7, m, capital X, p");
  });

  it("reads a whole generated password in order, without dropping or adding anything", () => {
    const password = "kT7mXp2RhN4cWv9QbJ6sY3dFg";
    const spoken = spokenPassword(password);
    const back = spoken
      .split(", ")
      .map((part) => (part.startsWith("capital ") ? part.slice("capital ".length) : part))
      .join("");
    expect(back).toBe(password);
    expect(spoken.split(", ")).toHaveLength(password.length);
  });

  it("says nothing for nothing", () => {
    expect(spokenPassword("")).toBe("");
  });
});
