import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import type {
  AppState,
  LockLevel,
  Task,
  TaskPriority,
  TaskRecurrence,
} from "../../shared/types.ts";
import { Button, Card, EmptyState, Field, Chip } from "../components/primitives.tsx";
import { ConfirmDialog, Modal, useToast } from "../components/feedback.tsx";
import { sendSessionMessage } from "../lib/sessionActions.ts";
import { uiStorageStore } from "../hooks/storageStore.ts";
import { storageWriteErrorMessage } from "../lib/guardPrompts.ts";
import {
  generateRecurringForToday,
  groupTasksForDate,
  taskDurationForStart,
  type TaskGroupKey,
} from "../../shared/taskScheduling.ts";

const TASK_GROUPS: Array<{ key: TaskGroupKey; label: string }> = [
  { key: "overdue", label: "Overdue" },
  { key: "now", label: "Now" },
  { key: "upNext", label: "Up next" },
  { key: "later", label: "Later" },
  { key: "noTime", label: "No time" },
  { key: "completed", label: "Completed" },
];

function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

function shiftDateKey(dateKey: string, amount: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day! + amount));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(
    date.getUTCDate(),
  ).padStart(2, "0")}`;
}

function notifyTasksChanged(): void {
  if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) return;
  void chrome.runtime.sendMessage({ type: "tasks/changed" }).catch(() => undefined);
}

export function TasksView({ state }: { state: AppState }) {
  const showToast = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [durationMin, setDurationMin] = useState("25");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [lockLevel, setLockLevel] = useState<LockLevel>("none");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [tagsText, setTagsText] = useState("");
  const [recurring, setRecurring] = useState<TaskRecurrence>("none");
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const todayKey = localDateKey(new Date(now));
  const [selectedDate, setSelectedDate] = useState(todayKey);

  const runningTaskId =
    state.session.status === "idle" ? null : state.session.taskId;

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const generated = generateRecurringForToday(state.tasks, todayKey, now);
    if (generated.length === 0) return;
    void uiStorageStore
      .set("tasks", (latest) => [
        ...generateRecurringForToday(latest, todayKey, now),
        ...latest,
      ])
      .then(notifyTasksChanged)
      .catch((error) =>
        showToast(
          storageWriteErrorMessage(error, "Recurring tasks could not be generated."),
          "error",
        ),
      );
  }, [now, showToast, state.tasks, todayKey]);

  function openEditor(task?: Task) {
    setEditingTaskId(task?.id ?? null);
    setTitle(task?.title ?? "");
    setDescription(task?.description ?? "");
    setDurationMin(String(task?.durationMin ?? state.settings.defaultDurationMin));
    setScheduledDate(task?.scheduledDate ?? "");
    setScheduledTime(task?.scheduledTime ?? "");
    setLockLevel(task?.lockLevel ?? "none");
    setPriority(task?.priority ?? "medium");
    setTagsText(task?.tags.join(", ") ?? "");
    setRecurring(task?.recurring ?? "none");
    setAddOpen(true);
  }

  async function saveTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanTitle = title.trim();
    const duration = Number(durationMin);
    if (!cleanTitle) {
      showToast("Add a task name first.", "error");
      return;
    }
    if (!Number.isInteger(duration) || duration < 1 || duration > 999) {
      showToast("Choose a duration from 1 to 999 minutes.", "error");
      return;
    }
    if (recurring !== "none" && !scheduledDate) {
      showToast("Add a date before setting a recurrence.", "error");
      return;
    }
    const previous = state.tasks.find((item) => item.id === editingTaskId);
    const tags = [...new Set(
      tagsText
        .split(/[,\n]/)
        .map((tag) => tag.trim())
        .filter(Boolean)
        .map((tag) => tag.slice(0, 32)),
    )].slice(0, 10);
    const isRecurringOccurrence =
      previous?.templateId !== undefined &&
      previous.templateId !== previous.id;
    const task: Task = {
      ...(previous ?? {}),
      id: previous?.id ?? crypto.randomUUID(),
      title: cleanTitle,
      ...(description.trim() ? { description: description.trim() } : { description: undefined }),
      durationMin: duration,
      ...(scheduledDate ? { scheduledDate } : {}),
      ...(!scheduledDate ? { scheduledDate: undefined } : {}),
      ...(scheduledTime ? { scheduledTime } : {}),
      ...(!scheduledTime ? { scheduledTime: undefined } : {}),
      priority,
      tags,
      recurring: isRecurringOccurrence ? previous.recurring : recurring,
      lockLevel,
      completed: previous?.completed ?? false,
      createdAt: previous?.createdAt ?? Date.now(),
    };
    try {
      await uiStorageStore.set("tasks", (latest) =>
        previous
          ? latest.map((item) => (item.id === previous.id ? task : item))
          : [task, ...latest],
      );
      notifyTasksChanged();
      setTitle("");
      setDescription("");
      setDurationMin("25");
      setScheduledDate("");
      setScheduledTime("");
      setPriority("medium");
      setTagsText("");
      setRecurring("none");
      setEditingTaskId(null);
      setAddOpen(false);
      showToast(previous ? "Task updated." : "Task added.", "success");
    } catch (error) {
      showToast(storageWriteErrorMessage(error, "The task could not be saved."), "error");
    }
  }

  async function toggleCompleted(task: Task) {
    if (runningTaskId === task.id) {
      showToast("This task is linked to the running session.", "info");
      return;
    }
    try {
      await uiStorageStore.set("tasks", (latest) =>
        latest.map((item) =>
          item.id === task.id
            ? {
                ...item,
                completed: !item.completed,
                ...(item.completed ? {} : { completedAt: Date.now() }),
                ...(item.completed ? { completedAt: undefined } : {}),
              }
            : item,
        ),
      );
      notifyTasksChanged();
    } catch (error) {
      showToast(storageWriteErrorMessage(error, "The task could not be updated."), "error");
    }
  }

  async function startTask(task: Task) {
    if (state.session.status !== "idle") {
      showToast("End the current session before starting a task.", "info");
      return;
    }
    try {
      if (task.completed) {
        await uiStorageStore.set("tasks", (latest) =>
          latest.map((item) =>
            item.id === task.id
              ? { ...item, completed: false, completedAt: undefined }
              : item,
          ),
        );
      }
      const reply = await sendSessionMessage({
        type: "session/start",
        durationMin: taskDurationForStart(task, Date.now()),
        lockLevel: task.lockLevel,
        taskId: task.id,
      });
      if (!reply.ok) {
        if (task.completed) {
          await uiStorageStore.set("tasks", (latest) =>
            latest.map((item) =>
              item.id === task.id
                ? { ...item, completed: true, completedAt: task.completedAt }
                : item,
            ),
          );
        }
        showToast(reply.message ?? "This task could not be started.", "error");
        return;
      }
      showToast("Task session started.", "success");
    } catch (error) {
      showToast(storageWriteErrorMessage(error, "This task could not be started."), "error");
    }
  }

  async function removeTask() {
    if (!deleteTarget) return;
    if (runningTaskId === deleteTarget.id) {
      showToast("This task is linked to the running session.", "info");
      setDeleteTarget(null);
      return;
    }
    try {
      await uiStorageStore.set("tasks", (latest) =>
        latest.filter((task) => task.id !== deleteTarget.id),
      );
      notifyTasksChanged();
      showToast("Task removed.", "success");
    } catch (error) {
      showToast(storageWriteErrorMessage(error, "The task could not be removed."), "error");
    }
    setDeleteTarget(null);
  }

  const groups = groupTasksForDate(state.tasks, selectedDate, now);
  const hasVisibleTasks = TASK_GROUPS.some(({ key }) => groups[key].length > 0);
  const selectedDateLabel =
    selectedDate === todayKey
      ? "Today"
      : new Date(`${selectedDate}T12:00:00`).toLocaleDateString([], {
          weekday: "long",
          month: "short",
          day: "numeric",
        });

  return (
    <section className="fg-page" aria-labelledby="tasks-title">
      <div className="fg-page__heading">
        <div>
          <h1 id="tasks-title">Tasks</h1>
          <p className="fg-muted">Plan a task and give it a focused session.</p>
        </div>
        <Button onClick={() => openEditor()}>Add task</Button>
      </div>

      <Card title={selectedDateLabel}>
        <div className="fg-wrap">
          <Button
            variant="secondary"
            aria-label="Previous day"
            onClick={() => setSelectedDate((current) => shiftDateKey(current, -1))}
          >
            Previous day
          </Button>
          {selectedDate !== todayKey && (
            <Button variant="quiet" onClick={() => setSelectedDate(todayKey)}>
              Today
            </Button>
          )}
          <Button
            variant="secondary"
            aria-label="Next day"
            onClick={() => setSelectedDate((current) => shiftDateKey(current, 1))}
          >
            Next day
          </Button>
        </div>
      </Card>

      {!hasVisibleTasks ? (
        <EmptyState
          title="No tasks yet"
          description="Add one to plan your next focus session."
          action={<Button onClick={() => openEditor()}>Add a task</Button>}
        />
      ) : (
        <div className="fg-stack">
          {TASK_GROUPS.map(({ key, label }) =>
            groups[key].length === 0 ? null : (
              <Card title={label} key={key}>
                <ul className="fg-list">
                  {groups[key].map((task) => {
            const linkedAndRunning = runningTaskId === task.id;
            const disabledReason =
              state.session.status === "idle"
                ? undefined
                : linkedAndRunning
                  ? "This task is linked to the running session. Its controls are available when the session ends."
                  : "Finish the current session before starting or changing tasks.";
            const disabledReasonId = `task-disabled-${task.id}`;
            const scheduleLabel = [
              task.scheduledDate,
              task.scheduledTime,
            ].filter(Boolean).join(" · ");
            return (
              <li className="fg-list-item" key={task.id}>
                <div className="fg-list-item__copy">
                  <strong>{task.title}</strong>
                  <span className="fg-muted">
                    {scheduleLabel || "Unscheduled"} · {task.durationMin} min
                  </span>
                  {task.description && <span className="fg-muted">{task.description}</span>}
                  <div className="fg-wrap">
                    {task.completed ? (
                      <Chip tone="accent">Completed</Chip>
                    ) : (
                      <Chip>{task.priority} priority</Chip>
                    )}
                    {linkedAndRunning && <Chip tone="warning">In session</Chip>}
                    {task.recurring !== "none" && <Chip>{task.recurring}</Chip>}
                    {task.tags.map((tag) => <Chip key={tag}>{tag}</Chip>)}
                  </div>
                  {disabledReason && (
                    <span className="fg-muted" id={disabledReasonId}>
                      {disabledReason}
                    </span>
                  )}
                </div>
                <div className="fg-list-item__actions">
                  {!linkedAndRunning && (
                    <Button
                      variant="quiet"
                      aria-label={`Edit ${task.title}`}
                      onClick={() => openEditor(task)}
                      disabled={state.session.status !== "idle"}
                    >
                      Edit
                    </Button>
                  )}
                  {!linkedAndRunning && (
                    <Button
                      variant="secondary"
                      onClick={() => void startTask(task)}
                      disabled={state.session.status !== "idle"}
                      aria-describedby={
                        state.session.status !== "idle" ? disabledReasonId : undefined
                      }
                      title={
                        state.session.status !== "idle"
                          ? "Finish the current session before starting a task."
                          : undefined
                      }
                    >
                      {task.completed ? "Restart" : "Start"}
                    </Button>
                  )}
                  {!linkedAndRunning && (
                    <Button
                      variant="quiet"
                      aria-label={`${task.completed ? "Mark" : "Complete"} ${task.title}`}
                      onClick={() => void toggleCompleted(task)}
                      disabled={state.session.status !== "idle"}
                      aria-describedby={
                        state.session.status !== "idle" ? disabledReasonId : undefined
                      }
                      title={
                        state.session.status !== "idle"
                          ? "Finish the current session before changing task status."
                          : undefined
                      }
                    >
                      {task.completed ? "Reopen" : "Done"}
                    </Button>
                  )}
                  <Button
                    variant="quiet"
                    aria-label={`Remove ${task.title}`}
                    onClick={() => setDeleteTarget(task)}
                    disabled={linkedAndRunning}
                    aria-describedby={
                      linkedAndRunning ? disabledReasonId : undefined
                    }
                    title={
                      linkedAndRunning
                        ? "This task is linked to the running session."
                        : "Remove task"
                    }
                  >
                    Remove
                  </Button>
                </div>
                  </li>
                  );
                })}
                </ul>
              </Card>
            ),
          )}
        </div>
      )}

      <Modal
        open={addOpen}
        title={editingTaskId ? "Edit task" : "Add a task"}
        onClose={() => {
          setAddOpen(false);
          setEditingTaskId(null);
        }}
        actions={
          <>
            <Button variant="secondary" onClick={() => {
              setAddOpen(false);
              setEditingTaskId(null);
            }}>
              Cancel
            </Button>
            <Button type="submit" form="task-form">
              {editingTaskId ? "Save changes" : "Save task"}
            </Button>
          </>
        }
      >
        <form id="task-form" className="fg-stack" onSubmit={saveTask}>
          <Field id="task-title" label="Task name">
            <input
              id="task-title"
              value={title}
              maxLength={120}
              onChange={(event) => setTitle(event.target.value)}
              autoFocus
              required
            />
          </Field>
          <Field id="task-description" label="Description">
            <textarea
              id="task-description"
              value={description}
              maxLength={500}
              onChange={(event) => setDescription(event.target.value)}
            />
          </Field>
          <Field id="task-duration" label="Focus duration">
            <input
              id="task-duration"
              type="text"
              inputMode="numeric"
              value={durationMin}
              onChange={(event) => setDurationMin(event.target.value)}
              required
            />
          </Field>
          <div className="fg-grid-two">
            <Field id="task-date" label="Date">
              <input
                id="task-date"
                type="date"
                value={scheduledDate}
                onChange={(event) => setScheduledDate(event.target.value)}
              />
            </Field>
            <Field id="task-time" label="Time">
              <input
                id="task-time"
                type="time"
                value={scheduledTime}
                onChange={(event) => setScheduledTime(event.target.value)}
              />
            </Field>
          </div>
          <div className="fg-grid-two">
            <Field id="task-priority" label="Priority">
              <select
                id="task-priority"
                value={priority}
                onChange={(event) => setPriority(event.target.value as TaskPriority)}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </Field>
            <Field id="task-recurrence" label="Repeat">
              <select
                id="task-recurrence"
                value={recurring}
                disabled={
                  state.tasks.some(
                    (task) =>
                      task.id === editingTaskId &&
                      task.templateId !== undefined &&
                      task.templateId !== task.id,
                  )
                }
                onChange={(event) => setRecurring(event.target.value as TaskRecurrence)}
              >
                <option value="none">Does not repeat</option>
                <option value="daily">Daily</option>
                <option value="weekdays">Weekdays</option>
                <option value="weekly">Weekly</option>
              </select>
            </Field>
          </div>
          <Field id="task-tags" label="Tags" helper="Separate tags with commas.">
            <input
              id="task-tags"
              value={tagsText}
              maxLength={320}
              onChange={(event) => setTagsText(event.target.value)}
              placeholder="Writing, research"
            />
          </Field>
          <Field id="task-lock" label="Session lock">
            <select
              id="task-lock"
              value={lockLevel}
              onChange={(event) => setLockLevel(event.target.value as LockLevel)}
            >
              <option value="none">None</option>
              <option value="strict">Strict</option>
              <option value="commitment">Commit</option>
            </select>
          </Field>
        </form>
      </Modal>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Remove this task?"
        message={
          deleteTarget
            ? `"${deleteTarget.title}" will be removed from your task list.`
            : ""
        }
        confirmLabel="Remove task"
        danger
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void removeTask()}
      />
    </section>
  );
}
