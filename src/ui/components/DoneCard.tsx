import type { CSSProperties } from "react";
import { X } from "lucide-react";
import type { DoneCard } from "../../shared/celebration.ts";
import { IconButton } from "./primitives.tsx";

const RING_SIZE = 56;
const RING_STROKE = 6;

/** Sideways drift and start delay for each rising dot. Set once; the rise runs one time. */
const DOTS: ReadonlyArray<{ dx: number; delay: number }> = [
  { dx: -30, delay: 0 },
  { dx: -18, delay: 120 },
  { dx: -6, delay: 40 },
  { dx: 6, delay: 180 },
  { dx: 18, delay: 80 },
  { dx: 30, delay: 200 },
  { dx: 0, delay: 260 },
];

/**
 * The daily goal ring. It is drawn at its final fill; the fill from where the
 * day stood before this session is a CSS keyframe, which does not run when the
 * person has asked for less motion.
 */
export function GoalRing({ before, after }: { before: number; after: number }) {
  const radius = (RING_SIZE - RING_STROKE) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamp = (value: number): number => Math.max(0, Math.min(1, value));
  const percent = Math.round(clamp(after) * 100);
  const style = {
    "--ring-from": circumference * (1 - clamp(before)),
    strokeDashoffset: circumference * (1 - clamp(after)),
  } as CSSProperties;
  return (
    <div
      className="fg-goal-ring"
      role="img"
      aria-label={`Daily goal: ${percent}%`}
      style={{ width: RING_SIZE, height: RING_SIZE }}
    >
      <svg aria-hidden="true" viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}>
        <circle
          className="fg-goal-ring__track"
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={radius}
          fill="none"
          strokeWidth={RING_STROKE}
        />
        <circle
          className="fg-goal-ring__value"
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={radius}
          fill="none"
          strokeWidth={RING_STROKE}
          strokeDasharray={circumference}
          style={style}
          transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
        />
      </svg>
      <span className="fg-goal-ring__percent" aria-hidden="true">
        {percent}%
      </span>
    </div>
  );
}

/** What FocusGate says when a session ends. A stopped session gets a plain card. */
export function DoneCardView({ card, onDismiss }: { card: DoneCard; onDismiss(): void }) {
  return (
    <section className={`fg-done fg-done--${card.kind}`} aria-label="Session summary">
      {card.goal && <GoalRing before={card.goal.before} after={card.goal.after} />}
      <div className="fg-done__body">
        <h2 className="fg-done__headline">{card.headline}</h2>
        {card.line && <p className="fg-done__line">{card.line}</p>}
        {card.goal?.reached && (
          <p className="fg-goal-pill" role="status">
            <span className="fg-goal-dots" aria-hidden="true">
              {DOTS.map((dot) => (
                <span
                  key={dot.dx}
                  className="fg-goal-dots__dot"
                  style={{ "--dx": `${dot.dx}px`, "--delay": `${dot.delay}ms` } as CSSProperties}
                />
              ))}
            </span>
            Daily goal reached
          </p>
        )}
        {card.achievements.length > 0 && (
          <p className="fg-done__extra">Unlocked: {card.achievements.join(", ")}</p>
        )}
        {card.breakTip && <p className="fg-done__extra">{card.breakTip}</p>}
      </div>
      <IconButton label="Dismiss" className="fg-done__dismiss" onClick={onDismiss}>
        <X aria-hidden="true" />
      </IconButton>
    </section>
  );
}
