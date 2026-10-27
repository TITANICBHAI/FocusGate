import { createDefaultState } from "./defaults.ts";
import type {
  Allowance,
  AppState,
  BackupV1,
  BlockRecord,
  DayStats,
  KeywordRule,
  LockLevel,
  Schedule,
  SessionGap,
  SessionRecord,
  SessionRecordStatus,
  SessionState,
  StandaloneBlock,
  Task,
  TaskPriority,
  TaskRecurrence,
  UsageRecord,
  WeeklyReport,
} from "./types.ts";

const DAY_MS = 24 * 60 * 60 * 1000;
const BACKUP_RETENTION_MS = 30 * DAY_MS;

export const LEGACY_KEYS_TO_REMOVE = [
  "blockedKeywords",
  "timer_isActive",
  "timer_mode",
  "timer_timeLeft",
  "timer_totalTime",
  "timer_lockLevel",
  "timer_activeTaskId",
  "standaloneMode",
  "standaloneUntil",
  "dailyAllowances",
  "dailyUsage",
  "usageDate",
  "whitelistedUrls",
  "cooldownEnd",
  "temptationLog",
  "app_password_hash",
] as const;

export interface MigrationResult {
  set: AppState;
  remove: string[];
}

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};
}

function finiteNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function nonNegativeNumber(value: unknown, fallback = 0): number {
  return Math.max(0, finiteNumber(value, fallback));
}

function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function isLockLevel(value: unknown): value is LockLevel {
  return value === "none" || value === "strict" || value === "commitment";
}

function normalizeHost(input: string): string | null {
  const raw = input.trim();
  if (!raw || /[\s,]/.test(raw)) return null;

  let url: URL;
  try {
    url = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  const host = url.hostname.toLowerCase().replace(/\.$/, "").replace(/^www\./, "");
  if (!host || host.startsWith(".") || host.endsWith(".")) return null;
  if (host.startsWith("[") && host.endsWith("]") && /^[\[\]a-f\d:.]+$/i.test(host)) {
    return host;
  }
  if (host.includes(":")) return null;

  const labels = host.split(".");
  if (
    labels.some(
      (label) =>
        !label ||
        label.length > 63 ||
        !/^[a-z\d](?:[a-z\d-]*[a-z\d])?$/.test(label),
    )
  ) {
    return null;
  }
  return host;
}

function normalizeLegacyDomain(input: string): string | null {
  return normalizeHost(input);
}

function normalizeException(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;

  let url: URL;
  try {
    url = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  const host = normalizeHost(url.hostname);
  if (!host) return null;
  return `${host}${url.pathname.replace(/\/+$/, "")}${url.search}`;
}

function normalizedDomains(value: unknown): string[] {
  return unique(
    stringList(value)
      .map(normalizeLegacyDomain)
      .filter((domain): domain is string => domain !== null),
  );
}

function normalizeKeywordRules(value: unknown): KeywordRule[] {
  if (!Array.isArray(value)) return [];
  const rules: KeywordRule[] = [];
  for (const entry of value) {
    if (typeof entry === "string") {
      const text = entry.trim();
      if (text) rules.push({ text, mode: "both", when: "blocks" });
      continue;
    }

    const rule = asRecord(entry);
    const text = stringValue(rule.text).trim();
    if (text) {
      const mode =
        rule.mode === "block" || rule.mode === "hide" || rule.mode === "both"
          ? rule.mode
          : "both";
      const when = rule.when === "always" ? "always" : "blocks";
      rules.push({
        text,
        mode,
        when,
      });
    }
  }
  return rules;
}

function normalizeSchedule(value: unknown, index: number): Schedule | null {
  const schedule = asRecord(value);
  if (Object.keys(schedule).length === 0) return null;

  const days = Array.isArray(schedule.days)
    ? unique(
        schedule.days.filter(
          (day): day is number =>
            typeof day === "number" && Number.isInteger(day) && day >= 0 && day <= 6,
        ),
      )
    : [0, 1, 2, 3, 4, 5, 6];
  const sites = stringList(schedule.sites);
  const keywords = stringList(schedule.keywords);

  return {
    id: stringValue(schedule.id, `legacy-schedule-${index + 1}`),
    name: stringValue(schedule.name, `Schedule ${index + 1}`),
    enabled:
      typeof schedule.enabled === "boolean"
        ? schedule.enabled
        : schedule.isActive === true,
    days,
    start: stringValue(schedule.start, stringValue(schedule.startTime)),
    end: stringValue(schedule.end, stringValue(schedule.endTime)),
    sites,
    keywords,
    useGlobalLists:
      typeof schedule.useGlobalLists === "boolean" ? schedule.useGlobalLists : false,
  };
}

function normalizeSchedules(value: unknown): Schedule[] {
  return Array.isArray(value)
    ? value
        .map(normalizeSchedule)
        .filter((schedule): schedule is Schedule => schedule !== null)
    : [];
}

function validAllowance(value: unknown): Allowance | null {
  const allowance = asRecord(value);
  const duringBlocks =
    typeof allowance.duringBlocks === "boolean" ? allowance.duringBlocks : true;

  if (allowance.mode === "time_budget") {
    return {
      mode: "time_budget",
      limitMin: nonNegativeNumber(allowance.limitMin),
      duringBlocks,
    };
  }
  if (allowance.mode === "count") {
    return {
      mode: "count",
      maxOpens: nonNegativeNumber(allowance.maxOpens),
      duringBlocks,
    };
  }
  if (allowance.mode === "interval") {
    const everyMin = nonNegativeNumber(allowance.everyMin);
    const allowMin = nonNegativeNumber(allowance.allowMin, 5);
    if (everyMin <= 0 || allowMin > everyMin) return null;
    return { mode: "interval", allowMin, everyMin, duringBlocks };
  }

  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return { mode: "time_budget", limitMin: value, duringBlocks: true };
  }
  if (allowance.type === "time") {
    const limitMin = nonNegativeNumber(allowance.limit);
    return { mode: "time_budget", limitMin, duringBlocks: true };
  }
  if (allowance.type === "interval") {
    const everyMin = nonNegativeNumber(allowance.limit);
    return everyMin > 0
      ? { mode: "interval", allowMin: 5, everyMin, duringBlocks: true }
      : null;
  }
  return null;
}

function normalizeAllowances(value: unknown): Record<string, Allowance> {
  const result: Record<string, Allowance> = {};
  for (const [domain, config] of Object.entries(asRecord(value))) {
    const normalizedDomain = normalizeLegacyDomain(domain);
    const allowance = validAllowance(config);
    if (normalizedDomain && allowance) result[normalizedDomain] = allowance;
  }
  return result;
}

function normalizeUsage(value: unknown): Record<string, UsageRecord> {
  const result: Record<string, UsageRecord> = {};
  for (const [domain, raw] of Object.entries(asRecord(value))) {
    const normalizedDomain = normalizeLegacyDomain(domain);
    const entry = asRecord(raw);
    if (!normalizedDomain) continue;
    result[normalizedDomain] = {
      dateKey: stringValue(entry.dateKey),
      usedMs: nonNegativeNumber(entry.usedMs),
      opens: nonNegativeNumber(entry.opens),
      windowStartMs: nonNegativeNumber(entry.windowStartMs),
      lastActiveAt: nonNegativeNumber(entry.lastActiveAt),
    };
  }
  return result;
}

function normalizeTask(value: unknown, index: number, now: number): Task | null {
  const task = asRecord(value);
  const title = stringValue(task.title).trim();
  if (!title) return null;

  const priority: TaskPriority =
    task.priority === "low" ||
    task.priority === "medium" ||
    task.priority === "high" ||
    task.priority === "critical"
      ? task.priority
      : "medium";
  const recurring: TaskRecurrence =
    task.recurring === "daily" ||
    task.recurring === "weekdays" ||
    task.recurring === "weekly"
      ? task.recurring
      : "none";
  const lockLevel = isLockLevel(task.lockLevel)
    ? task.lockLevel
    : task.isLocked === true
      ? "strict"
      : "none";
  const scheduledDate =
    typeof task.scheduledDate === "string" ? task.scheduledDate : undefined;
  const scheduledTime =
    typeof task.scheduledTime === "string" ? task.scheduledTime : undefined;
  const description =
    typeof task.description === "string" ? task.description : undefined;
  const templateId =
    typeof task.templateId === "string" ? task.templateId : undefined;
  const completedAt =
    typeof task.completedAt === "number" && Number.isFinite(task.completedAt)
      ? task.completedAt
      : undefined;

  return {
    id: stringValue(task.id, `legacy-task-${index + 1}`),
    title,
    ...(description === undefined ? {} : { description }),
    durationMin: nonNegativeNumber(
      task.durationMin,
      nonNegativeNumber(task.durationMinutes, 25),
    ),
    ...(scheduledDate === undefined ? {} : { scheduledDate }),
    ...(scheduledTime === undefined ? {} : { scheduledTime }),
    priority,
    tags: stringList(task.tags),
    recurring,
    ...(templateId === undefined ? {} : { templateId }),
    lockLevel,
    completed: task.completed === true,
    ...(completedAt === undefined ? {} : { completedAt }),
    createdAt: nonNegativeNumber(task.createdAt, now),
  };
}

function normalizeTasks(value: unknown, now: number): Task[] {
  return Array.isArray(value)
    ? value
        .map((task, index) => normalizeTask(task, index, now))
        .filter((task): task is Task => task !== null)
    : [];
}

function normalizeGaps(value: unknown): SessionGap[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(asRecord)
    .filter(
      (gap) =>
        typeof gap.from === "number" &&
        Number.isFinite(gap.from) &&
        typeof gap.to === "number" &&
        Number.isFinite(gap.to) &&
        gap.to >= gap.from,
    )
    .map((gap) => ({ from: gap.from as number, to: gap.to as number }));
}

function isSessionRecordStatus(value: unknown): value is SessionRecordStatus {
  return value === "completed" || value === "abandoned" || value === "interrupted";
}

function normalizeSessionRecord(
  value: unknown,
  index: number,
  now: number,
): SessionRecord | null {
  const record = asRecord(value);
  if (Object.keys(record).length === 0) return null;

  const startedAt = nonNegativeNumber(record.startedAt, nonNegativeNumber(record.startTime));
  const legacyDurationMs = nonNegativeNumber(record.duration) * 1000;
  const plannedMs = nonNegativeNumber(record.plannedMs, legacyDurationMs);
  const legacyElapsed =
    record.elapsed === undefined
      ? record.status === "completed"
        ? plannedMs
        : Math.max(0, now - startedAt)
      : nonNegativeNumber(record.elapsed) * 1000;
  const elapsedMs = nonNegativeNumber(record.elapsedMs, legacyElapsed);
  const status: SessionRecordStatus =
    record.status === "active"
      ? "abandoned"
      : isSessionRecordStatus(record.status)
        ? record.status
        : "abandoned";
  const endedAt = finiteNumber(record.endedAt, startedAt + elapsedMs);
  const taskId = typeof record.taskId === "string" ? record.taskId : undefined;

  return {
    id: stringValue(record.id, `legacy-session-${index + 1}`),
    startedAt,
    endedAt,
    plannedMs,
    elapsedMs,
    status,
    lockLevel: isLockLevel(record.lockLevel) ? record.lockLevel : "none",
    ...(taskId === undefined ? {} : { taskId }),
    blockedAttempts: nonNegativeNumber(record.blockedAttempts),
    gaps: normalizeGaps(record.gaps),
  };
}

function normalizeSessionHistory(value: unknown, now: number): SessionRecord[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((record, index) => normalizeSessionRecord(record, index, now))
    .filter((record): record is SessionRecord => record !== null)
    .slice(-500);
}

function isSessionState(value: unknown): value is SessionState {
  const session = asRecord(value);
  return (
    (session.status === "idle" ||
      session.status === "work" ||
      session.status === "shortBreak" ||
      session.status === "longBreak") &&
    typeof session.sessionId === "string" &&
    typeof session.phaseEndsAt === "number"
  );
}

function migrateSession(v1: UnknownRecord, now: number): SessionState {
  const isActive = v1.timer_isActive === true;
  const timeLeftSec = nonNegativeNumber(v1.timer_timeLeft);
  if (!isActive || timeLeftSec <= 0) return createDefaultState().session;

  const phasePlannedMs = nonNegativeNumber(v1.timer_totalTime) * 1000;
  const phaseEndsAt = now + timeLeftSec * 1000;
  const activeTaskId = stringValue(v1.timer_activeTaskId);
  return {
    status: v1.timer_mode === "break" ? "shortBreak" : "work",
    sessionId: `migrated-${now}`,
    phaseStartedAt: phaseEndsAt - phasePlannedMs,
    phaseEndsAt,
    phasePlannedMs,
    plannedWorkMs: phasePlannedMs,
    extendedMs: 0,
    cycle: 0,
    lockLevel: isLockLevel(v1.timer_lockLevel) ? v1.timer_lockLevel : "none",
    taskId: activeTaskId || null,
    blockedAttempts: 0,
    lastHeartbeatAt: now,
    gaps: [],
  };
}

function migrateStandalone(
  v1: UnknownRecord,
  blockedSites: string[],
  now: number,
): { standalone: StandaloneBlock; alwaysBlockedSites: string[] } {
  const defaults = createDefaultState();
  const standaloneUntil = nonNegativeNumber(v1.standaloneUntil);
  const noLimit = v1.standaloneMode === true && standaloneUntil === 0;

  if (standaloneUntil > now) {
    return {
      standalone: {
        active: true,
        startsAt: now,
        until: standaloneUntil,
        sites: [...blockedSites],
        startedAt: now,
        extendedMs: 0,
        blockedAttempts: 0,
        lastSites: [...blockedSites],
      },
      alwaysBlockedSites: [],
    };
  }
  if (noLimit) {
    return {
      standalone: defaults.standalone,
      alwaysBlockedSites: [...blockedSites],
    };
  }
  return { standalone: defaults.standalone, alwaysBlockedSites: [] };
}

function localDateKey(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeBlockRecords(value: unknown): BlockRecord[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => asRecord(entry))
    .map((entry) => {
      const domain = normalizeLegacyDomain(stringValue(entry.domain));
      const at = finiteNumber(entry.at, finiteNumber(entry.timestamp, Number.NaN));
      if (!domain || !Number.isFinite(at)) return null;
      return {
        domain,
        reason: stringValue(entry.reason, "legacy"),
        at,
      };
    })
    .filter((entry): entry is BlockRecord => entry !== null)
    .slice(-200);
}

function aggregateLegacyBlocks(
  records: BlockRecord[],
  now: number,
): Record<string, DayStats> {
  const stats: Record<string, DayStats> = {};
  const cutoff = now - 30 * DAY_MS;
  for (const record of records) {
    if (record.at < cutoff || record.at > now) continue;
    const dateKey = localDateKey(record.at);
    const day = (stats[dateKey] ??= {
      dateKey,
      focusMs: 0,
      sessionsCompleted: 0,
      sessionsAbandoned: 0,
      blocks: 0,
      blocksByDomain: {},
      tasksCompleted: 0,
    });
    day.blocks += 1;
    day.blocksByDomain[record.domain] =
      (day.blocksByDomain[record.domain] ?? 0) + 1;
  }
  return stats;
}

function mergeSettings(value: unknown): AppState["settings"] {
  const defaults = createDefaultState().settings;
  const settings = asRecord(value);
  const breaks = asRecord(settings.breaks);
  const notifications = asRecord(settings.notifications);
  const reminders = asRecord(settings.reminders);
  const blockPage = asRecord(settings.blockPage);
  const keywords = asRecord(settings.keywords);
  const keywordScope = asRecord(keywords.scope);
  const allowOnly = asRecord(settings.allowOnly);
  const contentFilters = asRecord(settings.contentFilters);

  return {
    ...defaults,
    ...settings,
    breaks: { ...defaults.breaks, ...breaks },
    notifications: { ...defaults.notifications, ...notifications },
    reminders: { ...defaults.reminders, ...reminders },
    blockPage: { ...defaults.blockPage, ...blockPage },
    contentFilters: Object.fromEntries(
      Object.entries(contentFilters).filter(
        (entry): entry is [string, boolean] => typeof entry[1] === "boolean",
      ),
    ),
    keywords: {
      ...defaults.keywords,
      ...keywords,
      scope: { ...defaults.keywords.scope, ...keywordScope },
    },
    allowOnly: {
      ...defaults.allowOnly,
      ...allowOnly,
      domains: stringList(allowOnly.domains),
    },
  } as AppState["settings"];
}

function backupFor(v1: UnknownRecord, now: number): BackupV1 | null {
  const values = Object.fromEntries(
    Object.entries(v1).filter(([key]) => key !== "backup_v1"),
  );
  return Object.keys(values).length > 0
    ? { createdAt: now, values: structuredClone(values) }
    : null;
}

export function migrateV1(v1Bag: Record<string, unknown>, now: number): MigrationResult {
  const v1 = asRecord(v1Bag);
  const defaults = createDefaultState();
  const blockedSites = normalizedDomains(v1.blockedSites);
  const standaloneResult = migrateStandalone(v1, blockedSites, now);
  const rawAlwaysBlocked = normalizedDomains(v1.alwaysBlockedSites);
  const rawKeywords = Array.isArray(v1.keywords)
    ? normalizeKeywordRules(v1.keywords)
    : normalizeKeywordRules(v1.blockedKeywords);
  const rawExceptions = Array.isArray(v1.exceptions)
    ? v1.exceptions
    : v1.whitelistedUrls;
  const recentBlocks = normalizeBlockRecords(
    Array.isArray(v1.recentBlocks) ? v1.recentBlocks : v1.temptationLog,
  );
  const suppliedDayStats = asRecord(v1.dayStats);
  const rawHistory = normalizeSessionHistory(v1.sessionHistory, now);
  const rawSchedules = normalizeSchedules(v1.schedules);
  const rawTasks = normalizeTasks(v1.tasks, now);
  const rawAllowances = normalizeAllowances(
    Object.keys(asRecord(v1.allowances)).length > 0
      ? v1.allowances
      : v1.dailyAllowances,
  );
  const passwordValue = v1.password;
  const legacyPassword = stringValue(v1.app_password_hash);
  const password =
    passwordValue !== null &&
    typeof passwordValue === "object" &&
    typeof asRecord(passwordValue).algo === "string"
      ? (passwordValue as AppState["password"])
      : /^[a-f\d]{64}$/i.test(legacyPassword)
        ? { algo: "sha256-legacy" as const, hash: legacyPassword }
        : null;
  const history = rawHistory;
  const standalone = isRecordWithFields(v1.standalone, ["active", "until"])
    ? (v1.standalone as StandaloneBlock)
    : standaloneResult.standalone;
  const migratedSession = isSessionState(v1.session)
    ? v1.session
    : migrateSession(v1, now);
  const weeklyReports = Array.isArray(v1.weeklyReports)
    ? (v1.weeklyReports.filter(
        (report): report is WeeklyReport =>
          report !== null && typeof report === "object" && !Array.isArray(report),
      ) as WeeklyReport[])
    : [];

  const set: AppState = {
    ...defaults,
    schemaVersion: 2,
    session: migratedSession,
    standalone,
    blockedSites,
    alwaysBlockedSites: unique([
      ...rawAlwaysBlocked,
      ...standaloneResult.alwaysBlockedSites,
    ]),
    keywords: rawKeywords,
    exceptions: unique(
      stringList(rawExceptions)
        .map(normalizeException)
        .filter((entry): entry is string => entry !== null),
    ),
    schedules: rawSchedules,
    allowances: rawAllowances,
    usage: normalizeUsage(v1.usage),
    tasks: rawTasks,
    sessionHistory: history,
    dayStats:
      Object.keys(suppliedDayStats).length > 0
        ? (suppliedDayStats as Record<string, DayStats>)
        : aggregateLegacyBlocks(recentBlocks, now),
    recentBlocks,
    settings: mergeSettings(v1.settings),
    password,
    health: {
      ...defaults.health,
      ...asRecord(v1.health),
    },
    achievements: Array.isArray(v1.achievements)
      ? (v1.achievements.filter(
          (achievement): achievement is Record<string, unknown> =>
            achievement !== null &&
            typeof achievement === "object" &&
            !Array.isArray(achievement),
        ) as Record<string, unknown>[])
      : [],
    lastWeeklyReport:
      v1.lastWeeklyReport !== null &&
      typeof v1.lastWeeklyReport === "object" &&
      !Array.isArray(v1.lastWeeklyReport)
        ? (v1.lastWeeklyReport as WeeklyReport)
        : null,
    weeklyReports: weeklyReports.slice(-8),
    keywordMatches: Array.isArray(v1.keywordMatches)
      ? (v1.keywordMatches as AppState["keywordMatches"]).slice(-50)
      : [],
    backup_v1: backupFor(v1, now),
  };

  return {
    set,
    remove: [...LEGACY_KEYS_TO_REMOVE],
  };
}

function isRecordWithFields(value: unknown, fields: string[]): boolean {
  const record = asRecord(value);
  return fields.every((field) => field in record);
}

export function isBackupExpired(backup: unknown, now: number): boolean {
  const value = asRecord(backup);
  const createdAt = finiteNumber(value.createdAt, Number.NaN);
  return Number.isFinite(createdAt) && now - createdAt >= BACKUP_RETENTION_MS;
}
