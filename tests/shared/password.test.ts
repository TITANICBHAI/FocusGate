import { describe, expect, it, vi } from "vitest";
import {
  generatePassword,
  GENERATED_PASSWORD_MAX_LENGTH,
  GENERATED_PASSWORD_MIN_LENGTH,
  hashPassword,
  PASSWORD_ALPHABET,
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

  it("generates ambiguity-free passwords with the secure random API", () => {
    const spy = vi.spyOn(globalThis.crypto, "getRandomValues");
    try {
      const password = generatePassword();
      expect(password.length).toBeGreaterThanOrEqual(GENERATED_PASSWORD_MIN_LENGTH);
      expect(password.length).toBeLessThanOrEqual(GENERATED_PASSWORD_MAX_LENGTH);
      expect([...password].every((character) => PASSWORD_ALPHABET.includes(character))).toBe(
        true,
      );
      expect(spy).toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it("rejects custom passwords outside the policy", async () => {
    await expect(hashPassword("short", 1_000)).rejects.toThrow(RangeError);
    await expect(hashPassword("x".repeat(65), 1_000)).rejects.toThrow(RangeError);
  });
});
