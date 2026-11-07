import { formatClockTime } from "../../shared/clockFormat.ts";
import { parseHHMM } from "../../shared/time.ts";
import type { AppState, Schedule } from "../../shared/types.ts";
import type { ScheduleStatus } from "./scheduleStatus.ts";

/** Monday first. Index values follow Date#getDay (0 = Sunday). */
const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

const MINUTE_FORMAT: Intl.DateTimeFormatOptions = {
  hour: "numeric",
  minute: "2-digit",
};

/** Newer ICU builds put a narrow no-break space before AM and PM. Use a plain one. */
function plainSpaces(text: string): string {
  return text.replace(/[  ]/g, " ");
}

function formatClockMs(timestamp: number, locale?: string): string {
  return formatClockTime(timestamp, locale);
}

export function summarizeDays(days: readonly number[]): string {
  const set = new Set(days);
  if (set.size === 0) return "No days";
  if (set.size === 7) return "Every day";
  if (set.size === 5 && [1, 2, 3, 4, 5].every((day) => set.has(day))) return "Weekdays";
  if (set.size === 2 && set.has(0) && set.has(6)) return "Weekends";
  return DISPLAY_ORDER.filter((day) => set.has(day))
    .map((day) => DAY_NAMES[day])
    .join(", ");
}

export function formatClock(hhmm: string, locale?: string): string {
  const minutes = parseHHMM(hhmm) % 1440;
  return plainSpaces(
    new Date(2000, 0, 1, Math.floor(minutes / 60), minutes % 60).toLocaleTimeString(
      locale,
      MINUTE_FORMAT,
    ),
  );
}

export function formatRange(start: string, end: string, locale?: string): string {
  const overnight = parseHHMM(end) < parseHHMM(start);
  return `${formatClock(start, locale)} – ${formatClock(end, locale)}${
    overnight ? " next day" : ""
  }`;
}

function dayDistance(from: number, to: number): number {
  const a = new Date(from);
  const b = new Date(to);
  a.setHours(0, 0, 0, 0);
  b.setHours(0, 0, 0, 0);
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

export function statusLine(
  status: ScheduleStatus,
  nowMs: number,
  locale?: string,
): string {
  switch (status.kind) {
    case "active":
      return `On now: ${status.schedule.name}, until ${formatClockMs(status.endsAt, locale)}.`;
    case "next": {
      const distance = dayDistance(nowMs, status.startsAt);
      const when =
        distance <= 0
          ? "today"
          : distance === 1
            ? "tomorrow"
            : new Date(status.startsAt).toLocaleDateString(locale, { weekday: "short" });
      return `Next: ${status.schedule.name}, ${when} ${formatClockMs(status.startsAt, locale)}.`;
    }
    case "none":
      return status.reason === "no-schedules"
        ? "No schedules yet."
        : "All schedules are off.";
  }
}

const plural = (count: number, one: string, many: string): string =>
  `${count} ${count === 1 ? one : many}`;

export function describeTargets(
  schedule: Schedule,
  state: Pick<AppState, "blockedSites">,
): string {
  const own = schedule.sites;
  const focusCount = state.blockedSites.length;

  if (schedule.useGlobalLists && own.length === 0) {
    return focusCount > 0
      ? `Blocks your Focus list (${plural(focusCount, "site", "sites")})`
      : "Blocks nothing yet. Your Focus list is empty.";
  }
  if (own.length === 0) return "Blocks nothing yet. Add sites to this schedule.";
  if (schedule.useGlobalLists && focusCount > 0) {
    return `Blocks your Focus list and ${own.length} more ${own.length === 1 ? "site" : "sites"}`;
  }
  const shown = own.slice(0, 3).join(", ");
  return own.length > 3
    ? `Blocks ${shown} and ${own.length - 3} more`
    : `Blocks ${shown}`;
}
