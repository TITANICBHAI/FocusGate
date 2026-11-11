/**
 * A password as a screen reader should say it: one character at a time, with capital letters
 * named, because a password is case sensitive. "kT7m" is read "k, capital T, 7, m".
 */
export function spokenPassword(password: string): string {
  return [...password]
    .map((character) => (/[A-Z]/.test(character) ? `capital ${character}` : character))
    .join(", ");
}
