import { applyBackup, parseBackupJson } from "../shared/backup.ts";
import { createDefaultState } from "../shared/defaults.ts";
import { RESET_CONFIRMATION_PHRASE } from "../shared/dataActions.ts";
import { guard } from "../shared/gating.ts";
import type { AppState, PasswordState } from "../shared/types.ts";

export interface DataActionResult {
  ok: boolean;
  code?: string;
  message?: string;
  mode?: "merge" | "restore" | "reset";
  added?: string[];
  skipped?: string[];
  warning?: string;
}

export interface DataActionService {
  importBackup(json: string): Promise<DataActionResult>;
  resetData(input: {
    confirm: string;
    password?: string;
  }): Promise<DataActionResult>;
}

export interface DataActionStore {
  readState(): Promise<AppState>;
  writeState(patch: Partial<AppState>): Promise<void>;
}

export interface DataActionDependencies {
  store: DataActionStore;
  now(): number;
  verifyPassword(
    input: string,
    stored: PasswordState,
  ): Promise<{ valid: boolean }>;
  afterChange?(): Promise<unknown>;
}

function guardState(state: AppState, now: number) {
  return {
    session: state.session,
    standalone: state.standalone,
    hasPassword: state.password !== null,
    now,
  };
}

function rejected(code: string, message: string): DataActionResult {
  return { ok: false, code, message };
}

export function createDataActionService(
  dependencies: DataActionDependencies,
): DataActionService {
  let queue = Promise.resolve();
  async function exclusive<T>(operation: () => Promise<T>): Promise<T> {
    const next = queue.then(operation, operation);
    queue = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }

  async function refreshAfterWrite(): Promise<string | undefined> {
    try {
      await dependencies.afterChange?.();
      return undefined;
    } catch {
      return "Data was saved, but browser protection could not be refreshed. Check Protection status.";
    }
  }

  return {
    importBackup: (json) =>
      exclusive(async () => {
        const parsed = parseBackupJson(json);
        if (!parsed.ok) return rejected("INVALID_BACKUP", parsed.error);

        const current = await dependencies.store.readState();
        const decision = guard(
          "import_backup",
          guardState(current, dependencies.now()),
        );
        if (decision.result === "locked") {
          return rejected("LOCKED", decision.reason);
        }
        const merged = applyBackup(current, parsed.backup);
        try {
          await dependencies.store.writeState(merged.state);
        } catch {
          return rejected("SAVE_FAILED", "The backup could not be applied.");
        }
        return {
          ok: true,
          mode: merged.report.mode,
          added: merged.report.added,
          skipped: merged.report.skipped,
          warning: await refreshAfterWrite(),
        };
      }),

    resetData: (input) =>
      exclusive(async () => {
        const current = await dependencies.store.readState();
        const now = dependencies.now();
        const decision = guard("reset_data", guardState(current, now));
        if (decision.result === "locked") {
          return rejected("LOCKED", decision.reason);
        }
        if (input.confirm !== RESET_CONFIRMATION_PHRASE) {
          return rejected(
            "CONFIRMATION_REQUIRED",
            `Type “${RESET_CONFIRMATION_PHRASE}” to reset all data.`,
          );
        }
        if (decision.result === "password") {
          if (!input.password) {
            return rejected("PASSWORD_REQUIRED", "Enter your current password to reset data.");
          }
          const verification = await dependencies.verifyPassword(
            input.password,
            current.password,
          );
          if (!verification.valid) {
            return rejected("BAD_PASSWORD", "That password did not match.");
          }
        }

        const latest = await dependencies.store.readState();
        if (JSON.stringify(latest) !== JSON.stringify(current)) {
          return rejected(
            "STATE_CHANGED",
            "FocusGate changed while confirming. Review the current state and try again.",
          );
        }
        const latestDecision = guard(
          "reset_data",
          guardState(latest, dependencies.now()),
        );
        if (latestDecision.result === "locked") {
          return rejected("LOCKED", latestDecision.reason);
        }
        if (
          latestDecision.result === "password" &&
          !input.password
        ) {
          return rejected("PASSWORD_REQUIRED", "Enter your current password to reset data.");
        }
        if (latestDecision.result === "password" && input.password) {
          const verification = await dependencies.verifyPassword(
            input.password,
            latest.password,
          );
          if (!verification.valid) {
            return rejected("BAD_PASSWORD", "That password did not match.");
          }
        }

        try {
          await dependencies.store.writeState(createDefaultState());
        } catch {
          return rejected("RESET_FAILED", "FocusGate could not reset the data.");
        }
        return {
          ok: true,
          mode: "reset",
          added: [],
          skipped: [],
          warning: await refreshAfterWrite(),
        };
      }),
  };
}
