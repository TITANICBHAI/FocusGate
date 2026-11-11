import { describe, expect, it, vi } from "vitest";
import {
  generatePassword,
  GENERATED_PASSWORD_MAX_LENGTH,
  GENERATED_PASSWORD_MIN_LENGTH,
  hashPassword,
  PASSWORD_ALPHABET,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  verifyPassword,
} from "../../src/shared/password.ts";

function hex(bytes: Uint8Array): string {
  return [...bytes].map((value) => value.toString(16).padStart(2, "0")).join("");
}

describe("password helpers", () => {
  it("hashes and verifies passwords with PBKDF2", async () => {
    const record = await hashPassword("correct horse battery", 1_000);
    expect(record).toMatchObject({ algo: "pbkdf2-sha256", iter: 1_000 });
    expect(record.salt).toHaveLength(32);
    expect(record.hash).toHaveLength(64);
    expect(await verifyPassword("correct horse battery", record)).toEqual({
      valid: true,
    });
    expect(await verifyPassword("wrong password", record)).toEqual({
      valid: false,
    });
  });

  it("upgrades a valid legacy SHA-256 record and rejects an invalid one", async () => {
    const legacyHash = hex(
      new Uint8Array(
        await crypto.subtle.digest(
          "SHA-256",
          new TextEncoder().encode("legacy password"),
        ),
      ),
    );
    const legacy = { algo: "sha256-legacy" as const, hash: legacyHash };
    const result = await verifyPassword("legacy password", legacy);
    expect(result.valid).toBe(true);
    expect(result.upgradedRecord).toMatchObject({
      algo: "pbkdf2-sha256",
      iter: 600_000,
    });
    expect(
      await verifyPassword("wrong password", legacy),
    ).toEqual({ valid: false });
  });
});

describe("the password rule", () => {
  it("takes a typed password of 8 to 28 characters and rejects the rest", async () => {
    expect(PASSWORD_MIN_LENGTH).toBe(8);
    expect(PASSWORD_MAX_LENGTH).toBe(28);
    await expect(hashPassword("x".repeat(8), 1_000)).resolves.toMatchObject({
      algo: "pbkdf2-sha256",
    });
    await expect(hashPassword("x".repeat(28), 1_000)).resolves.toMatchObject({
      algo: "pbkdf2-sha256",
    });
    await expect(hashPassword("x".repeat(7), 1_000)).rejects.toThrow(RangeError);
    await expect(hashPassword("x".repeat(29), 1_000)).rejects.toThrow(RangeError);
    await expect(hashPassword("x".repeat(7), 1_000)).rejects.toThrow(
      "Password must be between 8 and 28 characters.",
    );
  });

  it("still unlocks with a longer password saved under the earlier 8 to 64 rule", async () => {
    // Only choosing a password is limited to 28 characters. Checking one is not, so a person who
    // saved a longer password before is not locked out of their own rules.
    const password = "k".repeat(40);
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(password),
      "PBKDF2",
      false,
      ["deriveBits"],
    );
    const bits = await crypto.subtle.deriveBits(
      { name: "PBKDF2", hash: "SHA-256", salt, iterations: 1_000 },
      key,
      256,
    );
    const record = {
      algo: "pbkdf2-sha256" as const,
      iter: 1_000,
      salt: hex(salt),
      hash: hex(new Uint8Array(bits)),
    };
    expect(await verifyPassword(password, record)).toEqual({ valid: true });
    expect(await verifyPassword("k".repeat(39), record)).toEqual({ valid: false });
  });
});

describe("generated password", () => {
  it("is 20 to 28 characters, drawn with the secure random API", () => {
    const spy = vi.spyOn(globalThis.crypto, "getRandomValues");
    try {
      expect(GENERATED_PASSWORD_MIN_LENGTH).toBe(20);
      expect(GENERATED_PASSWORD_MAX_LENGTH).toBe(28);
      const password = generatePassword();
      expect(password.length).toBeGreaterThanOrEqual(20);
      expect(password.length).toBeLessThanOrEqual(28);
      expect(spy).toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it("is drawn only from an alphabet without look-alikes (no 0, 1, I, O, i, l or o)", () => {
    expect(PASSWORD_ALPHABET).not.toMatch(/[01IOilo]/);
    for (let index = 0; index < 100; index += 1) {
      expect([...generatePassword()].every((character) => PASSWORD_ALPHABET.includes(character))).toBe(
        true,
      );
    }
  });

  it("uses every length from 20 to 28 and every character of the alphabet, and is not repeated", () => {
    const lengths = new Set<number>();
    const characters = new Set<string>();
    const seen = new Set<string>();
    for (let index = 0; index < 600; index += 1) {
      const password = generatePassword();
      lengths.add(password.length);
      for (const character of password) characters.add(character);
      seen.add(password);
    }
    expect([...lengths].sort((a, b) => a - b)).toEqual([20, 21, 22, 23, 24, 25, 26, 27, 28]);
    expect(characters.size).toBe(PASSWORD_ALPHABET.length);
    expect(seen.size).toBe(600);
  });

  it("meets the password rule, so it can be saved as it is", async () => {
    for (let index = 0; index < 20; index += 1) {
      await expect(hashPassword(generatePassword(), 1_000)).resolves.toMatchObject({
        algo: "pbkdf2-sha256",
      });
    }
  });
});
