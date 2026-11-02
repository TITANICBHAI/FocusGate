import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { CalendarPlus, ShieldX } from "lucide-react";
import { normalizeDomain } from "../../../shared/domains.ts";
import { sessionDebrief } from "../../../shared/debrief.ts";
import { computeBlockPlan, isBlockingActive } from "../../../shared/plan.ts";
import { isScheduleActiveAt } from "../../../shared/time.ts";
import {
  taskDurationForStart,
  taskWindowEnd,
  taskWindowStart,
} from "../../../shared/taskScheduling.ts";
import { calculateStreaks } from "../../../shared/stats.ts";
import type { AppState, LockLevel } from "../../../shared/types.ts";
import {
  fromLocalDateTimeInput,
  isValidStandaloneExpiry,
  STANDALONE_ACKNOWLEDGEMENT_MS,
  toLocalDateTimeInput,
} from "../../../shared/standalone.ts";
import {
  Button,
  Card,
  Chip,
  Field,
  HeroTimer,
  ListRow,
  Progress,
  Segmented,
  Sheet,
  Stat,
} from "../../components/primitives.tsx";
import { Modal, useToast } from "../../components/feedback.tsx";
import { sendSessionMessage } from "../../lib/sessionActions.ts";
import { sendStandaloneMessage } from "../../lib/standaloneActions.ts";
import { blockScopeSummary } from "../../lib/blockSummary.ts";

const DURATION_PRESETS = [15, 25, 45, 60, 90] as const;
const STANDALONE_EXPIRY_PRESETS = [
  { label: "+30 min", minutes: 30 },
  { label: "+1 hour", minutes: 60 },
  { label: "+4 hours", minutes: 240 },
  { label: "+24 hours", minutes: 1_440 },
] as const;
const SESSION_EXTENSIONS = [10, 15, 20, 30, 45, 60] as const;
const STANDALONE_EXTENSIONS = [15, 30, 60, 120] as const;
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

function standaloneSiteEntries(value: string): string[] {
  return value
    .split(/[,\n]/)
    .map((site) => site.trim())
    .filter(Boolean);
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
  const [stopOpen, setStopOpen] = useState(false);
  const [stopCredential, setStopCredential] = useState("");
  const [waitReady, setWaitReady] = useState(true);
  const waitTimer = useRef<number | null>(null);
  const [standaloneSheetOpen, setStandaloneSheetOpen] = useState(false);
  const [standaloneUntilText, setStandaloneUntilText] = useState(() =>
    toLocalDateTimeInput(Date.now() + 60 * 60_000),
  );
  const [standaloneLongAcknowledged, setStandaloneLongAcknowledged] =
    useState(false);
  const [standaloneSitesText, setStandaloneSitesText] = useState("");
  const [standaloneSiteInput, setStandaloneSiteInput] = useState("");
  const [standaloneError, setStandaloneError] = useState("");

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
  const goalMs = Math.max(1, state.settings.dailyGoalMin) * 60_000;
  const goalPct = Math.min(1, (today?.focusMs ?? 0) / goalMs);

  const standaloneUntil = fromLocalDateTimeInput(standaloneUntilText);
  const standaloneEntries = useMemo(
    () => standaloneSiteEntries(standaloneSitesText),
    [standaloneSitesText],
  );
  const standalonePreviewSites = useMemo(
    () => [
      ...new Set(
        standaloneEntries
          .map(normalizeDomain)
          .filter((site): site is string => site !== null),
      ),
    ],
    [standaloneEntries],
  );
  const standaloneUntilDelta =
    standaloneUntil === null ? 0 : standaloneUntil - Date.now();

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

  async function startStandalone(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const at = Date.now();
    const until = fromLocalDateTimeInput(standaloneUntilText);
    if (until === null || !isValidStandaloneExpiry(until, at)) {
      setStandaloneError("Choose an end time from 5 minutes to 30 days from now.");
      return;
    }
    if (standaloneEntries.length === 0) {
      setStandaloneError("Add at least one website to block.");
      return;
    }
    if (standalonePreviewSites.length > 500) {
      setStandaloneError("A standalone block can contain at most 500 sites.");
      return;
    }
    if (
      until - at > STANDALONE_ACKNOWLEDGEMENT_MS &&
      !standaloneLongAcknowledged
    ) {
      setStandaloneError(
        "Confirm that you understand this block has no early stop.",
      );
      return;
    }
    const reply = await sendStandaloneMessage({
      type: "standalone/start",
      until,
      sites: standalonePreviewSites,
    });
    if (!reply.ok) {
      setStandaloneError(reply.message ?? "The block could not be started.");
      return;
    }
    setStandaloneError("");
    setStandaloneSheetOpen(false);
    setStandaloneSitesText("");
    setStandaloneLongAcknowledged(false);
    showToast("Standalone block started.", "success");
    if (reply.warning) showToast(reply.warning, "error");
  }

  async function extendStandalone(minutes: number): Promise<void> {
    const reply = await sendStandaloneMessage({
      type: "standalone/extend",
      minutes,
    });
    if (!reply.ok) {
      showToast(reply.message ?? "The block could not be extended.", "error");
      return;
    }
    showToast(`Block extended by ${minutes} minutes.`, "success");
    if (reply.warning) showToast(reply.warning, "error");
  }

  async function addStandaloneSite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const site = standaloneSiteInput.trim();
    if (!site) {
      setStandaloneError("Enter a website to add.");
      return;
    }
    const reply = await sendStandaloneMessage({
      type: "standalone/addSites",
      sites: [site],
    });
    if (!reply.ok) {
      setStandaloneError(reply.message ?? "The site could not be added.");
      return;
    }
    setStandaloneSiteInput("");
    setStandaloneError("");
    showToast("Site added to the active block.", "success");
    if (reply.warning) showToast(reply.warning, "error");
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
        <Chip tone="lock">
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

  const latestCompleted = [...state.sessionHistory]
    .filter((record) => record.status === "completed")
    .sort((left, right) => right.endedAt - left.endedAt)[0];
  const debrief =
    latestCompleted !== undefined && now - latestCompleted.endedAt < 60 * 60_000
      ? sessionDebrief(latestCompleted)
      : null;

  /* ---------------- render ---------------- */

  return (
    <div className="fg-stack">
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
          />
          <p className="fg-hero__meta">
            {lockLevel === "strict"
              ? hasPassword
                ? "Stopping early needs your password. You can still disable or remove the extension."
                : "Stopping early needs the phrase “I GIVE UP” and a 15-second wait. You can still disable or remove the extension."
              : LOCK_SUMMARY[lockLevel]}
          </p>
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
              <Button variant="quiet" onClick={onOpenRules}>
                Nothing is blocked yet — add sites in Rules.
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

      {debrief && (
        <Card title="Session debrief">
          <p className="fg-card__desc">{debrief.headline}</p>
          {debrief.pace && <p className="fg-card__desc">{debrief.pace}</p>}
        </Card>
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
          <Progress value={goalPct} />
        </div>
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
          <Button variant="quiet" onClick={onOpenTasks}>
            <CalendarPlus aria-hidden="true" style={{ width: 24, height: 24 }} />
            Nothing scheduled — add a task.
          </Button>
        )}
      </Card>

      {standaloneActive ? (
        <Card title="Block now">
          <ListRow
            title={`${state.standalone.sites.length} site${
              state.standalone.sites.length === 1 ? "" : "s"
            } blocked`}
            sub={`Ends ${new Date(state.standalone.until).toLocaleTimeString([], {
              hour: "numeric",
              minute: "2-digit",
            })}`}
          />
          <form
            className="fg-wrap"
            onSubmit={(event) => void addStandaloneSite(event)}
          >
            <input
              className="fg-input"
              style={{ flex: 1 }}
              value={standaloneSiteInput}
              placeholder="Add a site to this block"
              aria-label="Add a site to this block"
              onChange={(event) => setStandaloneSiteInput(event.target.value)}
            />
            <Button variant="secondary" size="dense" type="submit">
              Add
            </Button>
          </form>
          <div className="fg-wrap" role="group" aria-label="Extend block">
            {STANDALONE_EXTENSIONS.map((minutes) => (
              <Button
                key={minutes}
                variant="secondary"
                size="dense"
                onClick={() => void extendStandalone(minutes)}
              >
                +{minutes < 60 ? `${minutes} min` : `${minutes / 60} h`}
              </Button>
            ))}
          </div>
        </Card>
      ) : (
        !isRunning && (
          <Card title="Block now">
            <ListRow
              swatch={<ShieldX aria-hidden="true" style={{ width: 16, height: 16 }} />}
              title="Timed block with no early stop"
              sub="Block selected sites without starting a focus session."
              actions={
                <Button
                  variant="secondary"
                  size="dense"
                  onClick={() => {
                    setStandaloneError("");
                    setStandaloneUntilText(
                      toLocalDateTimeInput(Date.now() + 60 * 60_000),
                    );
                    setStandaloneLongAcknowledged(false);
                    setStandaloneSitesText("");
                    setStandaloneSheetOpen(true);
                  }}
                >
                  Set up…
                </Button>
              }
            />
          </Card>
        )
      )}

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

      <Sheet
        open={standaloneSheetOpen}
        title="Block now"
        onClose={() => setStandaloneSheetOpen(false)}
        footer={
          <Button
            variant="primary"
            wide
            type="submit"
            form="standalone-start-form"
          >
            Confirm and start
          </Button>
        }
      >
        <form
          id="standalone-start-form"
          className="fg-stack"
          onSubmit={startStandalone}
        >
          <Field
            id="standalone-until"
            label="End date and time"
            helper="Choose an end time from 5 minutes to 30 days from now. There is no early stop; you can extend or add sites."
            error={standaloneError || undefined}
          >
            <div className="fg-wrap" role="group" aria-label="End time presets">
              {STANDALONE_EXPIRY_PRESETS.map((preset) => (
                <Button
                  key={preset.minutes}
                  variant="secondary"
                  size="dense"
                  onClick={() => {
                    setStandaloneUntilText(
                      toLocalDateTimeInput(Date.now() + preset.minutes * 60_000),
                    );
                    setStandaloneLongAcknowledged(false);
                    setStandaloneError("");
                  }}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
            <input
              id="standalone-until"
              className="fg-input"
              type="datetime-local"
              value={standaloneUntilText}
              onChange={(event) => {
                setStandaloneUntilText(event.target.value);
                setStandaloneLongAcknowledged(false);
                setStandaloneError("");
              }}
            />
          </Field>
          <Field
            id="standalone-sites"
            label="Sites to block"
            helper="Domains or URLs, one per line or comma-separated (up to 500)."
          >
            <textarea
              id="standalone-sites"
              className="fg-textarea"
              rows={4}
              value={standaloneSitesText}
              placeholder={"example.com\nreddit.com"}
              onChange={(event) => setStandaloneSitesText(event.target.value)}
            />
          </Field>
          {standaloneUntilDelta > STANDALONE_ACKNOWLEDGEMENT_MS && (
            <label className="fg-field">
              <span className="fg-field__label">
                <input
                  type="checkbox"
                  checked={standaloneLongAcknowledged}
                  onChange={(event) =>
                    setStandaloneLongAcknowledged(event.target.checked)
                  }
                  style={{ marginRight: 8 }}
                />
                I understand this block lasts over 24 hours and has no early-stop
                action.
              </span>
            </label>
          )}
        </form>
      </Sheet>

      {/* density is applied by the host surface; kept for the shared-view rule */}
      <span hidden data-density={density} />
    </div>
  );
}
