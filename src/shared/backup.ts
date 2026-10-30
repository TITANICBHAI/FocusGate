import { DEFAULT_STATE } from "./defaults.ts";
import { normalizeDomain } from "./domains.ts";
import type {
  Allowance,
  AppState,
  DayStats,
  KeywordRule,
  Schedule,
  SessionGap,
  SessionRecord,
  Settings,
  Task,
} from "./types.ts";

export const BACKUP_MAX_BYTES = 2 * 1024 * 1024;
const MAX_ARRAY_ITEMS = 10_000;
const FORBIDDEN_KEYS = new Set([
  "password",
  "session",
  "standalone",
  "usage",
  "health",
  "backup_v1",
  "salt",
  "hash",
]);

export interface FocusGateBackup {
  app: "focusgate";
  schemaVersion: 2;
  exportedAt: number;
  data: {
    sites: string[];
    alwaysBlockedSites: string[];
    keywords: KeywordRule[];
    schedules: Schedule[];
    allowances: Record<string, Allowance>;
    exceptions: string[];
    tasks: Task[];
    settings: Settings;
    /** WP7-B6; optional so backups exported before habits still parse. */
    habits?: AppState["habits"];
    habitEntries?: AppState["habitEntries"];
    stats: {
      sessionHistory: SessionRecord[];
      dayStats: Record<string, DayStats>;
      recentBlocks: AppState["recentBlocks"];
      achievements: AppState["achievements"];
      lastWeeklyReport: AppState["lastWeeklyReport"];
      weeklyReports: AppState["weeklyReports"];
      keywordMatches: AppState["keywordMatches"];
    };
  };
}

export type BackupParseResult =
  | { ok: true; backup: FocusGateBackup }
  | { ok: false; error: string };

export interface BackupMergeReport {
  mode: "restore" | "merge";
  added: string[];
  skipped: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasKeys(
  value: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[] = [],
): boolean {
  const allowed = new Set([...required, ...optional]);
  return (
    required.every((key) => key in value) &&
    Object.keys(value).every((key) => allowed.has(key))
  );
}

function isFiniteNumber(value: unknown, min = 0): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= min;
}

function isString(value: unknown, maxLength = 2_000): value is string {
  return typeof value === "string" && value.length <= maxLength;
}

function isStringArray(value: unknown, maxItems = MAX_ARRAY_ITEMS): value is string[] {
  return (
    Array.isArray(value) &&
    value.length <= maxItems &&
    value.every((item) => isString(item, 2_000))
  );
}

function isBooleanRecord(value: unknown): value is Record<string, boolean> {
  return (
    isRecord(value) &&
    Object.values(value).every((item) => typeof item === "boolean")
  );
}

function isGap(value: unknown): value is SessionGap {
  return (
    isRecord(value) &&
    hasKeys(value, ["from", "to"]) &&
    isFiniteNumber(value.from) &&
    isFiniteNumber(value.to) &&
    value.to >= value.from
  );
}

function isKeyword(value: unknown): value is KeywordRule {
  return (
    isRecord(value) &&
    hasKeys(value, ["text", "mode", "when"]) &&
    isString(value.text, 200) &&
    value.text.trim().length > 0 &&
    (value.mode === "block" || value.mode === "hide" || value.mode === "both") &&
    (value.when === "blocks" || value.when === "always")
  );
}

function isSchedule(value: unknown): value is Schedule {
  return (
    isRecord(value) &&
    hasKeys(value, [
      "id",
      "name",
      "enabled",
      "days",
      "start",
      "end",
      "sites",
      "keywords",
      "useGlobalLists",
    ]) &&
    isString(value.id, 200) &&
    isString(value.name, 200) &&
    typeof value.enabled === "boolean" &&
    Array.isArray(value.days) &&
    value.days.length <= 7 &&
    value.days.every((day) => Number.isInteger(day) && day >= 0 && day <= 6) &&
    isString(value.start, 5) &&
    isString(value.end, 5) &&
    isStringArray(value.sites, 500) &&
    isStringArray(value.keywords, 500) &&
    typeof value.useGlobalLists === "boolean"
  );
}

function isAllowance(value: unknown): value is Allowance {
  if (!isRecord(value) || typeof value.duringBlocks !== "boolean") return false;
  if (value.mode === "time_budget") {
    return (
      hasKeys(value, ["mode", "limitMin", "duringBlocks"]) &&
      Number.isInteger(value.limitMin) &&
      Number(value.limitMin) >= 1 &&
      Number(value.limitMin) <= 1_440
    );
  }
  if (value.mode === "count") {
    return (
      hasKeys(value, ["mode", "maxOpens", "duringBlocks"]) &&
      Number.isInteger(value.maxOpens) &&
      Number(value.maxOpens) >= 1 &&
      Number(value.maxOpens) <= 100
    );
  }
  if (value.mode === "interval") {
    return (
      hasKeys(value, ["mode", "allowMin", "everyMin", "duringBlocks"]) &&
      Number.isInteger(value.allowMin) &&
      Number(value.allowMin) >= 1 &&
      Number(value.allowMin) <= 1_440 &&
      Number.isInteger(value.everyMin) &&
      Number(value.everyMin) >= 1 &&
      Number(value.everyMin) <= 10_080
    );
  }
  return false;
}

function isTask(value: unknown): value is Task {
  if (!isRecord(value)) return false;
  const required = [
    "id",
    "title",
    "durationMin",
    "priority",
    "tags",
    "recurring",
    "lockLevel",
    "completed",
    "createdAt",
  ];
  if (
    !hasKeys(value, required, [
      "description",
      "scheduledDate",
      "scheduledTime",
      "templateId",
      "completedAt",
      "allowOnly",
    ])
  ) {
    return false;
  }
  return (
    isString(value.id, 200) &&
    isString(value.title, 500) &&
    (value.description === undefined || isString(value.description, 4_000)) &&
    Number.isInteger(value.durationMin) &&
    Number(value.durationMin) >= 1 &&
    Number(value.durationMin) <= 999 &&
    (value.scheduledDate === undefined || isString(value.scheduledDate, 10)) &&
    (value.scheduledTime === undefined || isString(value.scheduledTime, 5)) &&
    (value.priority === "low" ||
      value.priority === "medium" ||
      value.priority === "high" ||
      value.priority === "critical") &&
    isStringArray(value.tags, 100) &&
    (value.recurring === "none" ||
      value.recurring === "daily" ||
      value.recurring === "weekdays" ||
      value.recurring === "weekly") &&
    (value.templateId === undefined || isString(value.templateId, 200)) &&
    (value.lockLevel === "none" ||
      value.lockLevel === "strict" ||
      value.lockLevel === "commitment") &&
    (value.allowOnly === undefined ||
      value.allowOnly === null ||
      (Array.isArray(value.allowOnly) &&
        value.allowOnly.length > 0 &&
        value.allowOnly.every((domain) => isString(domain, 255)))) &&
    typeof value.completed === "boolean" &&
    (value.completedAt === undefined || isFiniteNumber(value.completedAt)) &&
    isFiniteNumber(value.createdAt)
  );
}

function isSettings(value: unknown): value is Settings {
  if (!isRecord(value)) return false;
  if (
    !hasKeys(value, [
      "theme",
      "fontScale",
      "dailyGoalMin",
      "defaultDurationMin",
      "breaks",
      "notifications",
      "reminders",
      "blockPage",
      "contentFilters",
      "keywords",
      "allowOnly",
      "autoStartTasks",
    ])
  ) {
    return false;
  }
  const breaks = value.breaks;
  const notifications = value.notifications;
  const reminders = value.reminders;
  const blockPage = value.blockPage;
  const keywords = value.keywords;
  const allowOnly = value.allowOnly;
  return (
    (value.theme === "system" || value.theme === "dark" || value.theme === "light") &&
    typeof value.fontScale === "number" &&
    Number.isFinite(value.fontScale) &&
    value.fontScale >= 0.9 &&
    value.fontScale <= 1.2 &&
    Number.isInteger(value.dailyGoalMin) &&
    Number(value.dailyGoalMin) >= 1 &&
    Number(value.dailyGoalMin) <= 1_440 &&
    Number.isInteger(value.defaultDurationMin) &&
    Number(value.defaultDurationMin) >= 1 &&
    Number(value.defaultDurationMin) <= 999 &&
    isRecord(breaks) &&
    hasKeys(breaks, [
      "enabled",
      "shortMin",
      "longMin",
      "cyclesBeforeLong",
      "autoStartNext",
    ]) &&
    typeof breaks.enabled === "boolean" &&
    isFiniteNumber(breaks.shortMin, 1) &&
    breaks.shortMin <= 60 &&
    isFiniteNumber(breaks.longMin, 1) &&
    breaks.longMin <= 120 &&
    Number.isInteger(breaks.cyclesBeforeLong) &&
    Number(breaks.cyclesBeforeLong) >= 1 &&
    Number(breaks.cyclesBeforeLong) <= 20 &&
    typeof breaks.autoStartNext === "boolean" &&
    isRecord(notifications) &&
    hasKeys(notifications, [
      "sessionEnd",
      "breakEnd",
      "taskReminders",
      "weeklyReport",
      "achievements",
      "endOfDay",
      "allowanceAlerts",
    ]) &&
    Object.values(notifications).every((item) => typeof item === "boolean") &&
    isRecord(reminders) &&
    hasKeys(reminders, [
      "preStartMin",
      "atStart",
      "midSessionMin",
      "almostDone",
      "atEnd",
    ]) &&
    isFiniteNumberArray(reminders.preStartMin) &&
    isFiniteNumberArray(reminders.midSessionMin) &&
    typeof reminders.atStart === "boolean" &&
    typeof reminders.almostDone === "boolean" &&
    typeof reminders.atEnd === "boolean" &&
    isRecord(blockPage) &&
    hasKeys(blockPage, ["message", "quotes", "showQuotes", "sound"]) &&
    isString(blockPage.message, 2_000) &&
    isStringArray(blockPage.quotes, 100) &&
    typeof blockPage.showQuotes === "boolean" &&
    typeof blockPage.sound === "boolean" &&
    isBooleanRecord(value.contentFilters) &&
    isRecord(keywords) &&
    hasKeys(keywords, ["scope", "match"]) &&
    isRecord(keywords.scope) &&
    hasKeys(keywords.scope, ["searchQuery", "url", "title"]) &&
    Object.values(keywords.scope).every((item) => typeof item === "boolean") &&
    (keywords.match === "substring" || keywords.match === "wholeWord") &&
    isRecord(allowOnly) &&
    hasKeys(allowOnly, ["enabled", "domains"]) &&
    typeof allowOnly.enabled === "boolean" &&
    isDomainArray(allowOnly.domains) &&
    typeof value.autoStartTasks === "boolean"
  );
}

function isFiniteNumberArray(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.length <= 100 &&
    value.every((item) => isFiniteNumber(item))
  );
}

function isSessionRecord(value: unknown): value is SessionRecord {
  if (!isRecord(value)) return false;
  const required = [
    "id",
    "startedAt",
    "endedAt",
    "plannedMs",
    "elapsedMs",
    "status",
    "lockLevel",
    "blockedAttempts",
    "gaps",
  ];
  return (
    hasKeys(value, required, ["taskId", "clockSkewDetected"]) &&
    isString(value.id, 200) &&
    isFiniteNumber(value.startedAt) &&
    isFiniteNumber(value.endedAt) &&
    isFiniteNumber(value.plannedMs) &&
    isFiniteNumber(value.elapsedMs) &&
    (value.status === "completed" ||
      value.status === "abandoned" ||
      value.status === "interrupted") &&
    (value.lockLevel === "none" ||
      value.lockLevel === "strict" ||
      value.lockLevel === "commitment") &&
    (value.taskId === undefined || isString(value.taskId, 200)) &&
    isFiniteNumber(value.blockedAttempts) &&
    Array.isArray(value.gaps) &&
    value.gaps.length <= 500 &&
    value.gaps.every(isGap) &&
    (value.clockSkewDetected === undefined ||
      typeof value.clockSkewDetected === "boolean")
  );
}

function isDayStats(value: unknown): value is DayStats {
  if (!isRecord(value)) return false;
  return (
    hasKeys(
      value,
      [
        "dateKey",
        "focusMs",
        "sessionsCompleted",
        "sessionsAbandoned",
        "blocks",
        "blocksByDomain",
        "tasksCompleted",
      ],
      ["mood", "note"],
    ) &&
    isString(value.dateKey, 10) &&
    isFiniteNumber(value.focusMs) &&
    isFiniteNumber(value.sessionsCompleted) &&
    isFiniteNumber(value.sessionsAbandoned) &&
    isFiniteNumber(value.blocks) &&
    isRecord(value.blocksByDomain) &&
    Object.values(value.blocksByDomain).every((count) => isFiniteNumber(count)) &&
    isFiniteNumber(value.tasksCompleted) &&
    (value.mood === undefined ||
      (Number.isInteger(value.mood) && Number(value.mood) >= 1 && Number(value.mood) <= 5)) &&
    (value.note === undefined || isString(value.note, 4_000))
  );
}

function isJsonSafe(value: unknown, depth = 0): boolean {
  if (depth > 12) return false;
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return typeof value !== "string" || value.length <= 20_000;
  }
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) {
    return value.length <= MAX_ARRAY_ITEMS && value.every((item) => isJsonSafe(item, depth + 1));
  }
  if (!isRecord(value)) return false;
  return Object.entries(value).every(
    ([key, item]) =>
      !FORBIDDEN_KEYS.has(key.toLowerCase()) && isJsonSafe(item, depth + 1),
  );
}

function isHabit(value: unknown): value is AppState["habits"][number] {
  return (
    isRecord(value) &&
    hasKeys(value, ["id", "name", "emoji", "createdAt"]) &&
    isString(value.id, 200) &&
    isString(value.name, 200) &&
    isString(value.emoji, 8) &&
    isFiniteNumber(value.createdAt)
  );
}

function isHabitEntries(
  value: unknown,
): value is AppState["habitEntries"] {
  return (
    isRecord(value) &&
    Object.keys(value).length <= MAX_ARRAY_ITEMS &&
    Object.values(value).every((dates) => isStringArray(dates, MAX_ARRAY_ITEMS))
  );
}

function isStats(value: unknown): value is FocusGateBackup["data"]["stats"] {
  if (
    !isRecord(value) ||
    !hasKeys(value, [
      "sessionHistory",
      "dayStats",
      "recentBlocks",
      "achievements",
      "lastWeeklyReport",
      "weeklyReports",
      "keywordMatches",
    ])
  ) {
    return false;
  }
  return (
    Array.isArray(value.sessionHistory) &&
    value.sessionHistory.length <= 500 &&
    value.sessionHistory.every(isSessionRecord) &&
    isRecord(value.dayStats) &&
    Object.keys(value.dayStats).length <= 400 &&
    Object.values(value.dayStats).every(isDayStats) &&
    Array.isArray(value.recentBlocks) &&
    value.recentBlocks.length <= 200 &&
    value.recentBlocks.every(
      (item) =>
        isRecord(item) &&
        hasKeys(item, ["domain", "reason", "at"]) &&
        isString(item.domain, 255) &&
        isString(item.reason, 100) &&
        isFiniteNumber(item.at),
    ) &&
    Array.isArray(value.achievements) &&
    value.achievements.length <= 2_000 &&
    value.achievements.every((item) => isJsonSafe(item)) &&
    (value.lastWeeklyReport === null || isJsonSafe(value.lastWeeklyReport)) &&
    Array.isArray(value.weeklyReports) &&
    value.weeklyReports.length <= 8 &&
    value.weeklyReports.every((item) => isJsonSafe(item)) &&
    Array.isArray(value.keywordMatches) &&
    value.keywordMatches.length <= 50 &&
    value.keywordMatches.every(
      (item) =>
        isRecord(item) &&
        hasKeys(item, ["keyword", "domain", "where", "at"]) &&
        isString(item.keyword, 200) &&
        isString(item.domain, 255) &&
        isString(item.where, 100) &&
        isFiniteNumber(item.at),
    )
  );
}

function isDomainArray(value: unknown): value is string[] {
  return (
    isStringArray(value, MAX_ARRAY_ITEMS) &&
    value.every((site) => normalizeDomain(site) !== null)
  );
}

function isExceptionArray(value: unknown): value is string[] {
  return (
    isStringArray(value, MAX_ARRAY_ITEMS) &&
    value.every((item) => {
      try {
        const url = new URL(item);
        return (
          (url.protocol === "http:" || url.protocol === "https:") &&
          !url.username &&
          !url.password
        );
      } catch {
        return false;
      }
    })
  );
}

export function createBackup(state: AppState, exportedAt = Date.now()): FocusGateBackup {
  return {
    app: "focusgate",
    schemaVersion: 2,
    exportedAt,
    data: {
      sites: structuredClone(state.blockedSites),
      alwaysBlockedSites: structuredClone(state.alwaysBlockedSites),
      keywords: structuredClone(state.keywords),
      schedules: structuredClone(state.schedules),
      allowances: structuredClone(state.allowances),
      exceptions: structuredClone(state.exceptions),
      tasks: structuredClone(state.tasks),
      settings: structuredClone(state.settings),
      habits: structuredClone(state.habits),
      habitEntries: structuredClone(state.habitEntries),
      stats: {
        sessionHistory: structuredClone(state.sessionHistory),
        dayStats: structuredClone(state.dayStats),
        recentBlocks: structuredClone(state.recentBlocks),
        achievements: structuredClone(state.achievements),
        lastWeeklyReport: structuredClone(state.lastWeeklyReport),
        weeklyReports: structuredClone(state.weeklyReports),
        keywordMatches: structuredClone(state.keywordMatches),
      },
    },
  };
}

export function createBackupJson(state: AppState, exportedAt = Date.now()): string {
  const json = JSON.stringify(createBackup(state, exportedAt), null, 2);
  if (new TextEncoder().encode(json).byteLength > BACKUP_MAX_BYTES) {
    throw new Error("This backup exceeds the 2 MB limit and cannot be imported.");
  }
  return json;
}

export function parseBackupJson(json: string): BackupParseResult {
  if (new TextEncoder().encode(json).byteLength > BACKUP_MAX_BYTES) {
    return { ok: false, error: "Backup files must be 2 MB or smaller." };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, error: "This file is not valid JSON." };
  }
  if (!isRecord(parsed) || !hasKeys(parsed, ["app", "schemaVersion", "exportedAt", "data"])) {
    return { ok: false, error: "This is not a valid FocusGate backup." };
  }
  if (parsed.app !== "focusgate") {
    return { ok: false, error: "This file was not exported by FocusGate." };
  }
  if (parsed.schemaVersion !== 2) {
    return { ok: false, error: "This backup version is not supported." };
  }
  if (!isFiniteNumber(parsed.exportedAt) || !isRecord(parsed.data)) {
    return { ok: false, error: "This backup is missing required data." };
  }
  const data = parsed.data;
  const dataKeys = [
    "sites",
    "alwaysBlockedSites",
    "keywords",
    "schedules",
    "allowances",
    "exceptions",
    "tasks",
    "settings",
    "stats",
  ];
  if (
    !hasKeys(data, dataKeys) ||
    !isDomainArray(data.sites) ||
    !isDomainArray(data.alwaysBlockedSites) ||
    !Array.isArray(data.keywords) ||
    data.keywords.length > MAX_ARRAY_ITEMS ||
    !data.keywords.every(isKeyword) ||
    !Array.isArray(data.schedules) ||
    data.schedules.length > MAX_ARRAY_ITEMS ||
    !data.schedules.every(isSchedule) ||
    !isRecord(data.allowances) ||
    Object.keys(data.allowances).length > MAX_ARRAY_ITEMS ||
    !Object.keys(data.allowances).every((domain) => normalizeDomain(domain) !== null) ||
    !Object.values(data.allowances).every(isAllowance) ||
    !isExceptionArray(data.exceptions) ||
    !Array.isArray(data.tasks) ||
    data.tasks.length > MAX_ARRAY_ITEMS ||
    !data.tasks.every(isTask) ||
    !isSettings(data.settings) ||
    !isStats(data.stats) ||
    (data.habits !== undefined && !data.habits.every(isHabit)) ||
    (data.habitEntries !== undefined && !isHabitEntries(data.habitEntries))
  ) {
    return { ok: false, error: "The backup contains invalid or unsupported data." };
  }
  return { ok: true, backup: parsed as unknown as FocusGateBackup };
}

function hasUserData(state: AppState): boolean {
  if (state.schemaVersion !== 2) return false;
  return (
    state.blockedSites.length > 0 ||
    state.alwaysBlockedSites.length > 0 ||
    state.keywords.length > 0 ||
    state.exceptions.length > 0 ||
    state.schedules.length > 0 ||
    Object.keys(state.allowances).length > 0 ||
    Object.keys(state.usage).length > 0 ||
    state.tasks.length > 0 ||
    state.habits.length > 0 ||
    state.sessionHistory.length > 0 ||
    Object.keys(state.dayStats).length > 0 ||
    state.recentBlocks.length > 0 ||
    state.password !== null ||
    state.session.status !== "idle" ||
    state.standalone.active ||
    state.achievements.length > 0 ||
    state.lastWeeklyReport !== null ||
    state.weeklyReports.length > 0 ||
    state.keywordMatches.length > 0 ||
    JSON.stringify(state.settings) !== JSON.stringify(DEFAULT_STATE.settings)
  );
}

function normalizeImportedDomains(values: string[]): string[] {
  return [...new Set(values.map((value) => normalizeDomain(value)).filter(
    (value): value is string => value !== null,
  ))];
}

function mergeKeywordRules(
  current: KeywordRule[],
  incoming: KeywordRule[],
  report: BackupMergeReport,
): KeywordRule[] {
  const merged = [...current];
  const indexes = new Map(merged.map((rule, index) => [rule.text.toLowerCase(), index]));
  for (const rule of incoming) {
    const key = rule.text.toLowerCase();
    const index = indexes.get(key);
    if (index === undefined) {
      indexes.set(key, merged.length);
      merged.push(structuredClone(rule));
      report.added.push(`Keyword “${rule.text}”`);
      continue;
    }
    const previous = merged[index];
    const mode =
      previous.mode === rule.mode
        ? previous.mode
        : "both";
    const when =
      previous.when === "always" || rule.when === "always" ? "always" : "blocks";
    if (mode !== previous.mode || when !== previous.when) {
      merged[index] = { ...previous, mode, when };
      report.added.push(`Strengthened keyword “${rule.text}”`);
    }
  }
  return merged;
}

function stricterAllowance(
  current: Allowance | undefined,
  incoming: Allowance,
  report: BackupMergeReport,
  site: string,
): Allowance | undefined {
  if (!current) {
    if (incoming.duringBlocks) {
      report.skipped.push(
        `${site}: the “also allow during blocks” exemption was disabled for safety.`,
      );
    }
    report.added.push(`Allowance for ${site}`);
    return { ...incoming, duringBlocks: false } as Allowance;
  }
  if (current.mode !== incoming.mode) {
    report.skipped.push(`${site}: different allowance modes; existing protection was kept.`);
    return current;
  }
  let merged: Allowance;
  if (current.mode === "time_budget" && incoming.mode === "time_budget") {
    merged = {
      mode: "time_budget",
      limitMin: Math.min(current.limitMin, incoming.limitMin),
      duringBlocks: current.duringBlocks && incoming.duringBlocks,
    };
  } else if (current.mode === "count" && incoming.mode === "count") {
    merged = {
      mode: "count",
      maxOpens: Math.min(current.maxOpens, incoming.maxOpens),
      duringBlocks: current.duringBlocks && incoming.duringBlocks,
    };
  } else if (current.mode === "interval" && incoming.mode === "interval") {
    merged = {
      mode: "interval",
      allowMin: Math.min(current.allowMin, incoming.allowMin),
      everyMin: Math.max(current.everyMin, incoming.everyMin),
      duringBlocks: current.duringBlocks && incoming.duringBlocks,
    };
  } else {
    return current;
  }
  if (JSON.stringify(merged) !== JSON.stringify(current)) {
    report.added.push(`Strengthened allowance for ${site}`);
    if (current.duringBlocks && !incoming.duringBlocks) {
      report.skipped.push(`${site}: the existing block exemption was turned off.`);
    }
  }
  return merged;
}

function mergeProtectiveSettings(
  current: Settings,
  incoming: Settings,
  report: BackupMergeReport,
): Settings {
  const filtersKeptEnabled = Object.entries(current.contentFilters).filter(
    ([key, enabled]) => enabled && incoming.contentFilters[key] !== true,
  ).length;
  if (filtersKeptEnabled > 0) {
    report.skipped.push(
      `${filtersKeptEnabled} content filter setting(s) were kept enabled for safety.`,
    );
  }
  const contentKeys = new Set([
    ...Object.keys(current.contentFilters),
    ...Object.keys(incoming.contentFilters),
  ]);
  const contentFilters = Object.fromEntries(
    [...contentKeys].map((key) => [
      key,
      current.contentFilters[key] === true || incoming.contentFilters[key] === true,
    ]),
  );
  const scopes = {
    searchQuery:
      current.keywords.scope.searchQuery || incoming.keywords.scope.searchQuery,
    url: current.keywords.scope.url || incoming.keywords.scope.url,
    title: current.keywords.scope.title || incoming.keywords.scope.title,
  };
  const keptKeywordScopes = (
    ["searchQuery", "url", "title"] as const
  ).filter(
    (key) =>
      current.keywords.scope[key] && !incoming.keywords.scope[key],
  );
  if (keptKeywordScopes.length > 0) {
    report.skipped.push(
      `Keyword matching scope was kept enabled for: ${keptKeywordScopes.join(", ")}.`,
    );
  }
  if (
    current.keywords.match === "substring" &&
    incoming.keywords.match !== "substring"
  ) {
    report.skipped.push("The stricter substring keyword match was kept.");
  }

  let allowOnly = structuredClone(incoming.allowOnly);
  if (current.allowOnly.enabled && !incoming.allowOnly.enabled) {
    allowOnly = structuredClone(current.allowOnly);
    report.skipped.push("The existing allow-only protection was kept enabled.");
  } else if (current.allowOnly.enabled && incoming.allowOnly.enabled) {
    const intersection = current.allowOnly.domains.filter((domain) =>
      incoming.allowOnly.domains.includes(domain),
    );
    if (
      intersection.length === 0 &&
      current.allowOnly.domains.length > 0 &&
      incoming.allowOnly.domains.length > 0
    ) {
      allowOnly = structuredClone(current.allowOnly);
      report.skipped.push(
        "The imported allow-only list had no overlapping sites; existing protection was kept.",
      );
    } else {
      allowOnly = { enabled: true, domains: intersection };
    }
  }

  return {
    ...structuredClone(incoming),
    contentFilters,
    keywords: {
      ...structuredClone(incoming.keywords),
      scope: scopes,
      match:
        current.keywords.match === "substring" ||
        incoming.keywords.match === "substring"
          ? "substring"
          : "wholeWord",
    },
    allowOnly,
  };
}

export function applyBackup(
  current: AppState,
  backup: FocusGateBackup,
): { state: Partial<AppState>; report: BackupMergeReport } {
  const data = backup.data;
  const report: BackupMergeReport = {
    mode: hasUserData(current) ? "merge" : "restore",
    added: [],
    skipped: [],
  };
  const sites = normalizeImportedDomains(data.sites);
  const alwaysSites = normalizeImportedDomains(data.alwaysBlockedSites);

  if (report.mode === "restore") {
    report.added.push(
      `${sites.length + alwaysSites.length} blocked sites`,
      `${data.keywords.length} keywords`,
      `${data.schedules.length} schedules`,
      `${Object.keys(data.allowances).length} allowances`,
      `${data.tasks.length} tasks`,
      `${data.stats.sessionHistory.length} session records and statistics`,
    );
    return {
      state: {
        blockedSites: sites,
        alwaysBlockedSites: alwaysSites,
        keywords: structuredClone(data.keywords),
        schedules: structuredClone(data.schedules),
        allowances: structuredClone(data.allowances),
        exceptions: structuredClone(data.exceptions),
        tasks: structuredClone(data.tasks),
        settings: structuredClone(data.settings),
        sessionHistory: structuredClone(data.stats.sessionHistory),
        dayStats: structuredClone(data.stats.dayStats),
        recentBlocks: structuredClone(data.stats.recentBlocks),
        achievements: structuredClone(data.stats.achievements),
        lastWeeklyReport: structuredClone(data.stats.lastWeeklyReport),
        weeklyReports: structuredClone(data.stats.weeklyReports),
        keywordMatches: structuredClone(data.stats.keywordMatches),
        habits: structuredClone(data.habits ?? []),
        habitEntries: structuredClone(data.habitEntries ?? {}),
        password: current.password,
        session: current.session,
        standalone: current.standalone,
        usage: current.usage,
        health: current.health,
        backup_v1: current.backup_v1,
      },
      report,
    };
  }

  const blockedSites = [...new Set([...current.blockedSites, ...sites])];
  const alwaysBlockedSites = [...new Set([
    ...current.alwaysBlockedSites,
    ...alwaysSites,
  ])];
  const addedSites = blockedSites.length - current.blockedSites.length;
  const addedAlwaysSites =
    alwaysBlockedSites.length - current.alwaysBlockedSites.length;
  if (addedSites > 0) report.added.push(`${addedSites} blocked sites`);
  if (addedAlwaysSites > 0) {
    report.added.push(`${addedAlwaysSites} always-blocked sites`);
  }

  const keywords = mergeKeywordRules(current.keywords, data.keywords, report);
  const scheduleIds = new Set(current.schedules.map((schedule) => schedule.id));
  const newSchedules = data.schedules.filter((schedule) => !scheduleIds.has(schedule.id));
  if (newSchedules.length > 0) {
    report.added.push(`${newSchedules.length} new schedules`);
  }
  const taskIds = new Set(current.tasks.map((task) => task.id));
  const newTasks = data.tasks.filter((task) => !taskIds.has(task.id));
  if (newTasks.length > 0) report.added.push(`${newTasks.length} new tasks`);

  // WP7-B6: habits merge additively by id; check-in dates union per habit.
  const habitIds = new Set(current.habits.map((habit) => habit.id));
  const newHabits = (data.habits ?? []).filter((habit) => !habitIds.has(habit.id));
  const habitEntries: AppState["habitEntries"] = { ...current.habitEntries };
  for (const [habitId, dates] of Object.entries(data.habitEntries ?? {})) {
    if (current.habits.some((habit) => habit.id === habitId)) {
      habitEntries[habitId] = [
        ...new Set([...(current.habitEntries[habitId] ?? []), ...dates]),
      ].sort();
    } else if (newHabits.some((habit) => habit.id === habitId)) {
      habitEntries[habitId] = [...dates].sort();
    }
  }
  if (newHabits.length > 0) report.added.push(`${newHabits.length} new habits`);

  const allowances = { ...current.allowances };
  for (const [rawSite, incoming] of Object.entries(data.allowances)) {
    const site = normalizeDomain(rawSite);
    if (!site) continue;
    const merged = stricterAllowance(
      allowances[site],
      incoming,
      report,
      site,
    );
    if (merged) allowances[site] = merged;
  }

  if (data.exceptions.length > 0) {
    report.skipped.push(
      `${data.exceptions.length} exceptions were not imported into an existing state.`,
    );
  }
  const statsCount =
    data.stats.sessionHistory.length +
    Object.keys(data.stats.dayStats).length +
    data.stats.recentBlocks.length +
    data.stats.achievements.length +
    data.stats.weeklyReports.length +
    data.stats.keywordMatches.length +
    (data.stats.lastWeeklyReport === null ? 0 : 1);
  if (statsCount > 0) {
    report.skipped.push(
      `${statsCount} history/stat items were not imported into an existing state.`,
    );
  }
  const settings = mergeProtectiveSettings(current.settings, data.settings, report);
  if (JSON.stringify(settings) !== JSON.stringify(current.settings)) {
    report.added.push("Safe preferences and appearance settings");
  }

  return {
    state: {
      blockedSites,
      alwaysBlockedSites,
      keywords,
      schedules: [...current.schedules, ...newSchedules],
      tasks: [...current.tasks, ...newTasks],
      allowances,
      settings,
      habits: [...current.habits, ...newHabits],
      habitEntries,
    },
    report,
  };
}
