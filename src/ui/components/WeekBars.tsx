import type { DayFocusPoint } from "../../shared/stats.ts";

function parts(dateKey: string, locale?: string): { weekday: string; day: string } {
  const date = new Date(`${dateKey}T12:00:00`);
  return {
    weekday: date.toLocaleDateString(locale, { weekday: "short" }),
    day: `${date.getDate()} ${date.toLocaleDateString(locale, { month: "short" })}`,
  };
}

/** One sentence that says what the chart shows, for screen readers and captions. */
export function weekSummary(points: readonly DayFocusPoint[], locale?: string): string {
  const total = points.reduce((sum, point) => sum + point.minutes, 0);
  const head = `Focus minutes for the last ${points.length} days:`;
  if (total === 0) return `${head} none recorded.`;
  const best = points.reduce((top, point) => (point.minutes > top.minutes ? point : top));
  return `${head} ${total} minutes in total. Highest day: ${parts(best.dateKey, locale).weekday} with ${best.minutes} minutes.`;
}

/**
 * Full-width bars, one per day, with weekday labels. A value is printed only
 * on the tallest bar and on today's. Each bar can be focused and reads out
 * its own minutes.
 */
export function WeekBars({
  points,
  todayKey,
  locale,
}: {
  points: readonly DayFocusPoint[];
  todayKey: string;
  locale?: string;
}) {
  const max = Math.max(1, ...points.map((point) => point.minutes));
  const best = points.reduce(
    (top, point) => (point.minutes > top.minutes ? point : top),
    points[0] ?? { dateKey: "", minutes: 0 },
  );
  return (
    <ol className="fg-weekbars" aria-label={weekSummary(points, locale)}>
      {points.map((point) => {
        const { weekday, day } = parts(point.dateKey, locale);
        const today = point.dateKey === todayKey;
        const showValue = point.minutes > 0 && (today || point.dateKey === best.dateKey);
        const name = `${weekday} ${day}${today ? ", today" : ""}`;
        return (
          <li
            key={point.dateKey}
            tabIndex={0}
            className={`fg-weekbars__item${today ? " fg-weekbars__item--today" : ""}`}
            aria-label={`${name}: ${point.minutes > 0 ? `${point.minutes} minutes` : "no focus"}`}
          >
            <span className="fg-weekbars__value">{showValue ? `${point.minutes}m` : ""}</span>
            <span className="fg-weekbars__track">
              <span
                className="fg-weekbars__bar"
                style={{ height: `${Math.round((point.minutes / max) * 100)}%` }}
              />
            </span>
            <span className="fg-weekbars__label">{weekday}</span>
          </li>
        );
      })}
    </ol>
  );
}
