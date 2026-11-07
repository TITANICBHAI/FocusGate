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
import { WeekStrip } from "../components/WeekStrip.tsx";
import { WeekBars } from "../components/WeekBars.tsx";
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
export function DashboardStats({
  state,
  now = new Date(),
}: {
  state: AppState;
  now?: Date;
}) {
  const [range, setRange] = useState<StatsRange>("week");
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

  const weekRange = lastNDaysRange(now, 7);
  const chart = focusMinutesPerDay(state.dayStats, weekRange.startDateKey, weekRange.endDateKey);
  const weekMs = chart.reduce((sum, point) => sum + point.minutes, 0) * 60_000;

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
    <div className="fg-overview">
    <section className="fg-stack" aria-labelledby="dashboard-stats-title">
      <h1 id="dashboard-stats-title" className="fg-sr-only">Overview</h1>

      <div className="fg-hero fg-hero--smallest">
        <div className="fg-hero__time">{formatDuration(today?.focusMs ?? 0)}</div>
        <p className="fg-hero__sub">Today's focus time</p>
        <div className="fg-hero__goal">
          <Progress value={goalProgress} label="Daily goal" />
          <p className="fg-hero__sub">
            {Math.round(goalProgress * 100)}% of your {state.settings.dailyGoalMin} min goal
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
            Out of 100: 60 points for your daily goal, 30 for tasks done against tasks
            planned for today, 10 for a streak. Goal {state.settings.dailyGoalMin} min; tasks{" "}
            {today?.tasksCompleted ?? 0} of {tasksPlannedToday}.
          </p>
        </div>
      </Card>

      <Card title="Focus minutes per day">
        <WeekBars points={chart} todayKey={todayKey} />
        <p className="fg-muted">This week: {formatDuration(weekMs)}</p>
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
          label="Total focus time"
          value={formatDuration(insights.totalHours * 3_600_000)}
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

      <AchievementsCard state={state} />
    </section>
    <aside className="fg-overview__rail fg-stack" aria-label="Schedules, limits and protection">
      <SectionLabel>Your week</SectionLabel>
      <WeekStrip schedules={state.schedules} now={now.getTime()} />
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
                    label={`Daily limit used on ${row.domain}`}
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
        title="Times protection was off"
        sub="FocusGate was not running during a focus session. Last 7 days."
        status={
          <span className="fg-muted">
            {protectionGaps.count === 0
              ? "None recorded"
              : `${protectionGaps.count} · ${Math.ceil(protectionGaps.durationMs / 60_000)} min`}
          </span>
        }
      />

    </aside>
    </div>
  );
}
