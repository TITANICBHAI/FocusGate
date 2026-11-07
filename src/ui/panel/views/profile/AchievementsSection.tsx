import { ACHIEVEMENT_DEFINITIONS } from "../../../../shared/achievements.ts";
import type { AppState } from "../../../../shared/types.ts";
import { Chip } from "../../../components/primitives.tsx";

export function AchievementsSection({ state }: { state: AppState }) {
  const unlocked = new Set(state.achievements.map((record) => record.id));
  const unlockedCount = ACHIEVEMENT_DEFINITIONS.filter((definition) =>
    unlocked.has(definition.id),
  ).length;
  return (
    <section className="fg-profile-group" aria-labelledby="profile-achievements-title">
      <h3 id="profile-achievements-title" className="fg-card__title">
        Achievements
      </h3>
      <ul className="fg-achievements" aria-label="Achievements">
        {ACHIEVEMENT_DEFINITIONS.map((definition) => {
          const done = unlocked.has(definition.id);
          return (
            <li key={definition.id} className="fg-achievements__item">
              <span className="fg-achievements__copy">
                <strong>{definition.label}</strong>
                <span>{definition.description}</span>
              </span>
              <Chip tone={done ? "live" : "neutral"}>{done ? "Unlocked" : "Locked"}</Chip>
            </li>
          );
        })}
      </ul>
      <p className="fg-field__helper">
        {unlockedCount} of {ACHIEVEMENT_DEFINITIONS.length} unlocked.
      </p>
    </section>
  );
}
