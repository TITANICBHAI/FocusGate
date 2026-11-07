import { classifyStateMutation } from "../../shared/guardMutations.ts";
import { guard } from "../../shared/gating.ts";
import { normalizeDomain } from "../../shared/domains.ts";
import type { AppState, Schedule } from "../../shared/types.ts";
import { weakeningLockReason } from "./guardState.ts";

/** What a schedule blocks: the Focus list, its own sites, or both. */
export type SiteTarget = "list" | "own" | "both";

export interface ScheduleDraft {
  name: string;
  days: number[];
  start: string;
  end: string;
  target: SiteTarget;
  /** One site per line. */
  sitesText: string;
}

export const SCHEDULE_TEMPLATES: ReadonlyArray<{
  name: string;
  days: number[];
  start: string;
  end: string;
}> = [
  { name: "Work hours", days: [1, 2, 3, 4, 5], start: "09:00", end: "17:00" },
  { name: "Study", days: [1, 2, 3, 4, 5], start: "18:00", end: "21:00" },
  { name: "Sleep", days: [0, 1, 2, 3, 4, 5, 6], start: "22:00", end: "07:00" },
];

export function emptyDraft(): ScheduleDraft {
  return {
    name: "",
    days: [1, 2, 3, 4, 5],
    start: "09:00",
    end: "17:00",
    target: "list",
    sitesText: "",
  };
}

export function targetOf(schedule: Schedule): SiteTarget {
  if (!schedule.useGlobalLists) return "own";
  return schedule.sites.length > 0 ? "both" : "list";
}

export function draftFromSchedule(schedule: Schedule): ScheduleDraft {
  return {
    name: schedule.name,
    days: [...schedule.days],
    start: schedule.start,
    end: schedule.end,
    target: targetOf(schedule),
    sitesText: schedule.sites.join("\n"),
  };
}

/** True when the schedule has no sites to block, so turning it on does nothing. */
export function blocksNothing(
  schedule: Schedule,
  state: Pick<AppState, "blockedSites">,
): boolean {
  if (schedule.sites.length > 0) return false;
  return !schedule.useGlobalLists || state.blockedSites.length === 0;
}

function isClockTime(value: string, allowEndOfDay = false): boolean {
  if (allowEndOfDay && value === "24:00") return true;
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(value);
}

type ParsedSites = { ok: true; sites: string[] } | { ok: false; error: string };

function parseSites(text: string): ParsedSites {
  const sites: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const domain = normalizeDomain(line);
    if (!domain) {
      return {
        ok: false,
        error: `"${line}" is not a valid site. Use one site per line, like youtube.com.`,
      };
    }
    if (!sites.includes(domain)) sites.push(domain);
  }
  return { ok: true, sites };
}

/**
 * The reason a strict or commit lock refuses this change, or null when it is
 * allowed. Uses the same classifier the background guard uses.
 */
export function scheduleSaveBlockReason(
  state: AppState,
  schedules: Schedule[],
  now: number,
): string | null {
  const actions = classifyStateMutation(state, { ...state, schedules }, now);
  const guardState = {
    session: state.session,
    standalone: state.standalone,
    hasPassword: state.password !== null,
    now,
  };
  for (const action of actions) {
    const decision = guard(action, guardState);
    if (decision.result === "locked") {
      return weakeningLockReason(state, now) ?? decision.reason;
    }
  }
  return null;
}

export type SavePlan =
  | { ok: true; schedule: Schedule; schedules: Schedule[] }
  | { ok: false; error: string };

export function planScheduleSave(input: {
  state: AppState;
  draft: ScheduleDraft;
  editingId: string | null;
  now: number;
  newId(): string;
}): SavePlan {
  const { state, draft, editingId } = input;
  const name = draft.name.trim();
  if (!name) return { ok: false, error: "Enter a name for this schedule." };
  if (draft.days.length === 0) return { ok: false, error: "Choose at least one day." };
  if (!isClockTime(draft.start) || !isClockTime(draft.end, true)) {
    return { ok: false, error: "Use a valid start time and an end time up to 24:00." };
  }

  let sites: string[] = [];
  if (draft.target !== "list") {
    const parsed = parseSites(draft.sitesText);
    if (!parsed.ok) return parsed;
    if (parsed.sites.length === 0) {
      return { ok: false, error: "Add at least one site, or choose your Focus list." };
    }
    sites = parsed.sites;
  }

  const existing = editingId
    ? state.schedules.find((item) => item.id === editingId)
    : undefined;
  if (editingId && !existing) {
    return { ok: false, error: "This schedule no longer exists." };
  }

  const schedule: Schedule = {
    id: existing?.id ?? input.newId(),
    name,
    enabled: existing?.enabled ?? true,
    days: [...draft.days].sort((a, b) => a - b),
    start: draft.start,
    end: draft.end,
    sites,
    keywords: existing?.keywords ?? [],
    useGlobalLists: draft.target !== "own",
  };
  const schedules = existing
    ? state.schedules.map((item) => (item.id === existing.id ? schedule : item))
    : [...state.schedules, schedule];

  const reason = scheduleSaveBlockReason(state, schedules, input.now);
  if (reason) return { ok: false, error: reason };
  return { ok: true, schedule, schedules };
}
