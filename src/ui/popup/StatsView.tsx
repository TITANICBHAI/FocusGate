import { useEffect, useState } from "react";
import type { AppState, SessionRecord } from "../../shared/types.ts";
import { ACHIEVEMENT_DEFINITIONS } from "../../shared/achievements.ts";
import {
  Button,
  Card,
  Chip,
  EmptyState,
  Field,
  ProgressRing,
} from "../components/primitives.tsx";
import { useToast } from "../components/feedback.tsx";
import { uiStorageStore } from "../hooks/storageStore.ts";
import { storageWriteErrorMessage } from "../lib/guardPrompts.ts";

function localDateKey(value: number): string {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

function formatDuration(milliseconds: number): string {
  const minutes = Math.max(0, Math.floor(milliseconds / 60_000));
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return hours ? `${hours} hr ${remainder} min` : `${remainder} min`;
}

function recordLabel(record: SessionRecord): string {
  const status =
    record.status === "completed"
      ? "Completed"
      : record.status === "abandoned"
        ? "Ended early"
        : "Interrupted";
  const start = new Date(record.startedAt).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${status} · ${start}`;
}

export function StatsView({ state }: { state: AppState }) {
  const todayKey = localDateKey(Date.now());
  const today = state.dayStats[todayKey];
  const focusMs =
    today?.focusMs ??
    state.sessionHistory
      .filter((record) => localDateKey(record.startedAt) === todayKey)
      .reduce((total, record) => total + record.elapsedMs, 0);
  const goalMs = state.settings.dailyGoalMin * 60_000;
  const progress = goalMs > 0 ? Math.min(1, focusMs / goalMs) : 0;
  const recent = [...state.sessionHistory]
    .sort((left, right) => right.endedAt - left.endedAt)
    .slice(0, 6);
  const blocksToday =
    today?.blocks ??
    state.recentBlocks.filter((record) => localDateKey(record.at) === todayKey)
      .length;
  const daysWithFocus = Object.values(state.dayStats).filter(
    (day) => day.focusMs > 0,
  ).length;

  return (
    <section className="fg-page" aria-labelledby="stats-title">
      <div className="fg-page__heading">
        <div>
          <h1 id="stats-title">Stats</h1>
          <p className="fg-muted">
            A summary of your recorded focus sessions.
          </p>
        </div>
        <Chip>{new Date().toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}</Chip>
      </div>

      <div className="fg-stats-grid">
        <Card title="Focus today">
          <div className="fg-stats-focus">
            <ProgressRing
              size={126}
              stroke={7}
              progress={progress}
              label={`${formatDuration(focusMs)} focused today`}
            >
              <strong className="fg-stats-focus__value">
                {Math.floor(focusMs / 60_000)}
              </strong>
              <span className="fg-muted">minutes</span>
            </ProgressRing>
            <p className="fg-muted">
              Goal: {state.settings.dailyGoalMin} minutes
            </p>
          </div>
        </Card>
        <Card title="Today">
          <dl className="fg-stat-list">
            <div>
              <dt>Sessions completed</dt>
              <dd>{today?.sessionsCompleted ?? 0}</dd>
            </div>
            <div>
              <dt>Pages blocked</dt>
              <dd>{blocksToday}</dd>
            </div>
            <div>
              <dt>Tasks completed</dt>
              <dd>{today?.tasksCompleted ?? 0}</dd>
            </div>
          </dl>
        </Card>
      </div>

      <Card title="Recent sessions">
        {recent.length === 0 ? (
          <EmptyState
            title="No sessions recorded yet"
            description="Start a focus session to see your history here."
          />
        ) : (
          <ul className="fg-list">
            {recent.map((record) => (
              <li className="fg-list-item" key={record.id}>
                <div className="fg-list-item__copy">
                  <strong>{formatDuration(record.elapsedMs)} focus</strong>
                  <span className="fg-muted">{recordLabel(record)}</span>
                  {(record.extendedMs ?? 0) > 0 && (
                    <span className="fg-muted">
                      Extended by {Math.round((record.extendedMs ?? 0) / 60_000)} min
                    </span>
                  )}
                </div>
                <Chip
                  tone={
                    record.status === "completed"
                      ? "accent"
                      : record.status === "interrupted"
                        ? "warning"
                        : "neutral"
                  }
                >
                  {record.status}
                </Chip>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Your history">
        <p className="fg-muted">
          Focus activity is recorded for {daysWithFocus}{" "}
          {daysWithFocus === 1 ? "day" : "days"}.
        </p>
      </Card>

      <Card
        title="Achievements"
        description="Milestones recorded from your focus history."
      >
        <ul className="fg-list">
          {ACHIEVEMENT_DEFINITIONS.map((definition) => {
            const unlocked = state.achievements.find(
              (record) => record.id === definition.id,
            );
            return (
              <li className="fg-list-item" key={definition.id}>
                <div className="fg-list-item__copy">
                  <strong>{definition.label}</strong>
                  <span className="fg-muted">{definition.description}</span>
                  {unlocked && (
                    <span className="fg-muted">
                      Unlocked{" "}
                      {new Date(unlocked.unlockedAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
                <Chip tone={unlocked ? "accent" : "neutral"}>
                  {unlocked ? "Unlocked" : "Locked"}
                </Chip>
              </li>
            );
          })}
        </ul>
      </Card>

      <ReflectionCard state={state} />
    </section>
  );
}

function ReflectionCard({ state }: { state: AppState }) {
  const showToast = useToast();
  const todayKey = localDateKey(Date.now());
  const today = state.dayStats[todayKey];
  const [noteDraft, setNoteDraft] = useState(today?.note ?? "");

  useEffect(() => {
    setNoteDraft(today?.note ?? "");
  }, [today?.note]);

  function saveReflection(changes: { mood?: number | null; note?: string | null }) {
    void uiStorageStore
      .set("dayStats", (latest) => {
        const current =
          latest[todayKey] ??
          {
            dateKey: todayKey,
            focusMs: 0,
            sessionsCompleted: 0,
            sessionsAbandoned: 0,
            blocks: 0,
            blocksByDomain: {},
            tasksCompleted: 0,
          };
        return {
          ...latest,
          [todayKey]: {
            ...current,
            ...(changes.mood !== undefined
              ? { mood: changes.mood === null ? undefined : changes.mood }
              : {}),
            ...(changes.note !== undefined
              ? { note: changes.note.length > 0 ? changes.note : undefined }
              : {}),
          },
        };
      })
      .then(() => showToast("Reflection saved.", "success"))
      .catch((error) =>
        showToast(
          storageWriteErrorMessage(error, "The reflection could not be saved."),
          "error",
        ),
      );
  }

  return (
    <Card
      title="Today's reflection"
      description="Optional mood and note, stored for the day."
    >
      <div className="fg-wrap" role="group" aria-label="Mood">
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            type="button"
            className={`fg-duration-chip ${today?.mood === value ? "is-selected" : ""}`}
            aria-pressed={today?.mood === value}
            onClick={() => saveReflection({ mood: value })}
          >
            {value}
          </button>
        ))}
      </div>
      <Field id="reflection-note" label="Note">
        <textarea
          id="reflection-note"
          value={noteDraft}
          maxLength={500}
          placeholder="How did the day go?"
          onChange={(event) => setNoteDraft(event.target.value)}
          onBlur={() => {
            if ((today?.note ?? "") !== noteDraft) {
              saveReflection({ note: noteDraft });
            }
          }}
        />
      </Field>
      {(today?.mood !== undefined || (today?.note ?? "").length > 0) && (
        <Button
          variant="quiet"
          onClick={() => {
            setNoteDraft("");
            saveReflection({ mood: null, note: null });
          }}
        >
          Clear today's reflection
        </Button>
      )}
    </Card>
  );
}
