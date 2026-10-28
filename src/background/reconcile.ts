import { buildDnrRules } from "../shared/dnr.ts";
import { normalizeDomain, normalizeException, matchesDomain } from "../shared/domains.ts";
import { computeBlockPlan, explainBlock, isValidSchedule } from "../shared/plan.ts";
import type { BlockReason, BlockPlan } from "../shared/plan.ts";
import type { AppState, Health } from "../shared/types.ts";
import type { SkippedDnrEntry } from "../shared/dnr.ts";

export interface ReconcileSnapshot {
  hash: string;
  blockedDomains: string[];
}

export interface ReconcileTab {
  id?: number;
  url?: string;
}

export interface ReconcileDependencies {
  getState(): Promise<AppState>;
  updateHealth(patch: Partial<Health>): Promise<void>;
  getDynamicRules(): Promise<chrome.declarativeNetRequest.Rule[]>;
  updateDynamicRules(update: {
    removeRuleIds: number[];
    addRules: chrome.declarativeNetRequest.Rule[];
  }): Promise<void>;
  getSnapshot(): Promise<ReconcileSnapshot | null>;
  setSnapshot(snapshot: ReconcileSnapshot): Promise<void>;
  ensureAlarms(state: AppState, plan: BlockPlan, now: number): Promise<void>;
  listTabs(): Promise<ReconcileTab[]>;
  updateTab(tabId: number, url: string): Promise<void>;
  recordBlock(tabId: number, domain: string, reason: BlockReason): Promise<void>;
  blockedBase: string;
  now(): number;
}

interface InstallResult {
  installedRules: chrome.declarativeNetRequest.Rule[];
  skipped: SkippedDnrEntry[];
  errors: string[];
  complete: boolean;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function displayEntry(value: unknown): string {
  return typeof value === "string"
    ? value.slice(0, 200)
    : `<${typeof value}>`;
}

function collectInvalidInputs(state: AppState): SkippedDnrEntry[] {
  const skipped: SkippedDnrEntry[] = [];
  const inspectDomains = (name: string, value: unknown) => {
    if (!Array.isArray(value)) {
      skipped.push({ entry: name, reason: "invalid-domain-list" });
      return;
    }
    value.forEach((entry, index) => {
      if (typeof entry !== "string" || normalizeDomain(entry) === null) {
        skipped.push({
          entry: `${name}[${index}]: ${displayEntry(entry)}`,
          reason: "invalid-domain",
        });
      }
    });
  };

  inspectDomains("blockedSites", state.blockedSites);
  inspectDomains("alwaysBlockedSites", state.alwaysBlockedSites);
  inspectDomains("standalone.sites", state.standalone?.sites);
  inspectDomains("settings.allowOnly.domains", state.settings?.allowOnly?.domains);

  if (Array.isArray(state.exceptions)) {
    state.exceptions.forEach((entry, index) => {
      if (typeof entry !== "string" || normalizeException(entry) === null) {
        skipped.push({
          entry: `exceptions[${index}]: ${displayEntry(entry)}`,
          reason: "invalid-exception",
        });
      }
    });
  } else {
    skipped.push({ entry: "exceptions", reason: "invalid-exception-list" });
  }

  const schedules: unknown = state.schedules;
  if (Array.isArray(schedules)) {
    schedules.forEach((schedule: unknown, index: number) => {
      if (!isValidSchedule(schedule)) {
        const identifier =
          schedule && typeof schedule === "object" && "id" in schedule
            ? displayEntry(schedule.id)
            : String(index);
        skipped.push({
          entry: `schedules[${identifier}]`,
          reason: "invalid-schedule",
        });
        return;
      }
      schedule.sites.forEach((site, siteIndex) => {
        if (normalizeDomain(site) === null) {
          skipped.push({
            entry: `schedules[${displayEntry(schedule.id)}].sites[${siteIndex}]: ${displayEntry(site)}`,
            reason: "invalid-domain",
          });
        }
      });
    });
  } else {
    skipped.push({ entry: "schedules", reason: "invalid-schedule-list" });
  }

  if (state.allowances && typeof state.allowances === "object") {
    for (const domain of Object.keys(state.allowances)) {
      if (!normalizeDomain(domain)) {
        skipped.push({
          entry: `allowances: ${displayEntry(domain)}`,
          reason: "invalid-domain",
        });
      }
    }
  }

  return skipped.slice(0, 500);
}

function snapshotForPlan(plan: BlockPlan): ReconcileSnapshot {
  const entries = [...plan.blocked.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([domain, reason]) => [domain, reason.kind]);
  const hash = JSON.stringify({
    blocked: entries,
    allowOnly: plan.allowOnly ? [...plan.allowOnly].sort() : null,
    keywords: [...plan.keywords].sort(),
    hideWords: [...plan.hideWords].sort(),
    exceptions: [...plan.exceptions].sort(),
    nextBoundaryAt: plan.nextBoundaryAt,
  });
  return {
    hash,
    blockedDomains: entries.map(([domain]) => domain),
  };
}

function ruleEntry(
  rule: chrome.declarativeNetRequest.Rule,
  plan: BlockPlan,
): string {
  if (rule.id === 1) return [...plan.blocked.keys()].join(", ") || "redirect";
  if (rule.id === 2) return "allow-only";
  return plan.exceptions[rule.id - 100] ?? `rule:${rule.id}`;
}

async function installRules(
  dependencies: ReconcileDependencies,
  rules: chrome.declarativeNetRequest.Rule[],
  plan: BlockPlan,
): Promise<InstallResult> {
  const skipped: SkippedDnrEntry[] = [];
  const errors: string[] = [];
  const existing = await dependencies.getDynamicRules();
  try {
    await dependencies.updateDynamicRules({
      removeRuleIds: existing.map((rule) => rule.id),
      addRules: rules,
    });
    return { installedRules: rules, skipped, errors, complete: true };
  } catch (error) {
    errors.push(`DNR batch update failed: ${errorMessage(error)}`);
  }

  const accepted: chrome.declarativeNetRequest.Rule[] = [];
  for (const rule of rules) {
    try {
      const current = await dependencies.getDynamicRules();
      await dependencies.updateDynamicRules({
        removeRuleIds: current.map((entry) => entry.id),
        addRules: [...accepted, rule],
      });
      accepted.push(rule);
    } catch (error) {
      const message = errorMessage(error);
      errors.push(`DNR rule ${rule.id} failed: ${message}`);
      skipped.push({
        entry: ruleEntry(rule, plan),
        reason: message.slice(0, 200),
      });
    }
  }

  const installedRules = await dependencies.getDynamicRules();
  return {
    installedRules,
    skipped,
    errors,
    complete: accepted.length === rules.length,
  };
}

async function auditNewlyBlockedTabs(
  dependencies: ReconcileDependencies,
  state: AppState,
  plan: BlockPlan,
  previous: ReconcileSnapshot | null,
  now: number,
): Promise<string[]> {
  const current = snapshotForPlan(plan);
  if (previous?.hash === current.hash) return [];
  const previousDomains = new Set(previous?.blockedDomains ?? []);
  const newlyBlocked = [...plan.blocked.keys()].filter(
    (domain) => !previousDomains.has(domain),
  );
  if (newlyBlocked.length === 0) return [];

  return auditTabs(dependencies, state, now, newlyBlocked);
}

async function auditTabs(
  dependencies: ReconcileDependencies,
  state: AppState,
  now: number,
  onlyDomains?: string[],
): Promise<string[]> {
  const errors: string[] = [];
  const tabs = await dependencies.listTabs();
  for (const tab of tabs) {
    if (!Number.isInteger(tab.id) || tab.id! < 0 || !tab.url) continue;
    let url: URL;
    try {
      url = new URL(tab.url);
    } catch {
      continue;
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") continue;
    const domain = normalizeDomain(url.hostname);
    if (
      !domain ||
      (onlyDomains &&
        !onlyDomains.some((blocked) => matchesDomain(domain, blocked)))
    ) {
      continue;
    }
    const reason = explainBlock(tab.url, state, now);
    if (!reason) continue;

    try {
      await dependencies.recordBlock(tab.id!, domain, reason);
    } catch (error) {
      errors.push(`Tab ${tab.id} block record failed: ${errorMessage(error)}`);
    }
    try {
      await dependencies.updateTab(
        tab.id!,
        `${dependencies.blockedBase}#${tab.url}`,
      );
    } catch (error) {
      errors.push(`Tab ${tab.id} redirect failed: ${errorMessage(error)}`);
    }
  }
  return errors;
}

/**
 * One-minute safety audit for already-open tabs. Kept separate from DNR
 * reconciliation so the periodic tick does not reinstall unchanged rules.
 */
export async function auditOpenBlockedTabs(
  dependencies: ReconcileDependencies,
  state?: AppState,
  now = dependencies.now(),
): Promise<string[]> {
  const currentState = state ?? (await dependencies.getState());
  return auditTabs(dependencies, currentState, now);
}

/**
 * Staged reconciliation service. It has no browser globals or storage
 * activation; the WP5 worker cutover supplies those adapters.
 */
export function createReconciler(
  dependencies: ReconcileDependencies,
): (reason: string) => Promise<void> {
  let running: Promise<void> | null = null;
  const pendingReasons = new Set<string>();

  const runOnce = async (): Promise<void> => {
    const reasons = [...pendingReasons].sort().join(",");
    pendingReasons.clear();
    const now = dependencies.now();
    const errors: string[] = [];
    let ruleCount = 0;
    let skipped: SkippedDnrEntry[] = [];
    let state: AppState | undefined;

    try {
      state = await dependencies.getState();
      const plan = computeBlockPlan(state, now);
      const built = buildDnrRules(plan, dependencies.blockedBase);
      skipped = [...collectInvalidInputs(state), ...built.skipped].slice(0, 500);

      let installation: InstallResult | null = null;
      try {
        installation = await installRules(dependencies, built.rules, plan);
        ruleCount = installation.installedRules.length;
        skipped = [...skipped, ...installation.skipped].slice(0, 500);
        errors.push(...installation.errors);
      } catch (error) {
        errors.push(`DNR reconciliation failed: ${errorMessage(error)}`);
      }

      try {
        await dependencies.ensureAlarms(state, plan, now);
      } catch (error) {
        errors.push(`Alarm reconciliation failed: ${errorMessage(error)}`);
      }

      let previous: ReconcileSnapshot | null = null;
      try {
        previous = await dependencies.getSnapshot();
      } catch (error) {
        errors.push(`Plan snapshot read failed: ${errorMessage(error)}`);
      }
      if (installation?.complete) {
        errors.push(
          ...(await auditNewlyBlockedTabs(
            dependencies,
            state,
            plan,
            previous,
            now,
          )),
        );
        try {
          await dependencies.setSnapshot(snapshotForPlan(plan));
        } catch (error) {
          errors.push(`Plan snapshot write failed: ${errorMessage(error)}`);
        }
      }
    } catch (error) {
      errors.push(`Reconciliation ${reasons} failed: ${errorMessage(error)}`);
    }

    await dependencies.updateHealth({
      lastReconcileAt: now,
      lastError: errors.length > 0 ? errors.join("; ").slice(0, 1_000) : null,
      ruleCount,
      skipped,
    });
  };

  const drain = async (): Promise<void> => {
    while (pendingReasons.size > 0) {
      try {
        await runOnce();
      } catch {
        // Persistence failures must not strand the coalescing queue.
      }
    }
  };

  const startDrain = (): Promise<void> => {
    const work = drain();
    running = work;
    void work.finally(() => {
      if (running === work) running = null;
      if (pendingReasons.size > 0) void startDrain();
    });
    return work;
  };

  return (reason) => {
    pendingReasons.add(reason);
    return running ?? startDrain();
  };
}
