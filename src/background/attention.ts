import {
  applyAttention,
  isExhausted,
  normalizeRecord,
} from "../shared/allowance.ts";
import { aliasGroup, matchesDomain, normalizeDomain } from "../shared/domains.ts";
import { explainBlock } from "../shared/plan.ts";
import { localDateKey, startOfNextLocalDay } from "../shared/time.ts";
import type { AppState, Allowance } from "../shared/types.ts";

export const IDLE_DETECTION_SECONDS = 60;

export interface AttentionCheckpoint {
  lastTickAt: number;
  lastDomain: string | null;
  lastAttentive: boolean;
}

export interface AttentionTab {
  active: boolean;
  url?: string;
  audible?: boolean;
}

export interface FocusedWindowSnapshot {
  focused: boolean;
  tabs?: AttentionTab[];
}

export type IdleState = "active" | "idle" | "locked";

export interface AttentionEventSource {
  addListener(listener: () => void): void;
  removeListener(listener: () => void): void;
}

export interface AttentionEventSources {
  tick: AttentionEventSource;
  tabActivated: AttentionEventSource;
  windowFocusChanged: AttentionEventSource;
  mainFrameCommitted: AttentionEventSource;
  idleStateChanged: AttentionEventSource;
}

export interface AttentionDependencies {
  getState(): Promise<AppState>;
  getCheckpoint(): Promise<AttentionCheckpoint | null>;
  setCheckpoint(value: AttentionCheckpoint): Promise<void>;
  getLastFocusedWindow(): Promise<FocusedWindowSnapshot | null>;
  getIdleState(detectionIntervalSeconds: number): Promise<IdleState>;
  /** Background-audio time is opt-in; undefined keeps the conservative default. */
  countAudible?: boolean;
  writeUsage(usage: AppState["usage"]): Promise<void>;
  /** WP7-B7: evaluated once per sample that changed durable usage. */
  allowanceAlerts?: { evaluate(): Promise<void> };
  now(): number;
  reconcile(reason: string): Promise<void>;
  onError?(error: unknown): void;
}

export interface AttentionSampleResult {
  domain: string | null;
  attentive: boolean;
  creditedMs: number;
  exhaustionChanged: boolean;
}

/**
 * Creates a staged attention sampler. The caller supplies chrome.storage,
 * window/idle APIs, and event sources so tests do not depend on browser globals.
 */
export function createAttentionTracker(dependencies: AttentionDependencies): {
  sample(): Promise<AttentionSampleResult>;
  attach(events: AttentionEventSources): () => void;
  whenIdle(): Promise<void>;
} {
  let queue: Promise<void> = Promise.resolve();

  const sample = (): Promise<AttentionSampleResult> => {
    const operation = queue.then(sampleOnce, sampleOnce);
    queue = operation.then(
      () => undefined,
      () => undefined,
    );
    return operation;
  };

  const attach = (events: AttentionEventSources): (() => void) => {
    const onChange = (): void => {
      void sample().catch((error: unknown) => dependencies.onError?.(error));
    };
    const sources = Object.values(events);
    sources.forEach((source) => source.addListener(onChange));
    return () => sources.forEach((source) => source.removeListener(onChange));
  };

  const sampleOnce = async (): Promise<AttentionSampleResult> => {
    const now = dependencies.now();
    const [state, previous, focusedWindow, idleState] = await Promise.all([
      dependencies.getState(),
      dependencies.getCheckpoint(),
      dependencies.getLastFocusedWindow(),
      dependencies.getIdleState(IDLE_DETECTION_SECONDS),
    ]);

    const deltaMs = previous ? Math.max(0, now - previous.lastTickAt) : 0;
    const usage = { ...state.usage };
    let creditedMs = 0;
    let exhaustionChanged = false;
    let usageChanged = false;

    if (previous?.lastAttentive && previous.lastDomain && deltaMs > 0) {
      const allowanceKey = findConfiguredAllowanceKey(
        previous.lastDomain,
        state.allowances,
      );
      const allowance = allowanceKey
        ? state.allowances[allowanceKey]
        : undefined;
      if (allowanceKey && allowance) {
        const current = usage[allowanceKey];
        const wasExhausted = isExhausted(current, allowance, now);
        if (!wasExhausted) {
          const normalizedCurrent = normalizeRecord(current, allowance, now);
          let creditStartAt = previous.lastTickAt;
          if (
            allowance.mode === "interval" &&
            current !== undefined &&
            current.windowStartMs > 0
          ) {
            const intervalEndsAt =
              current.windowStartMs + allowance.everyMin * 60_000;
            if (now >= intervalEndsAt) {
              creditStartAt = Math.max(creditStartAt, intervalEndsAt);
            }
          } else if (
            current !== undefined &&
            allowance.mode !== "interval" &&
            current.dateKey !== localDateKey(new Date(now))
          ) {
            creditStartAt = Math.max(
              creditStartAt,
              startOfNextLocalDay(previous.lastTickAt),
            );
          }
          const next = applyAttention(
            current,
            allowance,
            now,
            Math.max(0, now - creditStartAt),
          );
          if (
            (allowance.mode === "interval" || allowance.mode === "count") &&
            normalizedCurrent.windowStartMs === 0
          ) {
            next.windowStartMs = creditStartAt;
          }
          usage[allowanceKey] = next;
          creditedMs = Math.max(0, next.usedMs - normalizedCurrent.usedMs);
          exhaustionChanged =
            wasExhausted !== isExhausted(next, allowance, now);
          usageChanged = true;
        }
      }
    }

    const activeTab = focusedWindow?.tabs?.find((tab) => tab.active);
    const domain = activeTab?.url
      ? findAllowanceForUrl(activeTab.url, state.allowances)
      : null;
    const stateWithUsage = usageChanged ? { ...state, usage } : state;
    const attentive = Boolean(
      domain &&
        activeTab &&
        activeTab.url &&
        !explainBlock(activeTab.url, stateWithUsage, now) &&
        ((focusedWindow?.focused === true && idleState === "active") ||
          (dependencies.countAudible === true && activeTab.audible === true)),
    );

    // Advance the session checkpoint before writing durable usage. If the
    // worker dies between writes, this loses at most one sample instead of
    // crediting the same interval twice after recovery.
    await dependencies.setCheckpoint({
      lastTickAt: now,
      lastDomain: domain,
      lastAttentive: attentive,
    });
    if (usageChanged) {
      await dependencies.writeUsage(usage);
      if (dependencies.allowanceAlerts) {
        try {
          await dependencies.allowanceAlerts.evaluate();
        } catch (error) {
          dependencies.onError?.(error);
        }
      }
    }
    if (exhaustionChanged) await dependencies.reconcile("allowance");

    return { domain, attentive, creditedMs, exhaustionChanged };
  };

  return {
    sample,
    attach,
    whenIdle: () => queue,
  };
}

function findAllowanceForUrl(
  urlValue: string,
  allowances: Record<string, Allowance>,
): string | null {
  let url: URL;
  try {
    url = new URL(urlValue);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;

  const host = normalizeDomain(url.hostname);
  if (!host) return null;

  return (
    Object.keys(allowances)
      .sort()
      .map((key) => normalizeDomain(key))
      .find(
        (key): key is string =>
          key !== null &&
          aliasGroup(key).some((member) => matchesDomain(host, member)),
      ) ?? null
  );
}

function findConfiguredAllowanceKey(
  domain: string,
  allowances: Record<string, Allowance>,
): string | null {
  const normalized = normalizeDomain(domain);
  if (!normalized) return null;
  return (
    Object.keys(allowances)
      .sort()
      .map((key) => normalizeDomain(key))
      .find((key): key is string => key !== null && key === normalized) ?? null
  );
}
