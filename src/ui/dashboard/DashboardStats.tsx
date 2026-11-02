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
import {
  Card,
  ListRow,
  Progress,
  ProgressRing,
  SectionLabel,
  Segmented,
  Stat,
} from "../components/primitives.tsx";
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
  const rangeLabel =
    range === "today" ? "Today" : range === "week" ? "This week" : "This month";

  return (
    <section className="fg-stack" aria-labelledby="dashboard-stats-title">
      <h1 id="dashboard-stats-title" className="fg-sr-only">Overview</h1>

      <div className="fg-hero fg-hero--smallest">
        <div className="fg-hero__time">{formatDuration(totals.focusMs)}</div>
        <p className="fg-hero__sub">{rangeLabel} focus time</p>
        <div className="fg-hero__goal" aria-label={`Daily goal ${Math.round(goalProgress * 100)}% complete`}>
          <Progress value={goalProgress} />
          <p className="fg-hero__sub">
            {Math.round(goalProgress * 100)}% of today's {state.settings.dailyGoalMin} min goal
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

      <SectionLabel>Sessions</SectionLabel>
      <div className="fg-stat-row">
        <Stat label="Completed" value={totals.sessionsCompleted} />
        <Stat label="Clean" value={cleanSessions} sub="No blocks hit" />
        <Stat
          label="Completion rate"
          value={`${Math.round(totals.completionRate * 100)}%`}
        />
        <Stat label="Pages blocked" value={totals.blocks} />
      </div>

      <div className="fg-stat-row fg-stat-row--2">
        <Stat
          label="Current streak"
          value={`${streaks.current} day${streaks.current === 1 ? "" : "s"}`}
        />
        <Stat
          label="Best streak"
          value={`${streaks.best} day${streaks.best === 1 ? "" : "s"}`}
        />
      </div>

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
        </div>
      </Card>

      <Card title="Focus minutes per day">
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

      <SectionLabel>Insights</SectionLabel>
      <div className="fg-stat-row fg-stat-row--2">
        <Stat
          label="Most productive hour"
          value={
            insights.mostProductiveHour === null
              ? "Not recorded"
              : `${String(insights.mostProductiveHour).padStart(2, "0")}:00`
          }
        />
        <Stat
          label="Best weekday"
          value={
            insights.bestWeekday === null ? "Not recorded" : WEEKDAYS[insights.bestWeekday]
          }
        />
        <Stat label="Average session" value={formatDuration(insights.averageSessionMs)} />
        <Stat
          label="Completion rate"
          value={`${Math.round(insights.completionRate * 100)}%`}
        />
        <Stat
          label="Total focus time"
          value={formatDuration(insights.totalHours * 3_600_000)}
        />
        <Stat
          label="This week"
          value={`${insights.thisWeekSessions} session${insights.thisWeekSessions === 1 ? "" : "s"}`}
          sub={`${Math.round(insights.thisWeekMinutes)} min`}
        />
        <Stat label="Best session" value={formatDuration(insights.bestSessionMs)} />
      </div>

      <SectionLabel>Top blocked</SectionLabel>
      {insights.topBlockedDomains.length === 0 ? (
        <p className="fg-muted">Nothing blocked in the recorded period.</p>
      ) : (
        insights.topBlockedDomains.map((entry) => (
          <ListRow
            key={entry.domain}
            title={entry.domain}
            status={<span className="fg-muted">{entry.count} blocks</span>}
          />
        ))
      )}

      <SectionLabel>Allowance usage today</SectionLabel>
      {allowanceRows.length === 0 ? (
        <p className="fg-muted">No daily limits configured.</p>
      ) : (
        allowanceRows.map((row) => (
          <ListRow
            key={row.domain}
            title={row.domain}
            sub={
              row.limitMinutes === null
                ? `${row.usedMinutes} min used`
                : `${row.usedMinutes} of ${row.limitMinutes} min`
            }
            status={
              row.limitMinutes === null ? undefined : (
                <div className="fg-usage-cell">
                  <Progress
                    value={Math.min(1, row.usedMinutes / Math.max(1, row.limitMinutes))}
                    tone={row.usedMinutes >= row.limitMinutes ? "warn" : "accent"}
                  />
                </div>
              )
            }
          />
        ))
      )}

      <ListRow
        title="Protection gaps"
        sub="Last 7 days"
        status={
          <span className="fg-muted">
            {protectionGaps.count === 0
              ? "None recorded"
              : `${protectionGaps.count} · ${Math.ceil(protectionGaps.durationMs / 60_000)} min`}
          </span>
        }
      />

      <AchievementsCard state={state} />
    </section>
  );
}
