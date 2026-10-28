import { computeBlockPlan, isBlockingActive } from "../shared/plan.ts";
import type { AppState } from "../shared/types.ts";
import type { BlockPlan } from "../shared/plan.ts";
import {
  BOUNDARY_ALARM,
  MIDNIGHT_ALARM,
  SESSION_PHASE_END_ALARM,
  STANDALONE_END_ALARM,
  TICK_ALARM,
  WEEKLY_REPORT_ALARM,
} from "./alarms.ts";

export interface AlarmHandlerDependencies {
  getState(): Promise<AppState>;
  ensureAlarms(
    state: AppState,
    plan: BlockPlan,
    now: number,
  ): Promise<void>;
  session: { handleAlarm(name: string): Promise<void> };
  attention: { sample(): Promise<unknown> };
  auditOpenTabs(state: AppState, now: number): Promise<unknown>;
  reconcile(reason: string): Promise<void>;
  handleWeeklyReport(): Promise<void>;
  handleMidnight(): Promise<void>;
  now(): number;
  onEffectError?(effect: string, error: unknown): void;
}

const HANDLED_ALARMS = new Set([
  TICK_ALARM,
  BOUNDARY_ALARM,
  SESSION_PHASE_END_ALARM,
  STANDALONE_END_ALARM,
  WEEKLY_REPORT_ALARM,
  MIDNIGHT_ALARM,
]);

/**
 * Staged v2 alarm dispatcher. The WP5 worker supplies the browser listeners
 * and concrete report/midnight handlers after the runtime gate is cleared.
 */
export function createAlarmHandler(
  dependencies: AlarmHandlerDependencies,
): (name: string) => Promise<boolean> {
  const runEffect = async (
    effect: string,
    operation: () => Promise<unknown>,
  ): Promise<void> => {
    try {
      await operation();
    } catch (error) {
      dependencies.onEffectError?.(effect, error);
    }
  };

  return async (name) => {
    if (!HANDLED_ALARMS.has(name)) return false;

    const now = dependencies.now();
    let state: AppState | undefined;
    let plan: BlockPlan | undefined;
    try {
      state = await dependencies.getState();
      plan = computeBlockPlan(state, now);
      await dependencies.ensureAlarms(state, plan, now);
    } catch (error) {
      dependencies.onEffectError?.("alarm-setup", error);
    }

    switch (name) {
      case TICK_ALARM: {
        await runEffect("session", () =>
          dependencies.session.handleAlarm(name),
        );
        await runEffect("attention", () => dependencies.attention.sample());
        try {
          const currentState = await dependencies.getState();
          const auditAt = dependencies.now();
          if (isBlockingActive(currentState, auditAt)) {
            await runEffect("open-tab-safety-audit", () =>
              dependencies.auditOpenTabs(currentState, auditAt),
            );
          }
        } catch (error) {
          dependencies.onEffectError?.("safety-audit-state", error);
        }
        break;
      }
      case SESSION_PHASE_END_ALARM:
      case STANDALONE_END_ALARM:
        await runEffect("session", () =>
          dependencies.session.handleAlarm(name),
        );
        break;
      case BOUNDARY_ALARM:
        await runEffect("reconcile", () =>
          dependencies.reconcile("boundary"),
        );
        break;
      case WEEKLY_REPORT_ALARM:
        await runEffect("weekly-report", () =>
          dependencies.handleWeeklyReport(),
        );
        break;
      case MIDNIGHT_ALARM:
        await runEffect("midnight", () => dependencies.handleMidnight());
        await runEffect("reconcile", () =>
          dependencies.reconcile("midnight"),
        );
        break;
    }
    return true;
  };
}
