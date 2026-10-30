import { useState } from "react";
import {
  aggregateStats,
  calculateFocusScore,
  calculateStreaks,
  focusMinutesPerDay,
  formatDuration,
  getFocusInsights,
  lastNDaysRange,
  todayAllowanceUsage,
} from "../../shared/stats.ts";
import { localDateKey } from "../../shared/time.ts";
import type { AppState } from "../../shared/types.ts";
import { AchievementsCard } from "../components/AchievementsCard.tsx";
import { Card, ProgressRing, Segmented } from "../components/primitives.tsx";
import { summarizeProtectionGaps } from "../lib/protectionStatus.ts";

type StatsRange = "today" | "week" | "month";

const RANGE_DAYS: Record<StatsRange, number> = {
  today: 1,
  week: 7,
  month: 30,
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** WP8.1: the full dashboard statistics view with ranges, KPIs, and insights. */
export function DashboardStats({ state }: { state: AppState }) {
  const [range, setRange] = useState<StatsRange>("week");
  const now = new Date();
  const todayKey = localDateKey(now);

  const rangeDays = RANGE_DAYS[range];
  const { startDateKey, endDateKey } = lastNDaysRange(now, rangeDays);
  const totals = aggregateStats(
    state.sessionHistory,
    state.dayStats,
    startDateKey,
    endDateKey,
  );
  const cleanSessions = state.sessionHistory.filter((record) => {
    const key = localDateKey(new Date(record.startedAt));
    return (
      key >= startDateKey &&
      key <= endDateKey &&
      record.status === "completed" &&
      record.blockedAttempts === 0
    );
  }).length;

  const streaks = calculateStreaks(state.sessionHistory, now);
  const insights = getFocusInsights(state.sessionHistory, state.dayStats, now);
  const today = state.dayStats[todayKey];
  const tasksPlannedToday = state.tasks.filter(
    (task) => task.scheduledDate === todayKey,
  ).length;
  const focusScore = calculateFocusScore({
    focusMs: today?.focusMs ?? 0,
    dailyGoalMin: state.settings.dailyGoalMin,
    tasksCompleted: today?.tasksCompleted ?? 0,
    tasksPlanned: tasksPlannedToday,
    streak: streaks.current,
  });
  const goalMs = Math.max(1, state.settings.dailyGoalMin) * 60_000;
  const goalProgress = Math.min(1, (today?.focusMs ?? 0) / goalMs);

  const chartEnd = endDateKey;
  const chartStart = lastNDaysRange(now, RANGE_DAYS[range] === 1 ? 7 : rangeDays)
    .startDateKey;
  const chart = focusMinutesPerDay(state.dayStats, chartStart, chartEnd);
  const chartMax = Math.max(30, ...chart.map((point) => point.minutes));

  const allowanceRows = todayAllowanceUsage(
    state.allowances,
    state.usage,
    now,
  ).slice(0, 6);
  const protectionGaps = summarizeProtectionGaps(
    state.sessionHistory,
    state.session.gaps,
    now.getTime(),
  );

  return (
    <section className="fg-page" aria-labelledby="dashboard-stats-title">
      <div className="fg-page__heading">
        <div>
          <h1 id="dashboard-stats-title">Stats</h1>
          <p className="fg-muted">
            Actual focus time from your recorded sessions.
          </p>
        </div>
      </div>

      <Segmented
        label="Statistics range"
        options={[
          { value: "today", label: "Today" },
          { value: "week", label: "Week" },
          { value: "month", label: "Month" },
        ]}
        value={range}
        onChange={setRange}
      />

      <div className="fg-stats-grid">
        <Card title="Focus time">
          <p className="fg-stats-focus__value">{formatDuration(totals.focusMs)}</p>
          <p className="fg-muted">
            {range === "today" ? "Today" : range === "week" ? "This week" : "This month"}
          </p>
        </Card>
        <Card title="Sessions">
          <dl className="fg-stat-list">
            <div>
              <dt>Completed</dt>
              <dd>{totals.sessionsCompleted}</dd>
            </div>
            <div>
              <dt>Clean</dt>
              <dd>{cleanSessions}</dd>
            </div>
            <div>
              <dt>Completion rate</dt>
              <dd>{Math.round(totals.completionRate * 100)}%</dd>
            </div>
            <div>
              <dt>Pages blocked</dt>
              <dd>{totals.blocks}</dd>
            </div>
          </dl>
        </Card>
        <Card title="Focus score">
          <div className="fg-stats-focus">
            <ProgressRing
              size={110}
              stroke={7}
              progress={focusScore / 100}
              label={`Focus score ${focusScore} of 100`}
            >
              <strong className="fg-stats-focus__value">{focusScore}</strong>
              <span className="fg-muted">of 100 today</span>
            </ProgressRing>
            <p className="fg-muted">
              Daily goal {state.settings.dailyGoalMin} min · tasks{" "}
              {today?.tasksCompleted ?? 0}/{tasksPlannedToday}
            </p>
            <div
              className="fg-stats-goal-ring"
              role="img"
              aria-label={`Daily goal ${Math.round(goalProgress * 100)}% complete`}
            >
              {Math.round(goalProgress * 100)}% of today's goal
            </div>
          </div>
        </Card>
        <Card title="Streaks">
          <dl className="fg-stat-list">
            <div>
              <dt>Current streak</dt>
              <dd>{streaks.current} day{streaks.current === 1 ? "" : "s"}</dd>
            </div>
            <div>
              <dt>Best streak</dt>
              <dd>{streaks.best} day{streaks.best === 1 ? "" : "s"}</dd>
            </div>
          </dl>
        </Card>
      </div>

      <Card
        title="Focus minutes per day"
        description="Daily focus time drawn inline — no chart library."
      >
        <svg
          className="fg-stats-chart"
          role="img"
          aria-label={`Focus minutes per day for ${chart.length} days; the highest day reached ${chartMax} minutes.`}
          viewBox={`0 0 ${chart.length * 24} 130`}
          preserveAspectRatio="none"
        >
          {chart.map((point, index) => {
            const height = Math.round((point.minutes / chartMax) * 100);
            return (
              <g key={point.dateKey}>
                <rect
                  x={index * 24 + 4}
                  y={110 - height}
                  width={16}
                  height={Math.max(point.minutes > 0 ? 2 : 0, height)}
                  rx={2}
                  fill="currentColor"
                  opacity={0.85}
                />
                <text
                  x={index * 24 + 12}
                  y={126}
                  textAnchor="middle"
                  fontSize={9}
                >
                  {point.dateKey.slice(8)}
                </text>
              </g>
            );
          })}
        </svg>
      </Card>

      <Card title="Insights">
        <dl className="fg-stat-list">
          <div>
            <dt>Most productive hour</dt>
            <dd>
              {insights.mostProductiveHour === null
                ? "Not recorded"
                : `${String(insights.mostProductiveHour).padStart(2, "0")}:00`}
            </dd>
          </div>
          <div>
            <dt>Best weekday</dt>
            <dd>
              {insights.bestWeekday === null
                ? "Not recorded"
                : WEEKDAYS[insights.bestWeekday]}
            </dd>
          </div>
          <div>
            <dt>Average session</dt>
            <dd>{formatDuration(insights.averageSessionMs)}</dd>
          </div>
          <div>
            <dt>Completion rate</dt>
            <dd>{Math.round(insights.completionRate * 100)}%</dd>
          </div>
          <div>
            <dt>Total focus time</dt>
            <dd>{formatDuration(insights.totalHours * 3_600_000)}</dd>
          </div>
          <div>
            <dt>This week</dt>
            <dd>
              {insights.thisWeekSessions} session
              {insights.thisWeekSessions === 1 ? "" : "s"} ·{" "}
              {Math.round(insights.thisWeekMinutes)} min
            </dd>
          </div>
          <div>
            <dt>Best session</dt>
            <dd>{formatDuration(insights.bestSessionMs)}</dd>
          </div>
        </dl>
      </Card>

      <div className="fg-stats-grid">
        <Card title="Top blocked domains">
          {insights.topBlockedDomains.length === 0 ? (
            <p className="fg-muted">Nothing blocked in the recorded period.</p>
          ) : (
            <dl className="fg-stat-list">
              {insights.topBlockedDomains.map((entry) => (
                <div key={entry.domain}>
                  <dt>{entry.domain}</dt>
                  <dd>{entry.count}</dd>
                </div>
              ))}
            </dl>
          )}
        </Card>
        <Card title="Allowance usage today">
          {allowanceRows.length === 0 ? (
            <p className="fg-muted">No daily limits configured.</p>
          ) : (
            <dl className="fg-stat-list">
              {allowanceRows.map((row) => (
                <div key={row.domain}>
                  <dt>{row.domain}</dt>
                  <dd>
                    {row.limitMinutes === null
                      ? `${row.usedMinutes} min used`
                      : `${row.usedMinutes} of ${row.limitMinutes} min`}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </Card>
        <Card title="Protection gaps">
          <p className="fg-muted">
            {protectionGaps.count === 0
              ? "None recorded in the last 7 days."
              : `${protectionGaps.count} gap${protectionGaps.count === 1 ? "" : "s"} · ${Math.ceil(protectionGaps.durationMs / 60_000)} min total`}
          </p>
        </Card>
      </div>

      <AchievementsCard state={state} />
    </section>
  );
}
