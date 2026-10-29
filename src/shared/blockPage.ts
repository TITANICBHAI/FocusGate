export function quoteForLocalDate(
  quotes: readonly string[],
  dateKey: string,
): string | undefined {
  const usable = quotes.map((quote) => quote.trim()).filter(Boolean);
  if (usable.length === 0) return undefined;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) return usable[0];
  const date = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
  );
  const ordinal = Math.floor(date.getTime() / 86_400_000);
  return usable[((ordinal % usable.length) + usable.length) % usable.length];
}
