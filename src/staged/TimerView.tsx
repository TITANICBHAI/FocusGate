import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useStagedSession } from "./useSession.ts";

type LockLevel = "none" | "strict" | "commitment";

const EXTENSIONS = [10, 15, 20, 30, 45, 60];

export default function TimerView() {
  const { ready, session, settings, hasPassword, now, error, send } =
    useStagedSession();
  const [duration, setDuration] = useState(
    String(settings.defaultDurationMin || 25),
  );
  const [lockLevel, setLockLevel] = useState<LockLevel>("none");
  const [showStop, setShowStop] = useState(false);
  const [stopCredential, setStopCredential] = useState("");
  const [waitUntil, setWaitUntil] = useState<number | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    setDuration(String(settings.defaultDurationMin || 25));
  }, [settings.defaultDurationMin]);

  const remainingMs =
    session.status === "idle"
      ? 0
      : Math.max(0, session.phaseEndsAt - now);
  const remainingSeconds = Math.ceil(remainingMs / 1_000);
  const timeText = `${String(Math.floor(remainingSeconds / 60)).padStart(2, "0")}:${String(remainingSeconds % 60).padStart(2, "0")}`;
  const isRunning = session.status !== "idle";
  const isBreak =
    session.status === "shortBreak" || session.status === "longBreak";
  const waiting = waitUntil !== null && now < waitUntil;

  async function startSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const durationMin = Number(duration);
    if (!Number.isInteger(durationMin) || durationMin < 1 || durationMin > 999) {
      setLocalError("Choose a duration from 1 to 999 minutes.");
      return;
    }
    setLocalError(null);
    await send({ type: "session/start", durationMin, lockLevel });
  }

  async function submitStop(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload: Record<string, unknown> = { type: "session/stop" };
    if (session.lockLevel === "strict") {
      payload[hasPassword ? "password" : "phrase"] = stopCredential;
    }
    const reply = await send(payload);
    if (reply.code === "WAIT_REQUIRED" && reply.waitMs !== undefined) {
      setWaitUntil(now + reply.waitMs);
      setLocalError(reply.message ?? "Wait before confirming.");
      return;
    }
    if (reply.ok) {
      setShowStop(false);
      setStopCredential("");
      setWaitUntil(null);
      setLocalError(null);
    }
  }

  if (!ready) {
    return <main className="staged-timer"><p>Loading session…</p></main>;
  }

  return (
    <main className="staged-timer">
      <header>
        <span className="staged-mark">FocusGate</span>
        <span className={`staged-status ${isRunning ? "is-active" : ""}`}>
          {session.status === "idle"
            ? "Idle"
            : isBreak
              ? "Break"
              : "Focus"}
        </span>
      </header>

      <section className="staged-clock" aria-live="off">
        <p className="staged-phase">
          {session.status === "idle"
            ? "Ready when you are"
            : isBreak
              ? session.status === "longBreak"
                ? "Long break"
                : "Short break"
              : `${session.lockLevel} focus`}
        </p>
        <output aria-label="Time remaining">{timeText}</output>
        {isRunning && (
          <p className="staged-helper">
            Ends at {new Date(session.phaseEndsAt).toLocaleTimeString([], {
              hour: "numeric",
              minute: "2-digit",
            })}
          </p>
        )}
      </section>

      {session.status === "idle" ? (
        <form className="staged-controls" onSubmit={startSession}>
          <label>
            Duration in minutes
            <input
              min="1"
              max="999"
              inputMode="numeric"
              value={duration}
              onChange={(event) => setDuration(event.target.value)}
            />
          </label>
          <fieldset>
            <legend>Session lock</legend>
            {(["none", "strict", "commitment"] as const).map((level) => (
              <button
                type="button"
                key={level}
                aria-pressed={lockLevel === level}
                className={lockLevel === level ? "is-selected" : ""}
                onClick={() => setLockLevel(level)}
              >
                {level}
              </button>
            ))}
          </fieldset>
          <p className="staged-helper">
            {lockLevel === "none"
              ? "You can stop with a confirmation."
              : lockLevel === "strict"
                ? "Stopping early needs your password, or a phrase and a 15-second wait."
                : "This session runs until its timer ends."}
          </p>
          <button className="staged-primary" type="submit">
            Start focus
          </button>
        </form>
      ) : (
        <section className="staged-controls">
          {session.status === "work" && (
            <>
              <p className="staged-helper">
                {session.lockLevel === "commitment"
                  ? "This session cannot be stopped early."
                  : "Add time if you need to continue."}
              </p>
              <div className="staged-extensions" aria-label="Extend session">
                {EXTENSIONS.map((minutes) => (
                  <button
                    type="button"
                    key={minutes}
                    onClick={() =>
                      void send({ type: "session/extend", minutes })
                    }
                  >
                    +{minutes}m
                  </button>
                ))}
              </div>
            </>
          )}

          {isBreak && (
            <button
              type="button"
              className="staged-primary"
              onClick={() => void send({ type: "session/skipBreak" })}
            >
              Skip break
            </button>
          )}

          {session.lockLevel !== "commitment" && (
            <>
              {!showStop ? (
                <button
                  type="button"
                  className="staged-secondary"
                  onClick={() => setShowStop(true)}
                >
                  {session.lockLevel === "strict"
                    ? "Stop with verification"
                    : "Stop session"}
                </button>
              ) : (
                <form className="staged-stop-form" onSubmit={submitStop}>
                  {session.lockLevel === "none" ? (
                    <p className="staged-helper">
                      End this session now? Blocking will stop.
                    </p>
                  ) : (
                    <label>
                      {hasPassword ? "Password" : "Type I GIVE UP"}
                      <input
                        autoComplete="current-password"
                        type={hasPassword ? "password" : "text"}
                        value={stopCredential}
                        onChange={(event) =>
                          setStopCredential(event.target.value)
                        }
                      />
                    </label>
                  )}
                  {waiting && (
                    <p className="staged-helper">
                      Wait {Math.ceil((waitUntil! - now) / 1_000)} seconds.
                    </p>
                  )}
                  <div className="staged-actions">
                    <button
                      type="button"
                      className="staged-secondary"
                      onClick={() => {
                        setShowStop(false);
                        setStopCredential("");
                        setWaitUntil(null);
                        setLocalError(null);
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="staged-primary"
                      disabled={waiting}
                    >
                      Confirm stop
                    </button>
                  </div>
                </form>
              )}
            </>
          )}
        </section>
      )}

      {(localError || error) && (
        <p role="alert" className="staged-error">
          {localError ?? error}
        </p>
      )}
    </main>
  );
}
