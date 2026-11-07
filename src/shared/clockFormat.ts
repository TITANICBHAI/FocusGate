/**
 * One way to show a clock time to the person, used by the panel, the block
 * page and the lock messages. Newer ICU builds put a narrow no-break space
 * before AM and PM; this swaps it for a plain space so text compares and
 * wraps the same everywhere.
 */
export function formatClockTime(timestamp: number, locale?: string): string {
  return new Date(timestamp)
    .toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" })
    .replace(/[  ]/g, " ");
}
