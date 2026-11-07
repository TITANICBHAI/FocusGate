import type { AppState } from "../../../../shared/types.ts";
import {
  protectionRows,
  rowAccessibleName,
} from "../../../lib/profileSummary.ts";
import type { RuleSection } from "../RulesScreen.tsx";

export function ProtectingSection({
  state,
  now,
  onOpenRules,
}: {
  state: AppState;
  now: number;
  onOpenRules(section: RuleSection): void;
}) {
  const rows = protectionRows(state, now);
  return (
    <section className="fg-profile-group" aria-labelledby="profile-protecting-title">
      <h3 id="profile-protecting-title" className="fg-card__title">
        What you're protecting
      </h3>
      <div className="fg-list">
        {rows.map((row) => {
          const copy = (
            <>
              <span className="fg-prot-row__label">{row.label}</span>
              <span className="fg-prot-row__value">{row.value}</span>
            </>
          );
          const section = row.section;
          return section === null ? (
            <div key={row.id} className="fg-prot-row">
              {copy}
            </div>
          ) : (
            <button
              key={row.id}
              type="button"
              className="fg-prot-row fg-prot-row--button"
              aria-label={rowAccessibleName(row)}
              onClick={() => onOpenRules(section)}
            >
              {copy}
            </button>
          );
        })}
      </div>
    </section>
  );
}
