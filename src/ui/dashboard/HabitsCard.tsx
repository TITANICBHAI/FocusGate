import { useState } from "react";
import type { FormEvent } from "react";
import { habitStreak } from "../../shared/habits.ts";
import { localDateKey } from "../../shared/time.ts";
import type { AppState, Habit } from "../../shared/types.ts";
import {
  Button,
  Card,
  Chip,
  EmptyState,
  Field,
} from "../components/primitives.tsx";
import { useToast } from "../components/feedback.tsx";
import { uiStorageStore } from "../hooks/storageStore.ts";
import { storageWriteErrorMessage } from "../lib/guardPrompts.ts";

export function HabitsCard({ state }: { state: AppState }) {
  const showToast = useToast();
  const todayKey = localDateKey(Date.now());
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("📌");

  async function addHabit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) {
      showToast("Give the habit a name.", "error");
      return;
    }
    const habit: Habit = {
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
      showToast(
        storageWriteErrorMessage(error, "The habit could not be saved."),
        "error",
      );
    }
  }

  async function removeHabit(habit: Habit) {
    try {
      await uiStorageStore.set("habits", (latest) =>
        latest.filter((item) => item.id !== habit.id),
      );
      await uiStorageStore.set("habitEntries", (latest) => {
        const next = { ...latest };
        delete next[habit.id];
        return next;
      });
      showToast("Habit removed.", "success");
    } catch (error) {
      showToast(
        storageWriteErrorMessage(error, "The habit could not be removed."),
        "error",
      );
    }
  }

  async function toggleCheckIn(habit: Habit) {
    try {
      await uiStorageStore.set("habitEntries", (latest) => {
        const checked = new Set(latest[habit.id] ?? []);
        if (checked.has(todayKey)) checked.delete(todayKey);
        else checked.add(todayKey);
        return { ...latest, [habit.id]: [...checked].sort() };
      });
    } catch (error) {
      showToast(
        storageWriteErrorMessage(error, "The check-in could not be saved."),
        "error",
      );
    }
  }

  return (
    <Card
      title="Habits"
      description="Daily check-ins with a per-habit streak."
    >
      {state.habits.length === 0 ? (
        <EmptyState
          title="No habits yet"
          description="Add a habit to check it in every day."
        />
      ) : (
        <ul className="fg-list">
          {state.habits.map((habit) => {
            const entries = state.habitEntries[habit.id] ?? [];
            const streak = habitStreak(entries, todayKey);
            const checkedToday = entries.includes(todayKey);
            return (
              <li className="fg-list-item" key={habit.id}>
                <div className="fg-list-item__copy">
                  <strong>
                    {habit.emoji} {habit.name}
                  </strong>
                  <span className="fg-muted">
                    {streak === 1 ? "1-day streak" : `${streak}-day streak`}
                  </span>
                </div>
                <div className="fg-list-item__actions">
                  <Chip tone={checkedToday ? "accent" : "neutral"}>
                    {checkedToday ? "Checked in" : "Not yet today"}
                  </Chip>
                  <Button
                    variant={checkedToday ? "quiet" : "secondary"}
                    onClick={() => void toggleCheckIn(habit)}
                  >
                    {checkedToday ? "Undo" : "Check in"}
                  </Button>
                  <Button
                    variant="quiet"
                    aria-label={`Remove ${habit.name}`}
                    onClick={() => void removeHabit(habit)}
                  >
                    Remove
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <form className="fg-stack" onSubmit={(event) => void addHabit(event)}>
        <div className="fg-grid-two">
          <Field id="habit-name" label="Habit">
            <input
              id="habit-name"
              value={name}
              maxLength={60}
              placeholder="Read 20 pages"
              onChange={(event) => setName(event.target.value)}
              required
            />
          </Field>
          <Field id="habit-emoji" label="Emoji">
            <input
              id="habit-emoji"
              value={emoji}
              maxLength={8}
              onChange={(event) => setEmoji(event.target.value)}
            />
          </Field>
        </div>
        <Button type="submit" variant="secondary">
          Add habit
        </Button>
      </form>
    </Card>
  );
}
