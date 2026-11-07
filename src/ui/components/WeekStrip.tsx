import type { Schedule } from "../../shared/types.ts";
import { formatClock } from "../lib/scheduleSummary.ts";
import { minutesToClock, weekCoverage } from "../lib/weekCoverage.ts";

/** Monday first. `day` follows Date#getDay (0 = Sunday). */
const ROWS = [
  { day: 1, name: "Monday", short: "Mon" },
  { day: 2, name: "Tuesday", short: "Tue" },
  { day: 3, name: "Wednesday", short: "Wed" },
  { day: 4, name: "Thursday", short: "Thu" },
  { day: 5, name: "Friday", short: "Fri" },
  { day: 6, name: "Saturday", short: "Sat" },
  { day: 0, name: "Sunday", short: "Sun" },
] as const;

const TICKS = ["12a", "6a", "12p", "6p", "12a"] as const;
const MINUTES_PER_PERCENT = 14.4;

export function WeekStrip({
  schedules,
  now = Date.now(),
  locale,
}: {
  schedules: readonly Schedule[];
  now?: number;
  locale?: string;
}) {
  const coverage = weekCoverage(schedules);
  const current = new Date(now);
  const today = current.getDay();
  const nowMinutes = current.getHours() * 60 + current.getMinutes();

  return (
    <div className="fg-strip" role="group" aria-label="Your week at a glance">
      {ROWS.map(({ day, name, short }) => {
        const spans = coverage[day] ?? [];
        const description =
          spans.length === 0
            ? `${name}: not blocking`
            : `${name}: blocking ${spans
                .map(
                  (span) =>
                    `${formatClock(minutesToClock(span.startMin), locale)} – ${formatClock(
                      minutesToClock(span.endMin),
                      locale,
                    )}`,
                )
                .join(", ")}`;
        return (
          <div
            key={day}
            className="fg-strip__row"
            role="group"
            aria-label={description}
          >
            <span className="fg-strip__day" aria-hidden="true">
              {short}
            </span>
            <span className="fg-strip__track" aria-hidden="true">
              {spans.map((span) => (
                <span
                  key={`${span.startMin}-${span.endMin}`}
                  className="fg-strip__span"
                  style={{
                    left: `${span.startMin / MINUTES_PER_PERCENT}%`,
                    width: `${(span.endMin - span.startMin) / MINUTES_PER_PERCENT}%`,
                  }}
                />
              ))}
              {day === today && (
                <span
                  className="fg-strip__now"
                  style={{ left: `${nowMinutes / MINUTES_PER_PERCENT}%` }}
                />
              )}
            </span>
          </div>
        );
      })}
      <div className="fg-strip__ticks" aria-hidden="true">
        <span />
        <span className="fg-strip__tick-labels">
          {TICKS.map((label, index) => (
            <span key={index}>{label}</span>
          ))}
        </span>
      </div>
    </div>
  );
}
