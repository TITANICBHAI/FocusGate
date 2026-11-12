import { useEffect, useRef } from "react";
import { isBlockingActive } from "../../shared/plan.ts";
import type { AppState } from "../../shared/types.ts";
import type { HeaderPill, StatusSummary } from "../lib/statusSummary.ts";
import { useHiddenHints } from "../hooks/useHiddenHints.ts";
import { Button, IconButton } from "./primitives.tsx";
import { X } from "lucide-react";

/** The label for the header pill, taken from the same summary as the strip. */
export function pillFor(
  summary: StatusSummary,
  state: AppState,
  nowMs: number,
): HeaderPill {
  if (summary.tone === "break") return { label: "Break", tone: "break" };
  if (summary.tone === "idle") {
    // describeNow reports the Always list, keywords and limits as "standing".
    // This keeps the pill honest if a caller passes a summary from before.
    return isBlockingActive(state, nowMs)
      ? { label: "Blocking", tone: "standing" }
      : { label: "Not blocking", tone: "idle" };
  }
  return { label: "Blocking", tone: summary.tone };
}

type Tone = StatusSummary["tone"];

/** The hidden-hint id for the "nothing is on" message. */
const IDLE_HINT = "status-idle";

/**
 * The gate closes when blocking starts: the strip's bar sweeps once. Not on
 * the first render, and not when one blocking state changes into another.
 */
export function shouldSweep(previous: Tone | undefined, next: Tone): boolean {
  if (previous === undefined) return false;
  const wasOff = previous === "idle" || previous === "break";
  const nowOn =
    next === "focus" || next === "locked" || next === "schedule" || next === "standing";
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
  const hints = useHiddenHints();
  const sweep = shouldSweep(previous.current, summary.tone);
  useEffect(() => {
    previous.current = summary.tone;
  });
  // Only the "nothing is on" message can be hidden. A message about blocking
  // that is on always shows, so the strip never hides a rule that is working.
  const hideable = summary.tone === "idle";
  if (hideable && hints.isHidden(IDLE_HINT)) return null;
  return (
    <section
      className={`fg-nowline fg-nowline--${summary.tone}${sweep ? " fg-nowline--sweep" : ""}`}
      role="status"
    >
      {hideable && (
        <IconButton
          label="Hide this message"
          className="fg-nowline__dismiss"
          onClick={() => hints.setHidden(IDLE_HINT, true)}
        >
          <X aria-hidden="true" />
        </IconButton>
      )}
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
