export type LockLevel = "none" | "strict" | "commitment";

export type SessionStatus = "idle" | "work" | "shortBreak" | "longBreak";

export interface SessionGap {
  from: number;
  to: number;
}

export interface SessionState {
  status: SessionStatus;
  sessionId: string;
  phaseStartedAt: number;
  phaseEndsAt: number;
  phasePlannedMs: number;
  plannedWorkMs: number;
  extendedMs: number;
  cycle: number;
  lockLevel: LockLevel;
  taskId: string | null;
  blockedAttempts: number;
  lastHeartbeatAt: number;
  gaps: SessionGap[];
  stopChallengeStartedAt?: number | null;
  clockSkewDetected?: boolean;
}

export interface Schedule {
  id: string;
  name: string;
  enabled: boolean;
  days: number[];
  start: string;
  end: string;
  sites: string[];
  keywords: string[];
  useGlobalLists: boolean;
}

export type Allowance =
  | ({ mode: "time_budget"; limitMin: number } & { duringBlocks: boolean })
  | ({ mode: "count"; maxOpens: number } & { duringBlocks: boolean })
  | ({
      mode: "interval";
      allowMin: number;
      everyMin: number;
    } & { duringBlocks: boolean });

export interface UsageRecord {
  dateKey: string;
  usedMs: number;
  opens: number;
  windowStartMs: number;
  lastActiveAt: number;
}

export interface StandaloneBlock {
  active: boolean;
  startsAt: number;
  until: number;
  sites: string[];
  startedAt: number;
  extendedMs: number;
  blockedAttempts: number;
  lastSites: string[];
}

export type TaskPriority = "low" | "medium" | "high" | "critical";
export type TaskRecurrence = "none" | "daily" | "weekdays" | "weekly";

export interface Task {
  id: string;
  title: string;
  description?: string;
  durationMin: number;
  scheduledDate?: string;
  scheduledTime?: string;
  priority: TaskPriority;
  tags: string[];
  recurring: TaskRecurrence;
  templateId?: string;
  lockLevel: LockLevel;
  completed: boolean;
  completedAt?: number;
  createdAt: number;
}

export type SessionRecordStatus = "completed" | "abandoned" | "interrupted";

export interface SessionRecord {
  id: string;
  startedAt: number;
  endedAt: number;
  plannedMs: number;
  /** Minutes added after the original work phase began, in milliseconds. */
  extendedMs?: number;
  elapsedMs: number;
  status: SessionRecordStatus;
  lockLevel: LockLevel;
  taskId?: string;
  blockedAttempts: number;
  gaps: SessionGap[];
  clockSkewDetected?: boolean;
}

export interface DayStats {
  dateKey: string;
  focusMs: number;
  sessionsCompleted: number;
  sessionsAbandoned: number;
  blocks: number;
  blocksByDomain: Record<string, number>;
  tasksCompleted: number;
  mood?: number;
  note?: string;
}

export interface KeywordRule {
  text: string;
  mode: "block" | "hide" | "both";
  when: "blocks" | "always";
}

export interface BlockRecord {
  domain: string;
  reason: string;
  at: number;
}

export interface PasswordRecord {
  algo: "pbkdf2-sha256";
  iter: number;
  salt: string;
  hash: string;
}

export interface LegacyPasswordRecord {
  algo: "sha256-legacy";
  hash: string;
}

export type PasswordState = PasswordRecord | LegacyPasswordRecord | null;

export interface Settings {
  theme: "system" | "dark" | "light";
  fontScale: number;
  dailyGoalMin: number;
  defaultDurationMin: number;
  breaks: {
    enabled: boolean;
    shortMin: number;
    longMin: number;
    cyclesBeforeLong: number;
    autoStartNext: boolean;
  };
  notifications: {
    sessionEnd: boolean;
    breakEnd: boolean;
    taskReminders: boolean;
    weeklyReport: boolean;
    achievements: boolean;
  };
  reminders: {
    preStartMin: number[];
    atStart: boolean;
    midSessionMin: number[];
    almostDone: boolean;
    atEnd: boolean;
  };
  blockPage: {
    message: string;
    quotes: string[];
    showQuotes: boolean;
    sound: boolean;
  };
  contentFilters: Record<string, boolean>;
  keywords: {
    scope: {
      searchQuery: boolean;
      url: boolean;
      title: boolean;
    };
    match: "substring" | "wholeWord";
  };
  allowOnly: {
    enabled: boolean;
    domains: string[];
  };
  autoStartTasks: boolean;
}

export interface Health {
  lastHeartbeatAt: number;
  lastReconcileAt: number;
  lastError: string | null;
  ruleCount: number;
  skipped?: { entry: string; reason: string }[];
}

export interface BlockPreset {
  id: string;
  name: string;
  emoji: string;
  domains: string[];
  builtIn: boolean;
}

export interface BackupV1 {
  createdAt: number;
  values: Record<string, unknown>;
}

export interface WeeklyReport {
  [key: string]: unknown;
}

export interface KeywordMatch {
  keyword: string;
  domain: string;
  where: string;
  at: number;
}

export interface AppState {
  schemaVersion: 2;
  /** User-created presets are staged state; built-ins remain code-defined. */
  customPresets: BlockPreset[];
  /** Destination used by the popup's quick-block action. */
  quickBlockMode: "focus" | "always";
  /** Per-site aliases the user has chosen not to block. */
  aliasExclusions: Record<string, string[]>;
  session: SessionState;
  standalone: StandaloneBlock;
  blockedSites: string[];
  alwaysBlockedSites: string[];
  keywords: KeywordRule[];
  exceptions: string[];
  schedules: Schedule[];
  allowances: Record<string, Allowance>;
  usage: Record<string, UsageRecord>;
  tasks: Task[];
  sessionHistory: SessionRecord[];
  dayStats: Record<string, DayStats>;
  recentBlocks: BlockRecord[];
  settings: Settings;
  password: PasswordState;
  health: Health;
  achievements: Record<string, unknown>[];
  lastWeeklyReport: WeeklyReport | null;
  weeklyReports: WeeklyReport[];
  keywordMatches: KeywordMatch[];
  backup_v1: BackupV1 | null;
}

export type StateKey = keyof AppState;

export interface StateChange<T = unknown> {
  oldValue?: T;
  newValue?: T;
}

export type StateChanges = Partial<{
  [K in StateKey]: StateChange<AppState[K]>;
}>;
