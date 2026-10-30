import { allowanceAlertUpdates } from "../shared/allowanceAlerts.ts";
import type { AppState } from "../shared/types.ts";
import type { SessionNotice } from "./notify.ts";

export interface AllowanceAlertServiceDependencies {
  store: {
    readState(): Promise<AppState>;
    writeState(patch: Partial<AppState>): Promise<void>;
  };
  notify(notice: SessionNotice): Promise<void>;
  now(): number;
  onError?(error: unknown): void;
}

export interface AllowanceAlertService {
  /** WP7-B7: fire heads-up/exhaustion alerts once per budget window. */
  evaluate(): Promise<void>;
}

/**
 * Staged WP7-B7 service: the flags are stored before the notifications so a
 * worker crash cannot announce the same budget threshold twice.
 */
export function createAllowanceAlertService(
  dependencies: AllowanceAlertServiceDependencies,
): AllowanceAlertService {
  return {
    async evaluate() {
      let state: AppState;
      try {
        state = await dependencies.store.readState();
      } catch (error) {
        dependencies.onError?.(error);
        return;
      }

      if (!state.settings.notifications.allowanceAlerts) return;
      const outcome = allowanceAlertUpdates(
        state.allowances,
        state.usage,
        dependencies.now(),
      );
      if (!outcome.changed) return;

      try {
        await dependencies.store.writeState({ usage: outcome.usage });
      } catch (error) {
        dependencies.onError?.(error);
        return;
      }

      for (const alert of outcome.alerts) {
        const notice: SessionNotice =
          alert.kind === "heads-up"
            ? {
                kind: "allowance_heads_up",
                domain: alert.domain,
                minutesLeft: alert.minutesLeft ?? 0,
              }
            : {
                kind: "allowance_exhausted",
                domain: alert.domain,
                resetsAt: alert.resetsAt ?? 0,
              };
        try {
          await dependencies.notify(notice);
        } catch (error) {
          dependencies.onError?.(error);
        }
      }
    },
  };
}
