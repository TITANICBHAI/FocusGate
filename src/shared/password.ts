import type {
  PasswordRecord,
  PasswordState,
} from "./types.ts";

export const PBKDF2_ITERATIONS = 600_000;
export const PASSWORD_ALPHABET =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
export const GENERATED_PASSWORD_MIN_LENGTH = 20;
export const GENERATED_PASSWORD_MAX_LENGTH = 28;

export interface PasswordVerification {
  valid: boolean;
  upgradedRecord?: PasswordRecord;
}

function cryptoApi(): Crypto {
  if (!globalThis.crypto?.subtle || !globalThis.crypto.getRandomValues) {
    throw new Error("Web Crypto is required for password operations.");
  }
  return globalThis.crypto;
}

function toHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function fromHex(value: string): Uint8Array | null {
  if (!/^(?:[a-f\d]{2})+$/i.test(value)) return null;
  const bytes = new Uint8Array(value.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

async function derive(
  password: string,
  salt: Uint8Array,
  iterations: number,
): Promise<Uint8Array> {
  const crypto = cryptoApi();
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: salt.slice(), iterations },
    key,
    256,
  );
  return new Uint8Array(bits);
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index]! ^ right[index]!;
  }
  return difference === 0;
}

export async function hashPassword(
  password: string,
  iterations = PBKDF2_ITERATIONS,
): Promise<PasswordRecord> {
  if (password.length < 8 || password.length > 64) {
    throw new RangeError("Password must be between 8 and 64 characters.");
  }
  const salt = cryptoApi().getRandomValues(new Uint8Array(16));
  const hash = await derive(password, salt, iterations);
  return {
    algo: "pbkdf2-sha256",
    iter: iterations,
    salt: toHex(salt),
    hash: toHex(hash),
  };
}

export async function verifyPassword(
  password: string,
  record: PasswordState,
): Promise<PasswordVerification> {
  if (!record) return { valid: false };

  if (record.algo === "sha256-legacy") {
    const expected = fromHex(record.hash);
    if (!expected) return { valid: false };
    const digest = new Uint8Array(
      await cryptoApi().subtle.digest(
        "SHA-256",
        new TextEncoder().encode(password),
      ),
    );
    const valid = constantTimeEqual(digest, expected);
    return valid
      ? { valid, upgradedRecord: await hashPassword(password) }
      : { valid };
  }

  const salt = fromHex(record.salt);
  const expected = fromHex(record.hash);
  if (!salt || !expected || !Number.isInteger(record.iter) || record.iter < 1) {
    return { valid: false };
  }
  const actual = await derive(password, salt, record.iter);
  return { valid: constantTimeEqual(actual, expected) };
}

function randomInteger(maxExclusive: number): number {
  const crypto = cryptoApi();
  const range = 0x1_0000_0000;
  const cutoff = range - (range % maxExclusive);
  const sample = new Uint32Array(1);
  do {
    crypto.getRandomValues(sample);
  } while (sample[0]! >= cutoff);
  return sample[0]! % maxExclusive;
}

export function generatePassword(): string {
  const crypto = cryptoApi();
  const length =
    GENERATED_PASSWORD_MIN_LENGTH +
    randomInteger(
      GENERATED_PASSWORD_MAX_LENGTH - GENERATED_PASSWORD_MIN_LENGTH + 1,
    );
  const alphabet = PASSWORD_ALPHABET;
  const maximumByte = Math.floor(256 / alphabet.length) * alphabet.length;
  let result = "";
  const sample = new Uint8Array(1);
  while (result.length < length) {
    crypto.getRandomValues(sample);
    if (sample[0]! >= maximumByte) continue;
    result += alphabet[sample[0]! % alphabet.length];
  }
  return result;
}
