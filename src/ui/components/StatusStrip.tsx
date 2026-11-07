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
  return (
    <section className={`fg-nowline fg-nowline--${summary.tone}`} role="status">
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
