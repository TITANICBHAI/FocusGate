import { computeBlockPlan } from "./plan.ts";
import type { GuardAction } from "./gating.ts";
import type {
  Allowance,
  AppState,
  Schedule,
} from "./types.ts";

export type GuardedStateKey =
  | "blockedSites"
  | "alwaysBlockedSites"
  | "keywords"
  | "exceptions"
  | "schedules"
  | "allowances"
  | "tasks"
  | "settings";

function addSetChanges(
  previous: readonly string[],
  next: readonly string[],
  addAction: GuardAction,
  removeAction: GuardAction,
  actions: GuardAction[],
): void {
  const oldSet = new Set(previous);
  const newSet = new Set(next);
  if ([...newSet].some((item) => !oldSet.has(item))) actions.push(addAction);
  if ([...oldSet].some((item) => !newSet.has(item))) actions.push(removeAction);
}

function keywordWeakens(
  previous: AppState["keywords"][number],
  next: AppState["keywords"][number],
): boolean {
  return (
    (previous.mode === "block" && next.mode === "hide") ||
    (previous.mode === "both" && next.mode !== "both") ||
    (previous.when === "always" && next.when === "blocks")
  );
}

function timeMinutes(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 24 || minute > 59 || (hour === 24 && minute !== 0)) return null;
  return hour * 60 + minute;
}

function scheduleShortened(previous: Schedule, next: Schedule): boolean {
  if (previous.enabled && !next.enabled) return true;
  if (previous.days.some((day) => !next.days.includes(day))) return true;
  const previousStart = timeMinutes(previous.start);
  const nextStart = timeMinutes(next.start);
  const previousEnd = timeMinutes(previous.end);
  const nextEnd = timeMinutes(next.end);
  if (
    previousStart === null ||
    nextStart === null ||
    previousEnd === null ||
    nextEnd === null
  ) {
    return (
      previous.start !== next.start ||
      previous.end !== next.end ||
      previous.days.join(",") !== next.days.join(",")
    );
  }
  return (
    nextStart > previousStart ||
    nextEnd < previousEnd ||
    (previous.useGlobalLists && !next.useGlobalLists)
  );
}

function scheduleActions(
  previous: AppState["schedules"],
  next: AppState["schedules"],
  actions: GuardAction[],
): void {
  const oldById = new Map(previous.map((item) => [item.id, item]));
  const newById = new Map(next.map((item) => [item.id, item]));
  if ([...newById.keys()].some((id) => !oldById.has(id))) {
    actions.push("add_schedule");
  }
  if ([...oldById.keys()].some((id) => !newById.has(id))) {
    actions.push("delete_schedule");
  }
  for (const [id, oldSchedule] of oldById) {
    const newSchedule = newById.get(id);
    if (!newSchedule) continue;
    if (oldSchedule.sites.some((site) => !newSchedule.sites.includes(site))) {
      actions.push("remove_schedule_site");
    }
    if (
      oldSchedule.keywords.some(
        (keyword) => !newSchedule.keywords.includes(keyword),
      )
    ) {
      actions.push("shorten_schedule");
    }
    if (scheduleShortened(oldSchedule, newSchedule)) {
      actions.push(
        oldSchedule.enabled && !newSchedule.enabled
          ? "disable_schedule"
          : "shorten_schedule",
      );
    }
  }
}

function allowanceIncreases(
  previous: Allowance,
  next: Allowance,
): boolean {
  if (previous.mode !== next.mode) return true;
  if (previous.mode === "time_budget" && next.mode === "time_budget") {
    return next.limitMin > previous.limitMin;
  }
  if (previous.mode === "count" && next.mode === "count") {
    return next.maxOpens > previous.maxOpens;
  }
  if (previous.mode === "interval" && next.mode === "interval") {
    return (
      next.allowMin > previous.allowMin ||
      next.everyMin < previous.everyMin
    );
  }
  return true;
}

function allowanceActions(
  previous: AppState,
  next: AppState,
  now: number,
  actions: GuardAction[],
): void {
  const oldEntries = Object.entries(previous.allowances);
  const newEntries = Object.entries(next.allowances);
  const oldBySite = new Map(oldEntries);
  const newBySite = new Map(newEntries);
  const blockedNow = computeBlockPlan(previous, now).blocked;

  for (const [site, allowance] of newBySite) {
    const oldAllowance = oldBySite.get(site);
    if (!oldAllowance) {
      actions.push(
        allowance.duringBlocks && blockedNow.has(site)
          ? "add_exempt_allowance"
          : "add_cap_limit",
      );
      continue;
    }
    if (!oldAllowance.duringBlocks && allowance.duringBlocks) {
      actions.push("turn_during_blocks_on");
    }
    if (allowanceIncreases(oldAllowance, allowance)) {
      actions.push("raise_limit");
    } else if (allowanceIncreases(allowance, oldAllowance)) {
      actions.push("lower_limit");
    }
  }
  if ([...oldBySite.keys()].some((site) => !newBySite.has(site))) {
    actions.push("remove_allowance");
  }
}

function taskActions(
  previous: AppState,
  next: AppState,
  actions: GuardAction[],
): void {
  const oldById = new Map(previous.tasks.map((task) => [task.id, task]));
  const newById = new Map(next.tasks.map((task) => [task.id, task]));
  const changed = [...oldById.keys()].some(
    (id) =>
      !newById.has(id) ||
      JSON.stringify(oldById.get(id)) !== JSON.stringify(newById.get(id)),
  ) || [...newById.keys()].some((id) => !oldById.has(id));
  if (!changed) return;

  const removesLinkedTask =
    previous.session.status === "work" &&
    previous.session.taskId !== null &&
    oldById.has(previous.session.taskId) &&
    !newById.has(previous.session.taskId);
  actions.push(removesLinkedTask ? "delete_linked_task" : "edit_unlinked_task");
}

function settingsActions(
  previous: AppState["settings"],
  next: AppState["settings"],
  actions: GuardAction[],
): void {
  if (previous.theme !== next.theme) actions.push("change_theme");
  if (JSON.stringify(previous.notifications) !== JSON.stringify(next.notifications)) {
    actions.push("change_notifications");
  }
  const filterKeys = new Set([
    ...Object.keys(previous.contentFilters),
    ...Object.keys(next.contentFilters),
  ]);
  for (const key of filterKeys) {
    const wasEnabled = previous.contentFilters[key] === true;
    const isEnabled = next.contentFilters[key] === true;
    if (wasEnabled && !isEnabled) actions.push("turn_filter_off");
    if (!wasEnabled && isEnabled) actions.push("turn_filter_on");
  }
}

/**
 * Classify a user-editable state write. Weakening actions are returned before
 * strengthening actions so a mixed batch cannot bypass the stricter policy.
 */
export function classifyStateMutation(
  previous: AppState,
  next: AppState,
  now: number,
): GuardAction[] {
  const actions: GuardAction[] = [];

  addSetChanges(
    previous.blockedSites,
    next.blockedSites,
    "add_site",
    "remove_site",
    actions,
  );
  addSetChanges(
    previous.alwaysBlockedSites,
    next.alwaysBlockedSites,
    "add_always_site",
    "remove_always_site",
    actions,
  );
  addSetChanges(
    previous.exceptions,
    next.exceptions,
    "add_exception",
    "remove_exception",
    actions,
  );

  const oldKeywords = new Map(
    previous.keywords.map((rule) => [rule.text.toLowerCase(), rule]),
  );
  const newKeywords = new Map(
    next.keywords.map((rule) => [rule.text.toLowerCase(), rule]),
  );
  if ([...newKeywords.keys()].some((text) => !oldKeywords.has(text))) {
    actions.push("add_keyword");
  }
  if ([...oldKeywords.keys()].some((text) => !newKeywords.has(text))) {
    actions.push(
      previous.keywords.length > 0 && next.keywords.length === 0
        ? "clear_keywords"
        : "remove_keyword",
    );
  }
  for (const [text, oldRule] of oldKeywords) {
    const newRule = newKeywords.get(text);
    if (newRule && keywordWeakens(oldRule, newRule)) {
      actions.push("weaken_keyword");
    }
  }

  scheduleActions(previous.schedules, next.schedules, actions);
  allowanceActions(previous, next, now, actions);
  taskActions(previous, next, actions);
  settingsActions(previous.settings, next.settings, actions);

  const classOrder: Record<GuardAction, number> = {
    add_site: 1,
    add_always_site: 1,
    add_keyword: 1,
    add_schedule: 1,
    turn_filter_on: 1,
    extend_session: 1,
    add_standalone_site: 1,
    extend_standalone: 1,
    add_cap_limit: 1,
    lower_limit: 1,
    remove_exception: 1,
    skip_break: 1,
    import_backup: 1,
    change_theme: 1,
    change_notifications: 1,
    manage_presets: 1,
    edit_unlinked_task: 1,
    remove_site: 0,
    remove_always_site: 0,
    remove_keyword: 0,
    clear_keywords: 0,
    weaken_keyword: 0,
    remove_schedule_site: 0,
    shorten_schedule: 0,
    disable_schedule: 0,
    delete_schedule: 0,
    add_exception: 0,
    remove_allowance: 0,
    raise_limit: 0,
    turn_during_blocks_on: 0,
    add_exempt_allowance: 0,
    turn_filter_off: 0,
    stop_session: 2,
    change_password: 2,
    remove_password: 2,
    reset_data: 2,
    delete_linked_task: 2,
  };
  return [...new Set(actions)].sort(
    (left, right) => classOrder[left] - classOrder[right],
  );
}
