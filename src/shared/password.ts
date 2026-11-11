import type {
  PasswordRecord,
  PasswordState,
} from "./types.ts";

export const PBKDF2_ITERATIONS = 600_000;
/**
 * One password guards everything. A password someone types is 8 to 28
 * characters: long enough to be hard to guess, short enough to keep in a
 * password manager. Only choosing a password is limited like this. Checking
 * one is not, so a longer password saved under the earlier 8 to 64 rule still
 * unlocks.
 */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 28;
/**
 * A generated password is 20 to 28 characters, from an alphabet with no
 * look-alikes (no 0, 1, I, O, i, l or o). That is hard to guess and hard to
 * type in a hurry, and it still fits the limits above.
 */
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
  if (
    password.length < PASSWORD_MIN_LENGTH ||
    password.length > PASSWORD_MAX_LENGTH
  ) {
    throw new RangeError(passwordLengthMessage());
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

function passwordLengthMessage(): string {
  return `Password must be between ${PASSWORD_MIN_LENGTH} and ${PASSWORD_MAX_LENGTH} characters.`;
}

/**
 * A random password of 20 to 28 characters, drawn with the browser's secure
 * random source. Bytes that would favour some characters are thrown away, so
 * every character of the alphabet is equally likely.
 */
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
