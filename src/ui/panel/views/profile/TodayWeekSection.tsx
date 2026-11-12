import {
  calculateStreaks,
  dayGoalProgress,
  focusMinutesPerDay,
  stoppedEarlyText,
} from "../../../../shared/stats.ts";
import { localDateKey } from "../../../../shared/time.ts";
import { sessionDebrief } from "../../../../shared/debrief.ts";
import type { AppState } from "../../../../shared/types.ts";
import { Progress, Stat } from "../../../components/primitives.tsx";

function keyOf(timestamp: number): string {
  return localDateKey(new Date(timestamp));
}

/** One compact row for today, the 7-day bars, and the last session's debrief. */
export function TodayWeekSection({ state, now }: { state: AppState; now: Date }) {
  const todayKey = localDateKey(now);
  const weekStartKey = keyOf(now.getTime() - 6 * 86_400_000);
  const today = state.dayStats[todayKey];
  const streaks = calculateStreaks(state.sessionHistory, now);
  const goalPct = dayGoalProgress(today, state.settings.dailyGoalMin);
  const stoppedLine = stoppedEarlyText(today);

  const week = focusMinutesPerDay(state.dayStats, weekStartKey, todayKey);
  const weekFocusMinutes = week.reduce((total, point) => total + point.minutes, 0);
  const weekSessions = Object.values(state.dayStats)
    .filter((day) => day.dateKey >= weekStartKey && day.dateKey <= todayKey)
    .reduce((total, day) => total + day.sessionsCompleted, 0);
  const chartMax = Math.max(30, ...week.map((point) => point.minutes));

  const latestCompleted = [...state.sessionHistory]
    .filter((record) => record.status === "completed")
    .sort((left, right) => right.endedAt - left.endedAt)[0];
  const debrief =
    latestCompleted !== undefined && now.getTime() - latestCompleted.endedAt < 60 * 60_000
      ? sessionDebrief(latestCompleted)
      : null;

  return (
    <section className="fg-profile-group" aria-labelledby="profile-today-title">
      <h2 id="profile-today-title" className="fg-card__title">
        Today and this week
      </h2>
      <div className="fg-stat-row">
        <Stat label="Focused" value={`${Math.round((today?.focusMs ?? 0) / 60_000)}m`} />
        <Stat label="Goal" value={`${Math.round(goalPct * 100)}%`} />
        <Stat label="Streak" value={`${streaks.current}d`} />
      </div>
      <div className="fg-hero__progress">
        <Progress value={goalPct} label="Daily goal" />
      </div>
      {stoppedLine && <p className="fg-card__desc">{stoppedLine}</p>}
      <svg
        role="img"
        aria-label={`Focus minutes for the last 7 days; the highest day reached ${chartMax} minutes.`}
        viewBox={`0 0 ${week.length * 28} 80`}
        width={week.length * 28}
        height={80}
        className="fg-stats-chart fg-week-chart"
      >
        <line x1={0} x2={week.length * 28} y1={60.5} y2={60.5} className="fg-week-chart__base" />
        {week.map((point, index) => {
          const height = Math.round((point.minutes / chartMax) * 56);
          return (
            <g key={point.dateKey}>
              <rect
                x={index * 28 + 6}
                y={60 - height}
                width={16}
                height={Math.max(point.minutes > 0 ? 2 : 0, height)}
                rx={2}
                fill="currentColor"
                opacity={0.85}
              />
              <text x={index * 28 + 14} y={76} textAnchor="middle" fontSize={12} className="fg-week-chart__label">
                {point.dateKey.slice(8)}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="fg-stat-row">
        <Stat label="Sessions this week" value={weekSessions} />
        <Stat
          label="Focused this week"
          value={`${Math.floor(weekFocusMinutes / 60)}h ${weekFocusMinutes % 60}m`}
        />
      </div>
      {debrief && (
        <>
          <p className="fg-card__desc">{debrief.headline}</p>
          {debrief.pace && <p className="fg-card__desc">{debrief.pace}</p>}
        </>
      )}
    </section>
  );
}
