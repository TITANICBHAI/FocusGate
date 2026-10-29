import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { normalizeDomain } from "../../shared/domains.ts";
import { computeBlockPlan, isBlockingActive } from "../../shared/plan.ts";
import { isScheduleActiveAt } from "../../shared/time.ts";
import {
  taskDurationForStart,
  taskWindowEnd,
  taskWindowStart,
} from "../../shared/taskScheduling.ts";
import type { AppState, LockLevel, SessionState } from "../../shared/types.ts";
import {
  countMatchingStandaloneTabs,
  fromLocalDateTimeInput,
  isValidStandaloneExpiry,
  MAX_STANDALONE_MINUTES,
  MIN_STANDALONE_MINUTES,
  STANDALONE_ACKNOWLEDGEMENT_MS,
  toLocalDateTimeInput,
} from "../../shared/standalone.ts";
import {
  Button,
  Card,
  Field,
  ProgressRing,
  Segmented,
  Toggle,
} from "../components/primitives.tsx";
import { Modal, useToast } from "../components/feedback.tsx";
import { sendSessionMessage } from "../lib/sessionActions.ts";
import { sendStandaloneMessage } from "../lib/standaloneActions.ts";

const DURATION_PRESETS = [15, 25, 45, 60, 90] as const;
const STANDALONE_EXPIRY_PRESETS = [
  { label: "+30 min", minutes: 30 },
  { label: "+1 hour", minutes: 60 },
  { label: "+4 hours", minutes: 240 },
  { label: "+24 hours", minutes: 1_440 },
] as const;
const LOCK_OPTIONS = [
  { value: "none", label: "None" },
  { value: "strict", label: "Strict" },
  { value: "commitment", label: "Commit" },
] as const;
const LOCK_COPY: Record<Exclude<LockLevel, "strict">, string> = {
  none: "You can stop any time with a confirmation.",
  commitment:
    "There is no early-stop action. You can still disable or remove the extension.",
};

function formatTime(seconds: number): string {
  const safe = Math.max(0, seconds);
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(
    safe % 60,
  ).padStart(2, "0")}`;
}

function standaloneSiteEntries(value: string): string[] {
  return value
    .split(/[,\n]/)
    .map((site) => site.trim())
    .filter(Boolean);
}

function formatStandaloneDuration(milliseconds: number): string {
  const totalMinutes = Math.max(0, Math.ceil(milliseconds / 60_000));
  const days = Math.floor(totalMinutes / 1_440);
  const hours = Math.floor((totalMinutes % 1_440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  return `${minutes} min`;
}

function SessionClock({
  session,
  idleDurationMin,
}: {
  session: SessionState;
  idleDurationMin: number;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  const isIdle = session.status === "idle";
  const remainingMs = isIdle
    ? idleDurationMin * 60_000
    : Math.max(0, session.phaseEndsAt - now);
  const plannedMs = isIdle
    ? idleDurationMin * 60_000
    : Math.max(1, session.phasePlannedMs);
  const seconds = Math.ceil(remainingMs / 1_000);
  const phase =
    session.status === "idle"
      ? "Ready when you are"
      : session.status === "work"
        ? `${session.lockLevel === "commitment" ? "Commit" : session.lockLevel} focus`
        : session.status === "longBreak"
          ? "Long break"
          : "Short break";
  const endTime =
    isIdle || session.phaseEndsAt <= 0
      ? null
      : new Date(session.phaseEndsAt).toLocaleTimeString([], {
          hour: "numeric",
          minute: "2-digit",
        });

  return (
    <div className="fg-focus__clock">
      <ProgressRing
        progress={remainingMs / plannedMs}
        label={`${phase}, ${formatTime(seconds)} remaining`}
      >
        <span className="fg-focus__phase">{phase}</span>
        <output className="fg-focus__time" aria-label="Time remaining">
          {formatTime(seconds)}
        </output>
        {endTime && <span className="fg-muted">Ends at {endTime}</span>}
      </ProgressRing>
    </div>
  );
}

function StandaloneCountdown({ until }: { until: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);
  const seconds = Math.max(0, Math.ceil((until - now) / 1_000));
  const remaining =
    seconds >= 86_400
      ? `${Math.floor(seconds / 86_400)}d ${Math.floor(
          (seconds % 86_400) / 3_600,
        )}h`
      : seconds >= 3_600
        ? `${Math.floor(seconds / 3_600)}h ${Math.floor(
            (seconds % 3_600) / 60,
          )}m`
        : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  return (
    <p className="fg-focus__time" aria-live="off">
      {seconds > 0 ? `${remaining} remaining` : "Expiry reached; waiting for browser update"}
    </p>
  );
}

export function FocusView({
  state,
  onOpenRules,
  onOpenTasks,
}: {
  state: AppState;
  onOpenRules: () => void;
  onOpenTasks: () => void;
}) {
  const showToast = useToast();
  const [now, setNow] = useState(() => Date.now());
  const [standaloneStartOpen, setStandaloneStartOpen] = useState(false);
  const [standaloneUntilText, setStandaloneUntilText] = useState(() =>
    toLocalDateTimeInput(Date.now() + 60 * 60_000),
  );
  const [standaloneLongAcknowledged, setStandaloneLongAcknowledged] =
    useState(false);
  const [standaloneSitesText, setStandaloneSitesText] = useState("");
  const [standaloneSiteInput, setStandaloneSiteInput] = useState("");
  const [standaloneExtendMinutes, setStandaloneExtendMinutes] = useState("15");
  const [standaloneError, setStandaloneError] = useState("");
  const [openTabCount, setOpenTabCount] = useState<number | null>(null);
  const [openTabsUnavailable, setOpenTabsUnavailable] = useState(false);
  const [durationText, setDurationText] = useState(
    String(state.settings.defaultDurationMin || 25),
  );
  const [durationError, setDurationError] = useState("");
  const [lockLevel, setLockLevel] = useState<LockLevel>("none");
  const [stopOpen, setStopOpen] = useState(false);
  const [stopCredential, setStopCredential] = useState("");
  const [waitReady, setWaitReady] = useState(true);
  const waitTimer = useRef<number | null>(null);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const isRunning = state.session.status !== "idle";
  const isBreak =
    state.session.status === "shortBreak" ||
    state.session.status === "longBreak";
  const standaloneActive =
    state.standalone.active &&
    state.standalone.startsAt <= Date.now() &&
    Date.now() < state.standalone.until;
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
  const todayKey = `${new Date(now).getFullYear()}-${String(
    new Date(now).getMonth() + 1,
  ).padStart(2, "0")}-${String(new Date(now).getDate()).padStart(2, "0")}`;
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
  const standaloneUntil = fromLocalDateTimeInput(standaloneUntilText);
  const standaloneEntries = useMemo(
    () => standaloneSiteEntries(standaloneSitesText),
    [standaloneSitesText],
  );
  const normalizedStandaloneEntries = useMemo(
    () => standaloneEntries.map(normalizeDomain),
    [standaloneEntries],
  );
  const standalonePreviewSites = useMemo(
    () => [
      ...new Set(
        normalizedStandaloneEntries.filter(
          (site): site is string => site !== null,
        ),
      ),
    ],
    [normalizedStandaloneEntries],
  );
  const standaloneUntilDelta =
    standaloneUntil === null ? 0 : standaloneUntil - Date.now();
  const standaloneNeedsAcknowledgement =
    standaloneUntilDelta > STANDALONE_ACKNOWLEDGEMENT_MS;

  useEffect(() => {
    if (!standaloneStartOpen) return;
    if (standalonePreviewSites.length === 0) {
      setOpenTabCount(0);
      setOpenTabsUnavailable(false);
      return;
    }
    if (typeof chrome === "undefined" || !chrome.tabs?.query) {
      setOpenTabCount(null);
      setOpenTabsUnavailable(true);
      return;
    }

    let cancelled = false;
    setOpenTabCount(null);
    setOpenTabsUnavailable(false);
    void chrome.tabs
      .query({})
      .then((tabs) => {
        if (!cancelled) {
          setOpenTabCount(countMatchingStandaloneTabs(tabs, standalonePreviewSites));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setOpenTabCount(null);
          setOpenTabsUnavailable(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [standaloneStartOpen, standalonePreviewSites]);

  async function startStandalone(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const now = Date.now();
    const until = fromLocalDateTimeInput(standaloneUntilText);
    if (until === null || !isValidStandaloneExpiry(until, now)) {
      setStandaloneError("Choose an end time from 5 minutes to 30 days from now.");
      return;
    }
    if (standaloneEntries.length === 0) {
      setStandaloneError("Add at least one website to block.");
      return;
    }
    if (normalizedStandaloneEntries.some((site) => site === null)) {
      setStandaloneError("Check each site and enter a valid website or URL.");
      return;
    }
    const sites = standalonePreviewSites;
    if (sites.length > 500) {
      setStandaloneError("A standalone block can contain at most 500 sites.");
      return;
    }
    if (
      until - now > STANDALONE_ACKNOWLEDGEMENT_MS &&
      !standaloneLongAcknowledged
    ) {
      setStandaloneError("Confirm that you understand this block has no early stop.");
      return;
    }
    const reply = await sendStandaloneMessage({
      type: "standalone/start",
      until,
      sites,
    });
    if (!reply.ok) {
      setStandaloneError(reply.message ?? "The block could not be started.");
      return;
    }
    setStandaloneError("");
    setStandaloneStartOpen(false);
    setStandaloneSitesText("");
    setStandaloneLongAcknowledged(false);
    showToast("Standalone block started.", "success");
    if (reply.warning) showToast(reply.warning, "error");
  }

  async function extendStandalone(minutes: number) {
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

  useEffect(() => {
    setDurationText(String(state.settings.defaultDurationMin || 25));
  }, [state.settings.defaultDurationMin]);

  useEffect(
    () => () => {
      if (waitTimer.current !== null) window.clearTimeout(waitTimer.current);
    },
    [],
  );

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

  async function startFocus(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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

  async function startScheduledTask(task: NonNullable<typeof focusTask>) {
    if (state.session.status !== "idle") {
      showToast("End the current session before starting a task.", "info");
      return;
    }
    const reply = await sendSessionMessage({
      type: "session/start",
      durationMin: taskDurationForStart(task, Date.now()),
      lockLevel: task.lockLevel,
      taskId: task.id,
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
      setDurationError("");
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

  const setPreset = (minutes: number) => {
    setDurationText(String(minutes));
    setDurationError("");
  };

  return (
    <section className="fg-page fg-focus" aria-labelledby="focus-title">
      <div className="fg-page__heading">
        <div>
          <h1 id="focus-title">{isRunning ? "Your focus" : "Make room to focus"}</h1>
          <p className="fg-muted">
            {isBreak ? "Take your scheduled break." : "Choose a duration and begin."}
          </p>
        </div>
      </div>

      <Card title={linkedTask ? "Task in progress" : "Up next"}>
        {focusTask ? (
          <div className="fg-stack">
            <strong>{focusTask.title}</strong>
            <p className="fg-muted">
              {taskWindowStart(focusTask) !== null && taskWindowEnd(focusTask) !== null
                ? `${new Date(taskWindowStart(focusTask)!).toLocaleTimeString([], {
                    hour: "numeric",
                    minute: "2-digit",
                  })}–${new Date(taskWindowEnd(focusTask)!).toLocaleTimeString([], {
                    hour: "numeric",
                    minute: "2-digit",
                  })}`
                : `${focusTask.durationMin} min`}
            </p>
            {!linkedTask && (
              <Button
                variant="secondary"
                onClick={() => void startScheduledTask(focusTask)}
                disabled={state.session.status !== "idle"}
              >
                Start task
              </Button>
            )}
          </div>
        ) : (
          <div className="fg-stack">
            <p className="fg-muted">Nothing scheduled — add a task.</p>
            <Button variant="secondary" onClick={onOpenTasks}>Add a task</Button>
          </div>
        )}
      </Card>

      <SessionClock
        session={state.session}
        idleDurationMin={Number(durationText) || state.settings.defaultDurationMin}
      />
      <p className="fg-muted" aria-live="polite">
        {plan.blocked.size} sites · {plan.keywords.length} keywords ·{" "}
        {state.schedules.filter((schedule) =>
          isScheduleActiveAt(schedule, new Date(now)),
        ).length} schedules
      </p>

      <Card
        title={standaloneActive ? "Standalone block active" : "Block now"}
        description={
          standaloneActive
            ? `No early-stop action is available. This block ends automatically at ${new Date(
                state.standalone.until,
              ).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}.`
            : "Block selected sites without starting a focus session. The block ends automatically."
        }
      >
        {standaloneActive ? (
          <div className="fg-stack">
            <StandaloneCountdown until={state.standalone.until} />
            <p className="fg-muted">
              {state.standalone.sites.length} site
              {state.standalone.sites.length === 1 ? "" : "s"} blocked
            </p>
            <ul className="fg-list" aria-label="Standalone blocked sites">
              {state.standalone.sites.map((site) => (
                <li className="fg-list-item" key={site}>
                  <strong>{site}</strong>
                </li>
              ))}
            </ul>
            <form className="fg-stack" onSubmit={addStandaloneSite}>
              <Field
                id="standalone-add-site"
                label="Add a site"
                error={standaloneError || undefined}
              >
                <input
                  id="standalone-add-site"
                  value={standaloneSiteInput}
                  placeholder="example.com"
                  onChange={(event) => {
                    setStandaloneSiteInput(event.target.value);
                    setStandaloneError("");
                  }}
                />
              </Field>
              <Button type="submit" variant="secondary">
                Add site
              </Button>
            </form>
            <div className="fg-wrap" aria-label="Quick extend">
              {[15, 30, 60, 120].map((minutes) => (
                <Button
                  key={minutes}
                  variant="secondary"
                  onClick={() => void extendStandalone(minutes)}
                >
                  +{minutes < 60 ? `${minutes} min` : `${minutes / 60} h`}
                </Button>
              ))}
            </div>
            <form
              className="fg-wrap"
              onSubmit={(event) => {
                event.preventDefault();
                const minutes = Number(standaloneExtendMinutes);
                if (
                  !Number.isInteger(minutes) ||
                  minutes < MIN_STANDALONE_MINUTES ||
                  minutes > MAX_STANDALONE_MINUTES
                ) {
                  setStandaloneError("Choose an extension from 5 minutes to 30 days.");
                  return;
                }
                void extendStandalone(minutes);
              }}
            >
              <Field
                id="standalone-extend-minutes"
                label="Custom extension in minutes"
              >
                <input
                  id="standalone-extend-minutes"
                  type="number"
            min={MIN_STANDALONE_MINUTES}
            max={MAX_STANDALONE_MINUTES}
                  step={1}
                  value={standaloneExtendMinutes}
                  onChange={(event) => setStandaloneExtendMinutes(event.target.value)}
                />
              </Field>
              <Button type="submit" variant="secondary">
                Extend
              </Button>
            </form>
            {standaloneError && (
              <p className="fg-field__error" role="alert">
                {standaloneError}
              </p>
            )}
          </div>
        ) : (
          <Button
            variant="secondary"
            onClick={() => {
              setStandaloneError("");
              setStandaloneUntilText(
                toLocalDateTimeInput(Date.now() + 60 * 60_000),
              );
              setStandaloneLongAcknowledged(false);
              setStandaloneSitesText("");
              setOpenTabCount(null);
              setOpenTabsUnavailable(false);
              setStandaloneStartOpen(true);
            }}
          >
            Start a timed block
          </Button>
        )}
      </Card>

      {!isRunning ? (
        <form className="fg-stack" onSubmit={startFocus}>
          <Card title="Duration">
            <div className="fg-wrap" role="group" aria-label="Duration presets">
              {DURATION_PRESETS.map((minutes) => (
                <button
                  className={`fg-duration-chip ${
                    durationText === String(minutes) ? "is-selected" : ""
                  }`}
                  key={minutes}
                  type="button"
                  aria-pressed={durationText === String(minutes)}
                  onClick={() => setPreset(minutes)}
                >
                  {minutes} min
                </button>
              ))}
            </div>
            <Field
              id="focus-duration"
              label="Custom duration"
              helper="Enter a whole number from 1 to 999 minutes."
              error={durationError}
            >
              <input
                id="focus-duration"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={durationText}
                aria-invalid={Boolean(durationError)}
                onChange={(event) => {
                  setDurationText(event.target.value);
                  if (durationError) setDurationError("");
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    validDuration();
                  }
                }}
                onBlur={() => validDuration()}
              />
            </Field>
          </Card>

          <Card title="Session lock">
            <Segmented
              label="Choose a lock level"
              options={LOCK_OPTIONS}
              value={lockLevel}
              onChange={setLockLevel}
            />
            <p className="fg-muted fg-lock-summary" aria-live="polite">
              {lockLevel === "strict"
                ? hasPassword
                  ? "Stopping early needs your password. You can still disable or remove the extension."
                  : "Stopping early needs the phrase “I GIVE UP” and a 15-second wait. You can still disable or remove the extension."
                : lockLevel === "commitment"
                  ? `${LOCK_COPY[lockLevel]} The session ends at ${new Date(
                      Date.now() + (Number(durationText) || 25) * 60_000,
                    ).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}.`
                  : LOCK_COPY[lockLevel]}
            </p>
            <Button type="submit" className="fg-button--wide">
              {lockLevel === "none" ? "Start focus" : "Start locked session"}
            </Button>
          </Card>
          {!canBlockAnything && (
            <p className="fg-note" role="status">
              Nothing will be blocked during this session until you add rules.
              <Button variant="quiet" onClick={onOpenRules}>Open Rules</Button>
            </p>
          )}
        </form>
      ) : (
        <Card title={isBreak ? "Break controls" : "Session controls"}>
          {state.session.status === "work" && (
            <div className="fg-wrap">
              {[10, 15, 20, 30, 45, 60].map((minutes) => (
                <Button
                  key={minutes}
                  variant="secondary"
                  onClick={async () => {
                    const reply = await sendSessionMessage({
                      type: "session/extend",
                      minutes,
                    });
                    if (reply.ok) showToast(`Added ${minutes} minutes.`, "success");
                    else showToast(reply.message ?? "Could not extend.", "error");
                  }}
                >
                  +{minutes} min
                </Button>
              ))}
            </div>
          )}
          {isBreak && (
            <Button
              variant="secondary"
              onClick={async () => {
                const reply = await sendSessionMessage({
                  type: "session/skipBreak",
                });
                if (!reply.ok) {
                  showToast(reply.message ?? "Could not skip the break.", "error");
                }
              }}
            >
              Skip break
            </Button>
          )}
          {state.session.status === "work" &&
            state.session.lockLevel !== "commitment" && (
              <Button
                variant="danger"
                onClick={() => {
                  setWaitReady(true);
                  setStopOpen(true);
                }}
              >
                Stop session
              </Button>
            )}
          {state.session.lockLevel === "commitment" && (
            <p className="fg-muted">
              This session has no early-stop action. It ends when the timer does.
            </p>
          )}
        </Card>
      )}

      <Modal
        open={standaloneStartOpen}
        title="Set up standalone block"
        description="Choose the sites and end time. There is no early-stop action; you can add sites or extend the block while it is active."
        onClose={() => {
          setStandaloneStartOpen(false);
          setStandaloneError("");
        }}
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setStandaloneStartOpen(false);
                setStandaloneError("");
              }}
            >
              Cancel
            </Button>
            <Button type="submit" form="standalone-start-form">
              Confirm and start
            </Button>
          </>
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
            helper={`Choose an end time from ${MIN_STANDALONE_MINUTES} minutes to 30 days from now.`}
            error={standaloneError || undefined}
          >
            <div className="fg-wrap" role="group" aria-label="End time presets">
              {STANDALONE_EXPIRY_PRESETS.map((preset) => (
                <Button
                  key={preset.minutes}
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setStandaloneUntilText(
                      toLocalDateTimeInput(
                        Date.now() + preset.minutes * 60_000,
                      ),
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
              type="datetime-local"
              min={toLocalDateTimeInput(
                Date.now() + MIN_STANDALONE_MINUTES * 60_000,
              )}
              max={toLocalDateTimeInput(
                Date.now() + MAX_STANDALONE_MINUTES * 60_000,
              )}
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
            helper="Enter up to 500 domains or URLs, one per line. This list is separate from your rules."
          >
            <textarea
              id="standalone-sites"
              rows={4}
              value={standaloneSitesText}
              onChange={(event) => {
                setStandaloneSitesText(event.target.value);
                setStandaloneError("");
              }}
              placeholder={"example.com\nreddit.com"}
            />
          </Field>
          <Card title="Block summary">
            <dl className="fg-list">
              <div className="fg-list-item">
                <dt>Sites</dt>
                <dd>{standalonePreviewSites.length}</dd>
              </div>
              <div className="fg-list-item">
                <dt>Ends</dt>
                <dd>
                  {standaloneUntil === null
                    ? "Choose an end time"
                    : new Date(standaloneUntil).toLocaleString([], {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                </dd>
              </div>
              <div className="fg-list-item">
                <dt>Duration</dt>
                <dd>
                  {standaloneUntil === null
                    ? "—"
                    : formatStandaloneDuration(standaloneUntilDelta)}
                </dd>
              </div>
              <div className="fg-list-item">
                <dt>Matching open tabs</dt>
                <dd>
                  {openTabCount !== null
                    ? openTabCount
                    : openTabsUnavailable
                      ? "Could not check"
                      : "Checking…"}
                </dd>
              </div>
            </dl>
            <p className="fg-note">
              Open matching tabs may be affected when blocking starts.
            </p>
          </Card>
          {standaloneNeedsAcknowledgement && (
            <Toggle
              label="I understand this block lasts over 24 hours and has no early-stop action."
              checked={standaloneLongAcknowledged}
              onCheckedChange={(checked) => {
                setStandaloneLongAcknowledged(checked);
                setStandaloneError("");
              }}
            />
          )}
        </form>
      </Modal>

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
        <form
          id="stop-session-form"
          className="fg-stack"
          onSubmit={submitStop}
        >
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
    </section>
  );
}
