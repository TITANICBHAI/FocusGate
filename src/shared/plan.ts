import {
  expandAliases,
  matchException,
  matchesDomain,
  normalizeDomain,
} from "./domains.ts";
import {
  isExhausted,
  nextResetAt,
  normalizeRecord,
} from "./allowance.ts";
import { extractSearchText, matchKeyword } from "./keywords.ts";
import {
  isScheduleActiveAt,
  localDateKey,
  nextScheduleBoundary,
  parseHHMM,
  startOfNextLocalDay,
} from "./time.ts";
import type {
  Allowance,
  AppState,
  KeywordRule,
  Schedule,
  UsageRecord,
} from "./types.ts";

export type BlockReason =
  | { kind: "always" }
  | { kind: "standalone"; until: number }
  | { kind: "session"; until: number }
  | { kind: "schedule"; name: string; until: number }
  | { kind: "allowance"; mode: Allowance["mode"]; resetsAt: number }
  | { kind: "allowOnly" }
  | { kind: "keyword"; keyword: string; where: "query" | "url" | "title" };

export interface BlockPlan {
  blocked: Map<string, BlockReason>;
  allowOnly: string[] | null;
  keywords: string[];
  hideWords: string[];
  exceptions: string[];
  nextBoundaryAt: number | null;
}

export function isValidSchedule(value: unknown): value is Schedule {
  if (!value || typeof value !== "object") return false;
  const schedule = value as Partial<Schedule>;
  if (
    typeof schedule.id !== "string" ||
    typeof schedule.name !== "string" ||
    typeof schedule.enabled !== "boolean" ||
    typeof schedule.useGlobalLists !== "boolean" ||
    !Array.isArray(schedule.days) ||
    schedule.days.length === 0 ||
    !schedule.days.every(
      (day) => Number.isInteger(day) && day >= 0 && day <= 6,
    ) ||
    !Array.isArray(schedule.sites) ||
    !schedule.sites.every((site) => typeof site === "string") ||
    !Array.isArray(schedule.keywords) ||
    !schedule.keywords.every((keyword) => typeof keyword === "string") ||
    typeof schedule.start !== "string" ||
    typeof schedule.end !== "string"
  ) {
    return false;
  }
  try {
    return parseHHMM(schedule.start) !== parseHHMM(schedule.end);
  } catch {
    return false;
  }
}

function validSchedules(schedules: unknown): Schedule[] {
  return Array.isArray(schedules) ? schedules.filter(isValidSchedule) : [];
}

function standaloneActive(state: AppState, now: number): boolean {
  const standalone = state.standalone;
  return (
    standalone.active &&
    standalone.startsAt <= now &&
    now < standalone.until
  );
}

function scheduleEndAt(schedule: Schedule, now: Date): number {
  const endMinutes =
    schedule.end === "24:00"
      ? 1440
      : Number(schedule.end.slice(0, 2)) * 60 + Number(schedule.end.slice(3, 5));
  let next: number | null = null;
  for (let offset = 0; offset <= 8; offset += 1) {
    const startDay = new Date(now);
    startDay.setHours(0, 0, 0, 0);
    startDay.setDate(startDay.getDate() + offset);
    const day = startDay.getDay();
    const previousDay = (day + 6) % 7;
    const endDayOffset =
      Number(schedule.start.slice(0, 2)) * 60 +
        Number(schedule.start.slice(3, 5)) >
      endMinutes
        ? 1
        : 0;
    const belongsToScheduleDay = endDayOffset
      ? schedule.days.includes(previousDay)
      : schedule.days.includes(day);
    if (!belongsToScheduleDay) continue;
    startDay.setMinutes(endMinutes);
    if (startDay.getTime() > now.getTime()) {
      next = startDay.getTime();
      break;
    }
  }
  return next ?? nextScheduleBoundary([schedule], now) ?? now.getTime();
}

function aliasAllowance(
  domain: string,
  allowances: Record<string, Allowance>,
): { key: string; value: Allowance } | undefined {
  const group = new Set(expandAliases([domain]));
  const entry = Object.entries(allowances)
    .sort(([left], [right]) => left.localeCompare(right))
    .find(([key]) => group.has(normalizeDomain(key) ?? ""));
  return entry ? { key: entry[0], value: entry[1] } : undefined;
}

function usageFor(
  domain: string,
  usage: Record<string, UsageRecord>,
): UsageRecord | undefined {
  const group = new Set(expandAliases([domain]));
  for (const [key, record] of Object.entries(usage)) {
    if (group.has(normalizeDomain(key) ?? "")) return record;
  }
  return undefined;
}

function addDomains(
  target: Map<string, BlockReason>,
  domains: string[],
  reason: BlockReason,
  aliasExclusions: AppState["aliasExclusions"],
): void {
  const explicit = new Set(
    domains
      .map(normalizeDomain)
      .filter((domain): domain is string => domain !== null),
  );
  const excluded = new Set(
    domains.flatMap((domain) => {
      const normalized = normalizeDomain(domain);
      return normalized
        ? (aliasExclusions[normalized] ?? [])
            .map(normalizeDomain)
            .filter((value): value is string => value !== null)
        : [];
    }),
  );
  for (const domain of expandAliases(domains).filter(
    (value) => explicit.has(value) || !excluded.has(value),
  )) {
    if (!target.has(domain)) target.set(domain, reason);
  }
}

function addKeyword(
  keywords: string[],
  hideWords: string[],
  rule: KeywordRule,
): void {
  if (rule.mode === "block" || rule.mode === "both") {
    if (!keywords.includes(rule.text)) keywords.push(rule.text);
  }
  if (rule.mode === "hide" || rule.mode === "both") {
    if (!hideWords.includes(rule.text)) hideWords.push(rule.text);
  }
}

function minBoundary(
  boundaries: Array<number | null>,
  nowMs: number,
): number | null {
  const valid = boundaries.filter(
    (boundary): boundary is number =>
      typeof boundary === "number" &&
      Number.isFinite(boundary) &&
      boundary > nowMs,
  );
  return valid.length ? Math.min(...valid) : null;
}

export function isBlockingActive(state: AppState, nowMs: number): boolean {
  const plan = computeBlockPlan(state, nowMs);
  return plan.blocked.size > 0 || plan.allowOnly !== null || plan.keywords.length > 0;
}

export function isBlockContextActive(state: AppState, nowMs: number): boolean {
  const now = new Date(nowMs);
  return (
    state.session.status === "work" ||
    standaloneActive(state, nowMs) ||
    validSchedules(state.schedules).some((schedule) =>
      isScheduleActiveAt(schedule, now),
    )
  );
}

export function computeBlockPlan(state: AppState, nowMs: number): BlockPlan {
  const now = new Date(nowMs);
  const configuredSchedules = validSchedules(state.schedules);
  const schedules = configuredSchedules.filter((schedule) =>
    isScheduleActiveAt(schedule, now),
  );
  const blocked = new Map<string, BlockReason>();

  addDomains(
    blocked,
    state.alwaysBlockedSites,
    { kind: "always" },
    state.aliasExclusions,
  );

  const contexts: Array<{ sites: string[]; reason: BlockReason }> = [];
  if (standaloneActive(state, nowMs)) {
    contexts.push({
      sites: state.standalone.sites,
      reason: { kind: "standalone", until: state.standalone.until },
    });
  }
  if (state.session.status === "work") {
    contexts.push({
      sites: state.blockedSites,
      reason: { kind: "session", until: state.session.phaseEndsAt },
    });
  }
  for (const schedule of schedules) {
    contexts.push({
      sites: [
        ...schedule.sites,
        ...(schedule.useGlobalLists ? state.blockedSites : []),
      ],
      reason: {
        kind: "schedule",
        name: schedule.name,
        until: scheduleEndAt(schedule, now),
      },
    });
  }

  const contextDomains = new Set<string>();
  for (const context of contexts) {
    const explicit = new Set(
      context.sites
        .map(normalizeDomain)
        .filter((domain): domain is string => domain !== null),
    );
    const excluded = new Set(
      context.sites.flatMap((site) => {
        const normalized = normalizeDomain(site);
        return normalized
          ? (state.aliasExclusions[normalized] ?? [])
              .map(normalizeDomain)
              .filter((value): value is string => value !== null)
          : [];
      }),
    );
    for (const domain of expandAliases(context.sites).filter(
      (value) => explicit.has(value) || !excluded.has(value),
    )) {
      contextDomains.add(domain);
      if (blocked.has(domain)) continue;

      const configured = aliasAllowance(domain, state.allowances);
      if (!configured) {
        blocked.set(domain, context.reason);
        continue;
      }
      const record = usageFor(configured.key, state.usage);
      if (isExhausted(record, configured.value, nowMs)) {
        blocked.set(domain, {
          kind: "allowance",
          mode: configured.value.mode,
          resetsAt: nextResetAt(record ?? emptyUsage(now), configured.value, nowMs),
        });
      } else if (!configured.value.duringBlocks) {
        blocked.set(domain, context.reason);
      }
    }
  }

  for (const [domain, allowance] of Object.entries(state.allowances)) {
    const normalized = normalizeDomain(domain);
    if (!normalized || blocked.has(normalized)) continue;
    const record = usageFor(normalized, state.usage);
    if (isExhausted(record, allowance, nowMs)) {
      blocked.set(normalized, {
        kind: "allowance",
        mode: allowance.mode,
        resetsAt: nextResetAt(record ?? emptyUsage(now), allowance, nowMs),
      });
    }
  }

  const keywords: string[] = [];
  const hideWords: string[] = [];
  const blockContextActive =
    state.session.status === "work" ||
    standaloneActive(state, nowMs) ||
    schedules.length > 0;
  for (const rule of state.keywords) {
    if (rule.when === "always" || blockContextActive) {
      addKeyword(keywords, hideWords, rule);
    }
  }
  for (const schedule of schedules) {
    for (const text of schedule.keywords) {
      addKeyword(keywords, hideWords, { text, mode: "both", when: "blocks" });
    }
  }
  if (schedules.some((schedule) => schedule.useGlobalLists)) {
    for (const rule of state.keywords) addKeyword(keywords, hideWords, rule);
  }

  const task =
    state.session.status === "work" && state.session.taskId !== null
      ? state.tasks.find((candidate) => candidate.id === state.session.taskId)
      : undefined;

  // WP7-B4: a task may override the global allow-only mode. undefined and
  // null follow the global setting, an empty array disables allow-only for
  // the task, and a non-empty list allows only those domains.
  const taskAllowOnly = task?.allowOnly ?? null;
  let allowOnly: string[] | null = null;
  if (state.session.status === "work") {
    if (taskAllowOnly !== null) {
      allowOnly =
        taskAllowOnly.length > 0 ? expandAliases(taskAllowOnly) : null;
    } else if (
      state.settings.allowOnly.enabled &&
      state.settings.allowOnly.domains.length > 0
    ) {
      allowOnly = expandAliases(state.settings.allowOnly.domains);
    }
  }

  const nextBoundaryAt = minBoundary([
    nextScheduleBoundary(configuredSchedules, now),
    state.standalone.active && state.standalone.startsAt > nowMs
      ? state.standalone.startsAt
      : null,
    state.standalone.active && state.standalone.until > nowMs
      ? state.standalone.until
      : null,
    state.session.status !== "idle" && state.session.phaseEndsAt > nowMs
      ? state.session.phaseEndsAt
      : null,
    ...Object.entries(state.allowances).map(([domain, allowance]) => {
      const record = usageFor(domain, state.usage);
      if (!record) return null;
      if (allowance.mode === "interval") {
        const current = normalizeRecord(record, allowance, nowMs);
        return current.windowStartMs > 0
          ? nextResetAt(current, allowance, nowMs)
          : null;
      }
      return nextResetAt(record, allowance, nowMs);
    }),
    startOfNextLocalDay(nowMs),
  ], nowMs);

  return {
    blocked,
    allowOnly,
    keywords,
    hideWords,
    exceptions: [...state.exceptions],
    nextBoundaryAt,
  };
}

function emptyUsage(now: Date): UsageRecord {
  return {
    dateKey: localDateKey(now),
    usedMs: 0,
    opens: 0,
    windowStartMs: 0,
    lastActiveAt: 0,
  };
}

export function explainBlock(
  urlValue: string,
  state: AppState,
  nowMs: number,
): BlockReason | null {
  let url: URL;
  try {
    url = new URL(urlValue);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;

  const plan = computeBlockPlan(state, nowMs);
  if (matchException(urlValue, plan.exceptions)) return null;

  const host = normalizeDomain(url.hostname);
  if (!host) return null;
  const matchingDomains = [...plan.blocked.keys()]
    .filter((domain) => matchesDomain(host, domain))
    .sort((left, right) => right.length - left.length);
  if (matchingDomains.length) {
    return plan.blocked.get(matchingDomains[0]!) ?? null;
  }
  if (plan.allowOnly && !plan.allowOnly.some((domain) => matchesDomain(host, domain))) {
    return { kind: "allowOnly" };
  }

  const searchTerms = extractSearchText(url);
  const queryMatch = state.settings.keywords.scope.searchQuery
    ? matchKeyword(
        searchTerms.join(" "),
        plan.keywords,
        state.settings.keywords.match,
      )
    : null;
  if (queryMatch) {
    return { kind: "keyword", keyword: queryMatch, where: "query" };
  }
  const urlMatch = state.settings.keywords.scope.url
    ? matchKeyword(
        `${url.origin}${url.pathname}${url.search}`,
        plan.keywords,
        state.settings.keywords.match,
      )
    : null;
  return urlMatch
    ? { kind: "keyword", keyword: urlMatch, where: "url" }
    : null;
}

export interface UrlAssessment {
  valid: boolean;
  blocked: boolean;
  reason: BlockReason | null;
  exception: string | null;
  nextChangeAt: number | null;
}

/** Uses the same block decision as navigation enforcement and the block page. */
export function assessUrl(
  urlValue: string,
  state: AppState,
  nowMs: number,
): UrlAssessment {
  let url: URL;
  try {
    url = new URL(urlValue);
  } catch {
    return {
      valid: false,
      blocked: false,
      reason: null,
      exception: null,
      nextChangeAt: null,
    };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return {
      valid: false,
      blocked: false,
      reason: null,
      exception: null,
      nextChangeAt: null,
    };
  }

  const exception =
    state.exceptions.find((entry) => matchException(url.href, [entry])) ?? null;
  if (exception) {
    return {
      valid: true,
      blocked: false,
      reason: null,
      exception,
      nextChangeAt: null,
    };
  }
  const reason = explainBlock(url.href, state, nowMs);
  const nextChangeAt =
    reason?.kind === "session" ||
    reason?.kind === "standalone" ||
    reason?.kind === "schedule"
      ? reason.until
      : reason?.kind === "allowance"
        ? reason.resetsAt
        : null;
  return {
    valid: true,
    blocked: reason !== null,
    reason,
    exception: null,
    nextChangeAt,
  };
}

export function isFilteringActive(
  state: AppState,
  nowMs: number,
  host?: string,
): boolean {
  if (host !== undefined && !normalizeDomain(host)) return false;
  const plan = computeBlockPlan(state, nowMs);
  if (state.settings.keywords.scope.title && plan.hideWords.length > 0) {
    return true;
  }
  return isBlockContextActive(state, nowMs);
}
