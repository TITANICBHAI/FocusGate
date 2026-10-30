import { ACHIEVEMENT_DEFINITIONS } from "../../shared/achievements.ts";
import type { AppState } from "../../shared/types.ts";
import { Card, Chip } from "./primitives.tsx";

export function AchievementsCard({ state }: { state: AppState }) {
  return (
    <Card
      title="Achievements"
      description="Milestones recorded from your focus history."
    >
      <ul className="fg-list">
        {ACHIEVEMENT_DEFINITIONS.map((definition) => {
          const unlocked = state.achievements.find(
            (record) => record.id === definition.id,
          );
          return (
            <li className="fg-list-item" key={definition.id}>
              <div className="fg-list-item__copy">
                <strong>{definition.label}</strong>
                <span className="fg-muted">{definition.description}</span>
                {unlocked && (
                  <span className="fg-muted">
                    Unlocked {new Date(unlocked.unlockedAt).toLocaleDateString()}
                  </span>
                )}
              </div>
              <Chip tone={unlocked ? "accent" : "neutral"}>
                {unlocked ? "Unlocked" : "Locked"}
              </Chip>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
