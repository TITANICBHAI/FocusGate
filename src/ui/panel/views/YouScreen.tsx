import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { ExternalLink } from "lucide-react";
import {
  ACHIEVEMENT_DEFINITIONS,
} from "../../../shared/achievements.ts";
import { habitStreak } from "../../../shared/habits.ts";
import { calculateStreaks, focusMinutesPerDay } from "../../../shared/stats.ts";
import { localDateKey } from "../../../shared/time.ts";
import type { AppState, DayStats } from "../../../shared/types.ts";
import {
  Button,
  Card,
  Chip,
  EmptyState,
  Field,
  ListRow,
  Progress,
  Stat,
} from "../../components/primitives.tsx";
import { useToast } from "../../components/feedback.tsx";
import { uiStorageStore } from "../../hooks/storageStore.ts";
import { storageWriteErrorMessage } from "../../lib/guardPrompts.ts";

/**
 * P4 You screen (design.md §5.4): today's stats and reflection, the week
 * chart, achievements, habits, and the dashboard link.
 */
export function YouScreen({
  state,
  density = "narrow",
}: {
  state: AppState;
  density?: "narrow" | "wide";
}) {
  const now = new Date();
  const todayKey = localDateKey(now);
  const today = state.dayStats[todayKey];
  const streaks = calculateStreaks(state.sessionHistory, now);
  const goalMs = Math.max(1, state.settings.dailyGoalMin) * 60_000;
  const goalPct = Math.min(1, (today?.focusMs ?? 0) / goalMs);

  const week = focusMinutesPerDay(
    state.dayStats,
    localDateKeyOf(new Date(now.getTime() - 6 * 86_400_000)),
    todayKey,
  );
  const weekFocusMinutes = week.reduce((total, point) => total + point.minutes, 0);
  const weekSessions = Object.values(state.dayStats)
    .filter((day) => day.dateKey >= localDateKeyOf(new Date(now.getTime() - 6 * 86_400_000)) && day.dateKey <= todayKey)
    .reduce((total, day) => total + day.sessionsCompleted, 0);
  const chartMax = Math.max(30, ...week.map((point) => point.minutes));

  const unlockedCount = ACHIEVEMENT_DEFINITIONS.filter((definition) =>
    state.achievements.some((record) => record.id === definition.id),
  ).length;

  return (
    <div className="fg-stack">
      <Card title="Today">
        <div className="fg-stat-row">
          <Stat
            label="Focused"
            value={`${Math.round((today?.focusMs ?? 0) / 60_000)}m`}
          />
          <Stat label="Goal" value={`${Math.round(goalPct * 100)}%`} />
          <Stat label="Streak" value={`${streaks.current}d`} />
          <Stat label="Best" value={`${streaks.best}d`} />
        </div>
        <div className="fg-hero__progress">
          <Progress value={goalPct} />
        </div>
      </Card>

      <Card title="This week">
        <svg
          role="img"
          aria-label={`Focus minutes for the last 7 days; the highest day reached ${chartMax} minutes.`}
          viewBox={`0 0 ${week.length * 28} 120`}
          style={{ width: "100%", height: 110, color: "var(--accent)" }}
        >
          {week.map((point, index) => {
            const height = Math.round((point.minutes / chartMax) * 90);
            return (
              <g key={point.dateKey}>
                <rect
                  x={index * 28 + 6}
                  y={100 - height}
                  width={16}
                  height={Math.max(point.minutes > 0 ? 2 : 0, height)}
                  rx={2}
                  fill="currentColor"
                  opacity={0.85}
                />
                <text x={index * 28 + 14} y={114} textAnchor="middle" fontSize={9}>
                  {point.dateKey.slice(8)}
                </text>
              </g>
            );
          })}
        </svg>
        <div className="fg-stat-row">
          <Stat label="Sessions" value={weekSessions} />
          <Stat
            label="Focused"
            value={`${Math.floor(weekFocusMinutes / 60)}h ${weekFocusMinutes % 60}m`}
          />
        </div>
      </Card>

      <ReflectionCard state={state} />

      <Card title="Achievements">
        <div className="fg-wrap">
          {ACHIEVEMENT_DEFINITIONS.map((definition) => {
            const unlocked = state.achievements.some(
              (record) => record.id === definition.id,
            );
            return (
              <Chip key={definition.id} tone={unlocked ? "live" : "neutral"}>
                {definition.label}
              </Chip>
            );
          })}
        </div>
        <p className="fg-field__helper">
          {unlockedCount} of {ACHIEVEMENT_DEFINITIONS.length} unlocked.
        </p>
      </Card>

      <HabitsCard state={state} />

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
              <ExternalLink aria-hidden="true" style={{ width: 16, height: 16 }} />
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

function localDateKeyOf(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
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
      .set("dayStats", (latest) => {
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
              ? { note: changes.note.length > 0 ? changes.note : undefined }
              : {}),
          },
        };
      })
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
          className="fg-input"
          style={{ flex: 1 }}
          value={name}
          maxLength={60}
          placeholder="Read 20 pages"
          aria-label="Habit name"
          onChange={(event) => setName(event.target.value)}
          required
        />
        <input
          className="fg-input"
          style={{ flex: "none", width: 64 }}
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
