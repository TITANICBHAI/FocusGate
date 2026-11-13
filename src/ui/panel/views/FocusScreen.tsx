import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { CalendarPlus } from "lucide-react";
import { computeBlockPlan, isBlockingActive } from "../../../shared/plan.ts";
import { isScheduleActiveAt } from "../../../shared/time.ts";
import {
  taskDurationForStart,
  taskWindowEnd,
  taskWindowStart,
} from "../../../shared/taskScheduling.ts";
import { buildDoneCard, shouldChime } from "../../../shared/celebration.ts";
import { calculateStreaks, dayGoalProgress, stoppedEarlyText } from "../../../shared/stats.ts";
import type { AppState, LockLevel } from "../../../shared/types.ts";
import {
  Button,
  Card,
  Chip,
  EmptyState,
  Field,
  HeroTimer,
  InfoButton,
  InfoNote,
  ListRow,
  Progress,
  Segmented,
  Stat,
} from "../../components/primitives.tsx";
import type { InfoState } from "../../components/primitives.tsx";
import { DoneCardView } from "../../components/DoneCard.tsx";
import { Modal, useToast } from "../../components/feedback.tsx";
import { useHiddenHints } from "../../hooks/useHiddenHints.ts";
import { useStrictPassword } from "../../hooks/useStrictPassword.tsx";
import { sendSessionMessage } from "../../lib/sessionActions.ts";
import { BlockNow } from "./BlockNow.tsx";
import { blockScopeSummary } from "../../lib/blockSummary.ts";
import { playChime } from "../../lib/chime.ts";
import { markDoneChimed, markDoneDismissed, readDoneSeen } from "../../lib/doneSeen.ts";
import { STOP_EARLY_NOTICE } from "../../lib/stopNotice.ts";

const DURATION_PRESETS = [15, 25, 45, 60, 90] as const;
const SESSION_EXTENSIONS = [10, 15, 20, 30, 45, 60] as const;
const LOCK_OPTIONS = [
  { value: "none", label: "None" },
  { value: "strict", label: "Strict" },
  { value: "commitment", label: "Commit" },
] as const;

const LOCK_SUMMARY: Record<Exclude<LockLevel, "strict">, string> = {
  none: "You can stop any time with a confirmation.",
  commitment:
    "There is no early-stop action. You can still disable or remove the extension.",
};

const REMOVAL_RULE: Record<LockLevel, string> = {
  none: "You can add, change or remove rules at any time.",
  strict: "You can add rules, but not remove or relax them until the session ends.",
  commitment: "You can add rules, but not remove or relax them until the session ends.",
};

/** The Strict stop sentence, shared by the lock hint and the stop dialog. */
export function strictStopSummary(hasPassword: boolean): string {
  return hasPassword
    ? "Stopping early needs your password. You can still disable or remove the extension."
    : "Stopping early needs the phrase “I GIVE UP” and a 15-second wait. You can still disable or remove the extension.";
}

/**
 * What the chosen lock means. Only the chosen one is shown, so the person is
 * not asked to read three paragraphs, and it can be hidden for good.
 */
export function LockHint({
  level,
  hasPassword,
  info,
  onHide,
}: {
  level: LockLevel;
  hasPassword: boolean;
  info: InfoState;
  onHide(): void;
}) {
  const label = LOCK_OPTIONS.find((option) => option.value === level)?.label ?? level;
  const stopRule = level === "strict" ? strictStopSummary(hasPassword) : LOCK_SUMMARY[level];
  return (
    <InfoNote info={info} onDismiss={onHide} dismissLabel="Hide this hint">
      <strong>{label}.</strong> {`${stopRule} ${REMOVAL_RULE[level]}`}
    </InfoNote>
  );
}

function localDateKeyOf(value: number): string {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

/**
 * P3 Focus screen (design.md §5.2). All session/standalone/task logic is
 * reused from the former popup FocusView — only the layout is new.
 */
export function FocusScreen({
  state,
  onOpenRules,
  onOpenTasks,
  density = "narrow",
}: {
  state: AppState;
  onOpenRules(): void;
  onOpenTasks(): void;
  density?: "narrow" | "wide";
}) {
  const showToast = useToast();
  const [now, setNow] = useState(() => Date.now());
  const [durationEditing, setDurationEditing] = useState(false);
  const [durationText, setDurationText] = useState(
    String(state.settings.defaultDurationMin || 25),
  );
  const [durationError, setDurationError] = useState("");
  const [lockLevel, setLockLevel] = useState<LockLevel>("none");
  const hints = useHiddenHints();
  const strictPassword = useStrictPassword(state.password !== null);
  const lockHintId = useId();
  const lockHintKey = `lock-${lockLevel}`;
  const lockInfo: InfoState = {
    open: !hints.isHidden(lockHintKey),
    id: lockHintId,
    toggle: () => hints.setHidden(lockHintKey, !hints.isHidden(lockHintKey)),
  };
  const [stopOpen, setStopOpen] = useState(false);
  const [stopCredential, setStopCredential] = useState("");
  const [waitReady, setWaitReady] = useState(true);
  const waitTimer = useRef<number | null>(null);

  useEffect(() => {
    const timer = window.setInterval(
      () => setNow(Date.now()),
      state.session.status === "idle" ? 30_000 : 1_000,
    );
    return () => window.clearInterval(timer);
  }, [state.session.status]);

  useEffect(() => {
    setDurationText(String(state.settings.defaultDurationMin || 25));
  }, [state.settings.defaultDurationMin]);

  useEffect(
    () => () => {
      if (waitTimer.current !== null) window.clearTimeout(waitTimer.current);
    },
    [],
  );

  const isRunning = state.session.status !== "idle";
  const isBreak =
    state.session.status === "shortBreak" ||
    state.session.status === "longBreak";
  const atTime = Date.now();
  const standaloneActive =
    state.standalone.active &&
    state.standalone.startsAt <= atTime &&
    atTime < state.standalone.until;

  const stateForFocus =
    state.session.status === "idle"
      ? {
          ...state,
          session: {
            ...state.session,
            status: "work" as const,
            phaseEndsAt: now + (Number(durationText) || 25) * 60_000,
          },
        }
      : state;
  const plan = computeBlockPlan(stateForFocus, now);
  const canBlockAnything = isBlockingActive(stateForFocus, now);

  const todayKey = localDateKeyOf(now);
  const linkedTask =
    state.session.status !== "idle" && state.session.taskId
      ? state.tasks.find((task) => task.id === state.session.taskId)
      : undefined;
  const nextTodayTask = state.tasks
    .filter((task) => !task.completed && task.scheduledDate === todayKey)
    .filter((task) => {
      const end = taskWindowEnd(task);
      return end !== null && end > now;
    })
    .sort(
      (left, right) =>
        (taskWindowStart(left) ?? Number.MAX_SAFE_INTEGER) -
        (taskWindowStart(right) ?? Number.MAX_SAFE_INTEGER),
    )[0];
  const focusTask = linkedTask ?? nextTodayTask;
  const hasPassword = state.password !== null;

  const today = state.dayStats[todayKey];
  const streaks = calculateStreaks(state.sessionHistory, new Date(now));
  const goalPct = dayGoalProgress(today, state.settings.dailyGoalMin);
  const stoppedLine = stoppedEarlyText(today);

  // The card for the session that just ended. It rings the chime once, when it
  // is fresh and the setting is on, and stays until it is dismissed.
  const [doneSeen, setDoneSeen] = useState(() => readDoneSeen());
  const card = buildDoneCard(state, now);
  const showDoneCard = card !== null && doneSeen.dismissed !== card.recordId;
  const chimeEnabled = state.settings.notifications.chime;
  useEffect(() => {
    if (!card || card.kind !== "completed") return;
    const ring = shouldChime({
      enabled: chimeEnabled,
      recordId: card.recordId,
      endedAt: card.endedAt,
      now: Date.now(),
      chimedId: readDoneSeen().chimed,
    });
    if (!ring) return;
    setDoneSeen(markDoneChimed(card.recordId));
    playChime();
  }, [card?.recordId, card?.kind, card?.endedAt, chimeEnabled]);

  const closeStopDialog = useCallback(() => {
    setStopOpen(false);
    setStopCredential("");
    setWaitReady(true);
    if (waitTimer.current !== null) {
      window.clearTimeout(waitTimer.current);
      waitTimer.current = null;
    }
  }, []);

  function validDuration(): number | null {
    const minutes = Number(durationText.trim());
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 999) {
      setDurationError("Enter a whole number from 1 to 999 minutes.");
      return null;
    }
    setDurationError("");
    setDurationText(String(minutes));
    return minutes;
  }

  function commitDurationEdit(): void {
    setDurationEditing(false);
    validDuration();
  }

  async function startFocus(): Promise<void> {
    if (!canBlockAnything) {
      showToast("Nothing is set to block yet. Add sites or rules first.", "info");
      onOpenRules();
      return;
    }
    const durationMin = validDuration();
    if (durationMin === null) return;
    if (!(await strictPassword.ask(lockLevel))) return;
    const reply = await sendSessionMessage({
      type: "session/start",
      durationMin,
      lockLevel,
    });
    if (!reply.ok) {
      showToast(reply.message ?? "The session could not be started.", "error");
      return;
    }
    showToast("Focus session started.", "success");
  }

  async function startScheduledTask(): Promise<void> {
    if (!focusTask) return;
    if (state.session.status !== "idle") {
      showToast("End the current session before starting a task.", "info");
      return;
    }
    if (!(await strictPassword.ask(focusTask.lockLevel))) return;
    const reply = await sendSessionMessage({
      type: "session/start",
      durationMin: taskDurationForStart(focusTask, Date.now()),
      lockLevel: focusTask.lockLevel,
      taskId: focusTask.id,
    });
    if (!reply.ok) {
      showToast(reply.message ?? "This task could not be started.", "error");
      return;
    }
    showToast("Task session started.", "success");
  }

  async function submitStop(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message =
      state.session.lockLevel === "none"
        ? { type: "session/stop" as const }
        : hasPassword
          ? { type: "session/stop" as const, password: stopCredential }
          : { type: "session/stop" as const, phrase: stopCredential };
    const reply = await sendSessionMessage(message);
    if (reply.ok) {
      closeStopDialog();
      showToast("Focus session ended.", "success");
      return;
    }
    if (reply.code === "WAIT_REQUIRED" && reply.waitMs && reply.waitMs > 0) {
      setWaitReady(false);
      showToast(reply.message ?? "Wait before confirming the stop.", "info");
      if (waitTimer.current !== null) window.clearTimeout(waitTimer.current);
      waitTimer.current = window.setTimeout(() => {
        setWaitReady(true);
        waitTimer.current = null;
      }, reply.waitMs);
      return;
    }
    showToast(reply.message ?? "The session could not be stopped.", "error");
  }

  async function extendSession(minutes: number): Promise<void> {
    const reply = await sendSessionMessage({
      type: "session/extend",
      minutes,
    });
    if (!reply.ok) {
      showToast(reply.message ?? "Could not extend.", "error");
      return;
    }
    showToast(`Added ${minutes} minutes.`, "success");
  }

  async function skipBreak(): Promise<void> {
    const reply = await sendSessionMessage({ type: "session/skipBreak" });
    if (!reply.ok) {
      showToast(reply.message ?? "Could not skip the break.", "error");
    }
  }

  /* ---------------- hero state derivation ---------------- */

  let heroLabel = "Focus session";
  let heroSeconds: number;
  let heroMeta: ReactNode;
  let heroProgress: number | undefined;
  let heroTone: "accent" | "break" | "warn" = "accent";
  let heroChip: ReactNode;

  if (state.session.status === "work") {
    heroLabel = "Focus";
    heroSeconds = Math.max(
      0,
      Math.ceil((state.session.phaseEndsAt - now) / 1_000),
    );
    heroProgress =
      state.session.phasePlannedMs > 0
        ? Math.max(
            0,
            (state.session.phaseEndsAt - now) / state.session.phasePlannedMs,
          )
        : undefined;
    heroMeta = `Ends ${new Date(state.session.phaseEndsAt).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    })}`;
    heroChip =
      state.session.lockLevel !== "none" ? (
        <Chip tone="warning">
          {state.session.lockLevel === "commitment" ? "Commit" : "Strict"}
        </Chip>
      ) : undefined;
  } else if (isBreak) {
    heroLabel = "Break";
    heroTone = "break";
    heroSeconds = Math.max(0, Math.ceil((state.session.phaseEndsAt - now) / 1_000));
    heroMeta = `Ends ${new Date(state.session.phaseEndsAt).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    })}`;
  } else if (standaloneActive) {
    heroLabel = "Block now — no early stop";
    heroTone = "warn";
    heroSeconds = Math.max(0, Math.ceil((state.standalone.until - now) / 1_000));
    heroMeta = `Ends ${new Date(state.standalone.until).toLocaleString([], {
      dateStyle: "medium",
      timeStyle: "short",
    })}`;
  } else {
    heroSeconds = (Number(durationText) || 25) * 60;
  }

  const activeScheduleCount = state.schedules.filter((schedule) =>
    isScheduleActiveAt(schedule, new Date(now)),
  ).length;
  const summaryText = blockScopeSummary(
    plan.blocked.size,
    plan.keywords.length,
    activeScheduleCount,
  );

  /* ---------------- render ---------------- */

  return (
    <div className="fg-stack">
      {card && showDoneCard && (
        <DoneCardView
          card={card}
          onDismiss={() => setDoneSeen(markDoneDismissed(card.recordId))}
        />
      )}
      <HeroTimer
        label={heroLabel}
        seconds={heroSeconds}
        meta={heroMeta}
        progress={heroProgress}
        tone={heroTone}
        chip={heroChip}
        editable={!isRunning && !standaloneActive}
        onEditStart={() => setDurationEditing(true)}
      />

      {!isRunning && !standaloneActive && (
        <>
          {durationEditing ? (
            <Field
              id="focus-duration"
              label="Session length (minutes)"
              helper="Enter a whole number from 1 to 999."
              error={durationError}
            >
              <input
                id="focus-duration"
                className="fg-input"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={durationText}
                autoFocus
                onChange={(event) => setDurationText(event.target.value)}
                onBlur={commitDurationEdit}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    commitDurationEdit();
                  }
                }}
              />
            </Field>
          ) : null}
          <div className="fg-wrap" role="group" aria-label="Duration presets">
            {DURATION_PRESETS.map((minutes) => (
              <Button
                key={minutes}
                size="dense"
                onClick={() => {
                  setDurationText(String(minutes));
                  setDurationError("");
                }}
              >
                {minutes} min
              </Button>
            ))}
          </div>
          <Segmented
            label="Session lock"
            options={LOCK_OPTIONS}
            value={lockLevel}
            onChange={setLockLevel}
            labelAction={<InfoButton label="What does this lock do?" info={lockInfo} />}
          />
          <LockHint
            level={lockLevel}
            hasPassword={hasPassword}
            info={lockInfo}
            onHide={() => hints.setHidden(lockHintKey, true)}
          />
          <Button
            variant="primary"
            size="jumbo"
            wide
            onClick={() => void startFocus()}
          >
            Start focus
          </Button>
          <p className="fg-hero__meta">
            {canBlockAnything ? (
              summaryText
            ) : (
              <Button variant="secondary" size="dense" onClick={onOpenRules}>
                Add sites
              </Button>
            )}
          </p>
        </>
      )}

      {isRunning && state.session.status === "work" && (
        <>
          <div className="fg-wrap" role="group" aria-label="Extend session">
            {SESSION_EXTENSIONS.map((minutes) => (
              <Button
                key={minutes}
                variant="secondary"
                size="dense"
                onClick={() => void extendSession(minutes)}
              >
                +{minutes} min
              </Button>
            ))}
          </div>
          {state.session.lockLevel !== "commitment" && (
            <Button
              variant="danger-quiet"
              onClick={() => {
                setWaitReady(true);
                setStopOpen(true);
              }}
            >
              Stop session…
            </Button>
          )}
          {state.session.lockLevel === "commitment" && (
            <p className="fg-hero__meta">
              This session has no early-stop action. It ends when the timer does.
            </p>
          )}
        </>
      )}

      {isBreak && (
        <Button variant="secondary" onClick={() => void skipBreak()}>
          Skip break
        </Button>
      )}

      <Card title="Today">
        <div className="fg-stat-row">
          <Stat
            label="Focused"
            value={`${Math.round((today?.focusMs ?? 0) / 60_000)}m`}
          />
          <Stat label="Goal" value={`${Math.round(goalPct * 100)}%`} />
          <Stat label="Streak" value={`${streaks.current}d`} />
        </div>
        <div className="fg-hero__progress">
          <Progress value={goalPct} label="Daily goal" />
        </div>
        {stoppedLine && <p className="fg-hero__meta">{stoppedLine}</p>}
      </Card>

      <Card
        title="Up next"
        actions={
          <Button variant="quiet" size="dense" onClick={onOpenTasks}>
            Add task
          </Button>
        }
      >
        {focusTask ? (
          <ListRow
            title={focusTask.title}
            sub={
              taskWindowStart(focusTask) !== null &&
              taskWindowEnd(focusTask) !== null
                ? `${new Date(taskWindowStart(focusTask)!).toLocaleTimeString([], {
                    hour: "numeric",
                    minute: "2-digit",
                  })} – ${new Date(taskWindowEnd(focusTask)!).toLocaleTimeString([], {
                    hour: "numeric",
                    minute: "2-digit",
                  })}`
                : `${focusTask.durationMin} min`
            }
            actions={
              !linkedTask && (
                <Button
                  variant="secondary"
                  size="dense"
                  onClick={() => void startScheduledTask()}
                >
                  Start
                </Button>
              )
            }
          />
        ) : (
          <EmptyState
            icon={<CalendarPlus aria-hidden="true" />}
            title="Nothing scheduled"
            description="Add a task to plan your next focus session."
          />
        )}
      </Card>

      <BlockNow state={state} canStart={!isRunning} />

      <Modal
        open={stopOpen}
        title="End this session?"
        description={
          state.session.lockLevel === "strict"
            ? "This action is checked by FocusGate before the session ends."
            : "Blocking will stop when this session ends."
        }
        onClose={closeStopDialog}
        actions={
          <>
            <Button variant="secondary" onClick={closeStopDialog}>
              Keep focusing
            </Button>
            <Button
              variant="danger"
              type="submit"
              form="stop-session-form"
              disabled={!waitReady}
            >
              {waitReady ? "Confirm stop" : "Wait before confirming"}
            </Button>
          </>
        }
      >
        <form id="stop-session-form" className="fg-stack" onSubmit={submitStop}>
          <p className="fg-card__desc">{STOP_EARLY_NOTICE}</p>
          {state.session.lockLevel !== "none" && (
            <Field
              id="stop-credential"
              label={hasPassword ? "Password" : "Type I GIVE UP"}
              helper={
                waitReady
                  ? undefined
                  : "Wait 15 seconds, then confirm this action again."
              }
            >
              <input
                id="stop-credential"
                className="fg-input"
                type={hasPassword ? "password" : "text"}
                autoComplete={hasPassword ? "current-password" : "off"}
                value={stopCredential}
                onChange={(event) => setStopCredential(event.target.value)}
                required
              />
            </Field>
          )}
        </form>
      </Modal>

      {strictPassword.sheet}

      {/* density is applied by the host surface; kept for the shared-view rule */}
      <span hidden data-density={density} />
    </div>
  );
}
