import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { ExternalLink } from "lucide-react";
import { habitStreak } from "../../../shared/habits.ts";
import { localDateKey } from "../../../shared/time.ts";
import type { AppState, DayStats } from "../../../shared/types.ts";
import {
  Button,
  Card,
  Chip,
  EmptyState,
  Field,
  ListRow,
} from "../../components/primitives.tsx";
import { useToast } from "../../components/feedback.tsx";
import { uiStorageStore } from "../../hooks/storageStore.ts";
import { storageWriteErrorMessage } from "../../lib/guardPrompts.ts";
import { saveProfileFieldDefault } from "../../lib/profileActions.ts";
import type { ProfileField } from "../../lib/profileActions.ts";
import { AchievementsSection } from "./profile/AchievementsSection.tsx";
import { ProfileHeader } from "./profile/ProfileHeader.tsx";
import { ProtectingSection } from "./profile/ProtectingSection.tsx";
import { ReasonSection } from "./profile/ReasonSection.tsx";
import { TodayWeekSection } from "./profile/TodayWeekSection.tsx";
import type { RuleSection } from "./RulesScreen.tsx";
import { TasksView } from "./TasksView.tsx";

/**
 * The You screen: who you are and why (name and reason), what you are
 * protecting, today and this week, achievements, and a collapsed journal.
 */
export function YouScreen({
  state,
  density = "narrow",
  onOpenRules,
}: {
  state: AppState;
  density?: "narrow" | "wide";
  onOpenRules(section: RuleSection): void;
}) {
  const showToast = useToast();
  const now = new Date();

  function saveField(field: ProfileField, value: string): void {
    void saveProfileFieldDefault(field, value).catch((error) =>
      showToast(
        storageWriteErrorMessage(error, "This could not be saved."),
        "error",
      ),
    );
  }

  return (
    <div className="fg-stack">
      <ProfileHeader
        displayName={state.settings.displayName}
        onSave={(value) => saveField("displayName", value)}
      />
      <ReasonSection
        why={state.settings.why}
        onSave={(value) => saveField("why", value)}
      />
      <ProtectingSection
        state={state}
        now={now.getTime()}
        onOpenRules={onOpenRules}
      />
      <TodayWeekSection state={state} now={now} />
      <AchievementsSection state={state} />

      <details className="fg-journal">
        <summary className="fg-journal__summary">Journal and tasks</summary>
        <div className="fg-stack">
          <TasksView state={state} />
          <ReflectionCard state={state} />
          <HabitsCard state={state} />
        </div>
      </details>

      <Card>
        <ListRow
          title="Open full dashboard"
          sub="Stats, reports, settings, and your data in a full tab."
          actions={
            <Button
              variant="quiet"
              size="dense"
              onClick={() => {
                if (typeof chrome !== "undefined" && chrome.tabs?.create) {
                  void chrome.tabs.create({
                    url: chrome.runtime.getURL("dashboard.html"),
                  });
                }
              }}
            >
              <ExternalLink aria-hidden="true" className="fg-icon-16" />
              Open
            </Button>
          }
        />
      </Card>

      {/* density is applied by the host surface; kept for the shared-view rule */}
      <span hidden data-density={density} />
    </div>
  );
}

/** Pure update behind the Reflection card: set or clear today's mood and note. */
export function applyReflection(
  latest: Record<string, DayStats>,
  todayKey: string,
  changes: { mood?: number | null; note?: string | null },
): Record<string, DayStats> {
  const current: DayStats =
    latest[todayKey] ??
    {
      dateKey: todayKey,
      focusMs: 0,
      sessionsCompleted: 0,
      sessionsAbandoned: 0,
      blocks: 0,
      blocksByDomain: {},
      tasksCompleted: 0,
    };
  return {
    ...latest,
    [todayKey]: {
      ...current,
      ...(changes.mood !== undefined
        ? { mood: changes.mood === null ? undefined : changes.mood }
        : {}),
      ...(changes.note !== undefined
        ? { note: changes.note ? changes.note : undefined }
        : {}),
    },
  };
}

function ReflectionCard({ state }: { state: AppState }) {
  const showToast = useToast();
  const todayKey = localDateKey(new Date());
  const today = state.dayStats[todayKey];
  const [noteDraft, setNoteDraft] = useState(today?.note ?? "");

  useEffect(() => {
    setNoteDraft(today?.note ?? "");
  }, [today?.note]);

  function saveReflection(changes: { mood?: number | null; note?: string | null }) {
    void uiStorageStore
      .set("dayStats", (latest) => applyReflection(latest, todayKey, changes))
      .then(() => showToast("Reflection saved.", "success"))
      .catch((error) =>
        showToast(
          storageWriteErrorMessage(error, "The reflection could not be saved."),
          "error",
        ),
      );
  }

  return (
    <Card
      title="Reflection"
      description="Optional mood and note, stored for the day."
    >
      <div className="fg-wrap" role="group" aria-label="Mood">
        {[1, 2, 3, 4, 5].map((value) => (
          <Button
            key={value}
            variant={today?.mood === value ? "primary" : "secondary"}
            size="dense"
            aria-pressed={today?.mood === value}
            onClick={() => saveReflection({ mood: value })}
          >
            {value}
          </Button>
        ))}
      </div>
      <Field id="reflection-note" label="Note">
        <textarea
          id="reflection-note"
          className="fg-textarea"
          value={noteDraft}
          maxLength={500}
          placeholder="How did the day go?"
          onChange={(event) => setNoteDraft(event.target.value)}
          onBlur={() => {
            if ((today?.note ?? "") !== noteDraft) {
              saveReflection({ note: noteDraft });
            }
          }}
        />
      </Field>
      {(today?.mood !== undefined || (today?.note ?? "").length > 0) && (
        <Button
          variant="quiet"
          onClick={() => {
            setNoteDraft("");
            saveReflection({ mood: null, note: null });
          }}
        >
          Clear today's reflection
        </Button>
      )}
    </Card>
  );
}

function HabitsCard({ state }: { state: AppState }) {
  const showToast = useToast();
  const todayKey = localDateKey(new Date());
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("📌");

  async function addHabit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) {
      showToast("Give the habit a name.", "error");
      return;
    }
    const habit = {
      id: crypto.randomUUID(),
      name: cleanName.slice(0, 60),
      emoji: emoji.trim().slice(0, 8) || "📌",
      createdAt: Date.now(),
    };
    try {
      await uiStorageStore.set("habits", (latest) => [...latest, habit]);
      setName("");
      setEmoji("📌");
      showToast("Habit added.", "success");
    } catch (error) {
      showToast(storageWriteErrorMessage(error, "The habit could not be saved."), "error");
    }
  }

  async function removeHabit(id: string) {
    try {
      await uiStorageStore.set("habits", (latest) => latest.filter((item) => item.id !== id));
      await uiStorageStore.set("habitEntries", (latest) => {
        const next = { ...latest };
        delete next[id];
        return next;
      });
      showToast("Habit removed.", "success");
    } catch (error) {
      showToast(storageWriteErrorMessage(error, "The habit could not be removed."), "error");
    }
  }

  async function toggleCheckIn(id: string) {
    try {
      await uiStorageStore.set("habitEntries", (latest) => {
        const checked = new Set(latest[id] ?? []);
        if (checked.has(todayKey)) checked.delete(todayKey);
        else checked.add(todayKey);
        return { ...latest, [id]: [...checked].sort() };
      });
    } catch (error) {
      showToast(storageWriteErrorMessage(error, "The check-in could not be saved."), "error");
    }
  }

  return (
    <Card title="Habits" description="Daily check-ins with a per-habit streak.">
      {state.habits.length === 0 ? (
        <EmptyState
          title="No habits yet"
          description="Add a habit to check it in every day."
        />
      ) : (
        <div className="fg-list">
          {state.habits.map((habit) => {
            const entries = state.habitEntries[habit.id] ?? [];
            const streak = habitStreak(entries, todayKey);
            const checkedToday = entries.includes(todayKey);
            return (
              <ListRow
                key={habit.id}
                swatch={habit.emoji}
                title={habit.name}
                sub={streak === 1 ? "1-day streak" : `${streak}-day streak`}
                status={
                  <Chip tone={checkedToday ? "live" : "neutral"}>
                    {checkedToday ? "Checked in" : "Not yet"}
                  </Chip>
                }
                actions={
                  <>
                    <Button
                      variant={checkedToday ? "quiet" : "secondary"}
                      size="dense"
                      onClick={() => void toggleCheckIn(habit.id)}
                    >
                      {checkedToday ? "Undo" : "Check in"}
                    </Button>
                    <Button
                      variant="quiet"
                      size="dense"
                      aria-label={`Remove ${habit.name}`}
                      onClick={() => void removeHabit(habit.id)}
                    >
                      Remove
                    </Button>
                  </>
                }
              />
            );
          })}
        </div>
      )}
      <form className="fg-wrap" onSubmit={(event) => void addHabit(event)}>
        <input
          className="fg-input fg-grow"
          value={name}
          maxLength={60}
          placeholder="Read 20 pages"
          aria-label="Habit name"
          onChange={(event) => setName(event.target.value)}
          required
        />
        <input
          className="fg-input fg-w-64"
          value={emoji}
          maxLength={8}
          aria-label="Habit emoji"
          onChange={(event) => setEmoji(event.target.value)}
        />
        <Button variant="secondary" size="dense" type="submit">
          Add
        </Button>
      </form>
    </Card>
  );
}
