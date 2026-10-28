import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import type { AppState, LockLevel, SessionState } from "../../shared/types.ts";
import {
  Button,
  Card,
  Field,
  ProgressRing,
  Segmented,
} from "../components/primitives.tsx";
import { Modal, useToast } from "../components/feedback.tsx";
import { sendSessionMessage } from "../lib/sessionActions.ts";

const DURATION_PRESETS = [15, 25, 45, 60, 90] as const;
const LOCK_OPTIONS = [
  { value: "none", label: "None" },
  { value: "strict", label: "Strict" },
  { value: "commitment", label: "Commit" },
] as const;
const LOCK_COPY: Record<LockLevel, string> = {
  none: "You can stop any time with a confirmation.",
  strict:
    "Stopping early needs your password, or a phrase and a 15-second wait.",
  commitment:
    "You can extend this session, but it has no early-stop action.",
};

function formatTime(seconds: number): string {
  const safe = Math.max(0, seconds);
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(
    safe % 60,
  ).padStart(2, "0")}`;
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

export function FocusView({ state }: { state: AppState }) {
  const showToast = useToast();
  const [durationText, setDurationText] = useState(
    String(state.settings.defaultDurationMin || 25),
  );
  const [durationError, setDurationError] = useState("");
  const [lockLevel, setLockLevel] = useState<LockLevel>("none");
  const [stopOpen, setStopOpen] = useState(false);
  const [stopCredential, setStopCredential] = useState("");
  const [waitReady, setWaitReady] = useState(true);
  const waitTimer = useRef<number | null>(null);
  const isRunning = state.session.status !== "idle";
  const isBreak =
    state.session.status === "shortBreak" ||
    state.session.status === "longBreak";
  const standaloneActive =
    state.standalone.active &&
    state.standalone.startsAt <= Date.now() &&
    Date.now() < state.standalone.until;
  const hasConfiguredSites =
    state.blockedSites.length > 0 ||
    state.alwaysBlockedSites.length > 0 ||
    state.schedules.some((schedule) => schedule.enabled && schedule.sites.length > 0);
  const hasPassword = state.password !== null;

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

      <SessionClock
        session={state.session}
        idleDurationMin={Number(durationText) || state.settings.defaultDurationMin}
      />

      <Card
        title={standaloneActive ? "Standalone block active" : "Block now"}
        description={
          standaloneActive
            ? `This block is scheduled to end at ${new Date(
                state.standalone.until,
              ).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}.`
            : "Start a timed block without beginning a focus session."
        }
      >
        <Button
          variant="secondary"
          disabled
          title="Standalone block controls are not connected to the staged background runtime."
        >
          {standaloneActive ? "Block controls unavailable" : "Start a block"}
        </Button>
        <p className="fg-muted">
          Standalone block controls will be enabled after the background runtime cutover.
        </p>
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
              {lockLevel === "commitment"
                ? `${LOCK_COPY[lockLevel]} It ends at ${new Date(
                    Date.now() + (Number(durationText) || 25) * 60_000,
                  ).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}.`
                : LOCK_COPY[lockLevel]}
            </p>
            {lockLevel !== "none" && (
              <p className="fg-muted">
                {lockLevel === "strict"
                  ? "Start locked session"
                  : "This session has no early-stop action."}
              </p>
            )}
            <Button type="submit" className="fg-button--wide">
              {lockLevel === "none" ? "Start focus" : "Start locked session"}
            </Button>
          </Card>
          {!hasConfiguredSites && (
            <p className="fg-note">
              Add sites in Rules first if you want FocusGate to block pages.
            </p>
          )}
        </form>
      ) : (
        <Card title={isBreak ? "Break controls" : "Session controls"}>
          {state.session.status === "work" && (
            <div className="fg-wrap">
              {[15, 25, 45].map((minutes) => (
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
