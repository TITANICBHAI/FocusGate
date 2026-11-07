import { useEffect, useRef } from "react";
import { isBlockingActive } from "../../shared/plan.ts";
import type { AppState } from "../../shared/types.ts";
import type { HeaderPill, StatusSummary } from "../lib/statusSummary.ts";
import { Button } from "./primitives.tsx";

/** The label for the header pill, taken from the same summary as the strip. */
export function pillFor(
  summary: StatusSummary,
  state: AppState,
  nowMs: number,
): HeaderPill {
  if (summary.tone === "break") return { label: "Break", tone: "break" };
  if (summary.tone === "idle") {
    // The Always list and keywords can block while nothing else is running.
    return {
      label: isBlockingActive(state, nowMs) ? "Blocking" : "Not blocking",
      tone: "idle",
    };
  }
  return { label: "Blocking", tone: summary.tone };
}

type Tone = StatusSummary["tone"];

/**
 * The gate closes when blocking starts: the strip's bar sweeps once. Not on
 * the first render, and not when one blocking state changes into another.
 */
export function shouldSweep(previous: Tone | undefined, next: Tone): boolean {
  if (previous === undefined) return false;
  const wasOff = previous === "idle" || previous === "break";
  const nowOn = next === "focus" || next === "locked" || next === "schedule";
  return wasOff && nowOn;
}

/**
 * One calm sentence about what FocusGate is doing now. It is a live region, so
 * a change is read out. The call to action is never a primary button: the
 * Focus screen owns the single primary action.
 */
export function StatusStrip({
  summary,
  onCta,
}: {
  summary: StatusSummary;
  onCta?(target: "rules" | "schedule"): void;
}) {
  const previous = useRef<Tone | undefined>(undefined);
  const sweep = shouldSweep(previous.current, summary.tone);
  useEffect(() => {
    previous.current = summary.tone;
  });
  return (
    <section
      className={`fg-nowline fg-nowline--${summary.tone}${sweep ? " fg-nowline--sweep" : ""}`}
      role="status"
    >
      <p className="fg-nowline__headline">{summary.headline}</p>
      <p className="fg-nowline__detail">{summary.detail}</p>
      {summary.secondary.map((line) => (
        <p key={line} className="fg-nowline__detail">
          {line}
        </p>
      ))}
      {summary.cta && (
        <div className="fg-nowline__cta">
          <Button
            variant="secondary"
            size="dense"
            onClick={() => summary.cta && onCta?.(summary.cta.target)}
          >
            {summary.cta.label}
          </Button>
        </div>
      )}
    </section>
  );
}
