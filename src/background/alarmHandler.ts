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
import { TASK_REMINDER_ALARM_PREFIX } from "./taskAlarms.ts";

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
  tasks?: {
    reconcile(): Promise<void>;
    handleReminderAlarm(name: string): Promise<boolean>;
  };
  /** WP7-B5: end-of-day reflection reminder, run at local midnight. */
  reflection?: { notifyEndOfDay(now: number): Promise<void> };
  /** WP7-B2: achievement evaluation, run after sessions and at midnight. */
  achievements?: { evaluate(now: number): Promise<void> };
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
    if (name.startsWith(TASK_REMINDER_ALARM_PREFIX)) {
      if (!dependencies.tasks) return false;
      await runEffect("task-reminder", () =>
        dependencies.tasks!.handleReminderAlarm(name),
      );
      return true;
    }
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
        if (dependencies.reflection) {
          await runEffect("end-of-day-reflection", () =>
            dependencies.reflection!.notifyEndOfDay(dependencies.now()),
          );
        }
        if (dependencies.achievements) {
          await runEffect("achievements", () =>
            dependencies.achievements!.evaluate(dependencies.now()),
          );
        }
        if (dependencies.tasks) {
          await runEffect("task-alarm-reconcile", () =>
            dependencies.tasks!.reconcile(),
          );
        }
        await runEffect("reconcile", () =>
          dependencies.reconcile("midnight"),
        );
        break;
    }
    return true;
  };
}
