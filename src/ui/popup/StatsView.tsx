import type { AppState, SessionRecord } from "../../shared/types.ts";
import { Card, Chip, EmptyState, ProgressRing } from "../components/primitives.tsx";

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
    </section>
  );
}
