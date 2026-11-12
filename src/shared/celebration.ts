import { ACHIEVEMENT_DEFINITIONS } from "./achievements.ts";
import { countedFocusMs } from "./session.ts";
import { goalFocusMs } from "./stats.ts";
import type { AppState, SessionRecord } from "./types.ts";

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;

/** How long after a session ends its done card is still offered. */
export const DONE_CARD_WINDOW_MS = 3 * HOUR_MS;

/** A done card rings the chime only when its session ended this recently. */
export const CHIME_FRESH_MS = 5 * MINUTE_MS;

/** The "back after N days" line starts at this many days away. */
const BACK_AFTER_DAYS = 3;

/** "Longest session yet" needs at least this many earlier sessions to mean something. */
const LONGEST_NEEDS_EARLIER = 2;

/** "You said no to N distractions" starts at this many blocked attempts. */
const DISTRACTIONS_FROM = 3;

export interface DoneCard {
  recordId: string;
  /** When the session ended, in milliseconds. */
  endedAt: number;
  kind: "completed" | "stopped";
  headline: string;
  /** One line that is true of this session, or null when none is. */
  line: string | null;
  /** Names of the achievements unlocked when this session ended. */
  achievements: string[];
  breakTip: string | null;
  /** Goal progress before and after this session, as 0 to 1. Null for a stopped session. */
  goal: { before: number; after: number; reached: boolean } | null;
}

/**
 * What to show when a session has just ended, built only from what was
 * recorded. Null when there is nothing to show: no finished session, one that
 * is too old, a new session already running, or under a minute of focus.
 */
export function buildDoneCard(state: AppState, now: number): DoneCard | null {
  const record = state.sessionHistory.at(-1);
  if (!record) return null;
  if (record.status === "interrupted") return null;
  if (state.session.status === "work") return null;
  if (now - record.endedAt > DONE_CARD_WINDOW_MS) return null;

  const minutes = Math.floor(countedFocusMs(record) / MINUTE_MS);
  if (record.status === "abandoned") {
    if (minutes < 1) return null;
    return {
      recordId: record.id,
      endedAt: record.endedAt,
      kind: "stopped",
      headline: `You focused for ${minutes} ${minutes === 1 ? "minute" : "minutes"}.`,
      line: "Pick it up whenever you’re ready.",
      achievements: [],
      breakTip: null,
      goal: null,
    };
  }

  const dateKey = localDateKey(record.startedAt);
  const day = state.dayStats[dateKey];
  const goalMs = Math.max(1, state.settings.dailyGoalMin) * MINUTE_MS;
  const afterMs = goalFocusMs(day);
  const beforeMs = Math.max(0, afterMs - countedFocusMs(record));
  const goal = {
    before: Math.min(1, beforeMs / goalMs),
    after: Math.min(1, afterMs / goalMs),
    reached: beforeMs < goalMs && afterMs >= goalMs,
  };

  return {
    recordId: record.id,
    endedAt: record.endedAt,
    kind: "completed",
    headline: `${formatMinutes(minutes)}, done`,
    line: trueLine(state, record, goal.reached, goalMs, afterMs),
    achievements: state.achievements
      .filter((item) => item.unlockedAt >= record.endedAt)
      .map((item) => ACHIEVEMENT_DEFINITIONS.find((def) => def.id === item.id)?.label)
      .filter((label): label is string => label !== undefined),
    breakTip: breakTip(state),
    goal,
  };
}

function trueLine(
  state: AppState,
  record: SessionRecord,
  goalReached: boolean,
  goalMs: number,
  afterMs: number,
): string | null {
  if (goalReached) return `That’s your ${state.settings.dailyGoalMin} min goal for today.`;

  const earlier = state.sessionHistory.filter(
    (item) =>
      item.id !== record.id && item.status === "completed" && item.startedAt < record.startedAt,
  );
  const dateKey = localDateKey(record.startedAt);
  const previous = earlier.at(-1);
  if (previous) {
    const away = daysBetween(localDateKey(previous.startedAt), dateKey);
    if (away >= BACK_AFTER_DAYS) return `Back after ${away} days.`;
  }
  if (
    earlier.length >= LONGEST_NEEDS_EARLIER &&
    earlier.every((item) => record.elapsedMs > item.elapsedMs)
  ) {
    return "Your longest session yet.";
  }
  if (record.blockedAttempts >= DISTRACTIONS_FROM) {
    return `You said no to ${record.blockedAttempts} distractions.`;
  }
  const completedToday = state.dayStats[dateKey]?.sessionsCompleted ?? 0;
  if (completedToday >= 2) return `Your ${ordinal(completedToday)} session today.`;
  const leftMin = Math.ceil((goalMs - afterMs) / MINUTE_MS);
  if (leftMin >= 1 && afterMs < goalMs) return `${leftMin} min from today’s goal.`;
  return null;
}

function breakTip(state: AppState): string | null {
  const status = state.session.status;
  if (!state.settings.breaks.enabled) return null;
  if (status !== "shortBreak" && status !== "longBreak") return null;
  const minutes = Math.round(state.session.phasePlannedMs / MINUTE_MS);
  if (minutes < 1) return null;
  return `Break time: ${minutes} min. Look away from the screen for a bit.`;
}

function formatMinutes(total: number): string {
  if (total < 60) return `${total} min`;
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

function ordinal(n: number): string {
  const lastTwo = n % 100;
  if (lastTwo >= 11 && lastTwo <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

function localDateKey(timestamp: number): string {
  const date = new Date(timestamp);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function daysBetween(fromKey: string, toKey: string): number {
  const parse = (key: string): number => {
    const [y, m, d] = key.split("-").map(Number);
    return Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1);
  };
  return Math.round((parse(toKey) - parse(fromKey)) / 86_400_000);
}

/**
 * Whether to ring the chime for a done card: only when the person has it on,
 * only the first time for that session, and only soon after the session ended.
 */
export function shouldChime(input: {
  enabled: boolean;
  recordId: string;
  endedAt: number;
  now: number;
  chimedId: string | undefined;
}): boolean {
  if (!input.enabled) return false;
  if (input.chimedId === input.recordId) return false;
  return input.now - input.endedAt <= CHIME_FRESH_MS;
}
