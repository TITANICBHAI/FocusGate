import { ACHIEVEMENT_DEFINITIONS } from "../../shared/achievements.ts";
import type { AppState } from "../../shared/types.ts";
import { Card, Chip, ListRow } from "./primitives.tsx";

export function AchievementsCard({ state }: { state: AppState }) {
  return (
    <Card
      title="Achievements"
      description="Milestones recorded from your focus history."
    >
      {ACHIEVEMENT_DEFINITIONS.map((definition) => {
        const unlocked = state.achievements.find(
          (record) => record.id === definition.id,
        );
        return (
          <ListRow
            key={definition.id}
            title={definition.label}
            sub={
              <>
                {definition.description}
                {unlocked && (
                  <span className="fg-muted">
                    Unlocked {new Date(unlocked.unlockedAt).toLocaleDateString()}
                  </span>
                )}
              </>
            }
            status={
              unlocked ? (
                <Chip tone="live">Unlocked</Chip>
              ) : (
                <span className="fg-muted">Locked</span>
              )
            }
          />
        );
      })}
    </Card>
  );
}
