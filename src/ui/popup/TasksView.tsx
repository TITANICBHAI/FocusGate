import { useState } from "react";
import type { FormEvent } from "react";
import type { AppState, LockLevel, Task } from "../../shared/types.ts";
import { Button, Card, EmptyState, Field, Chip } from "../components/primitives.tsx";
import { ConfirmDialog, Modal, useToast } from "../components/feedback.tsx";
import { sendSessionMessage } from "../lib/sessionActions.ts";
import { uiStorageStore } from "../hooks/storageStore.ts";

export function TasksView({ state }: { state: AppState }) {
  const showToast = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [durationMin, setDurationMin] = useState("25");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [lockLevel, setLockLevel] = useState<LockLevel>("none");
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null);

  const runningTaskId =
    state.session.status === "idle" ? null : state.session.taskId;

  async function createTask(event: FormEvent<HTMLFormElement>) {
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
    const task: Task = {
      id: crypto.randomUUID(),
      title: cleanTitle,
      durationMin: duration,
      ...(scheduledDate ? { scheduledDate } : {}),
      ...(scheduledTime ? { scheduledTime } : {}),
      priority: "medium",
      tags: [],
      recurring: "none",
      lockLevel,
      completed: false,
      createdAt: Date.now(),
    };
    try {
      await uiStorageStore.set("tasks", (latest) => [task, ...latest]);
      setTitle("");
      setDurationMin("25");
      setScheduledDate("");
      setScheduledTime("");
      setAddOpen(false);
      showToast("Task added.", "success");
    } catch {
      showToast("The task could not be saved.", "error");
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
    } catch {
      showToast("The task could not be updated.", "error");
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
        durationMin: task.durationMin,
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
    } catch {
      showToast("This task could not be started.", "error");
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
      showToast("Task removed.", "success");
    } catch {
      showToast("The task could not be removed.", "error");
    }
    setDeleteTarget(null);
  }

  const orderedTasks = [...state.tasks].sort((left, right) => {
    if (left.completed !== right.completed) return left.completed ? 1 : -1;
    const leftDate = `${left.scheduledDate ?? "9999-12-31"} ${left.scheduledTime ?? "23:59"}`;
    const rightDate = `${right.scheduledDate ?? "9999-12-31"} ${right.scheduledTime ?? "23:59"}`;
    return leftDate.localeCompare(rightDate);
  });

  return (
    <section className="fg-page" aria-labelledby="tasks-title">
      <div className="fg-page__heading">
        <div>
          <h1 id="tasks-title">Tasks</h1>
          <p className="fg-muted">Plan a task and give it a focused session.</p>
        </div>
        <Button onClick={() => setAddOpen(true)}>Add task</Button>
      </div>

      {orderedTasks.length === 0 ? (
        <EmptyState
          title="No tasks yet"
          description="Add one to plan your next focus session."
          action={<Button onClick={() => setAddOpen(true)}>Add a task</Button>}
        />
      ) : (
        <ul className="fg-list">
          {orderedTasks.map((task) => {
            const linkedAndRunning = runningTaskId === task.id;
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
                  <div className="fg-wrap">
                    {task.completed ? (
                      <Chip tone="accent">Completed</Chip>
                    ) : (
                      <Chip>{task.priority} priority</Chip>
                    )}
                    {linkedAndRunning && <Chip tone="warning">In session</Chip>}
                  </div>
                  {linkedAndRunning && (
                    <span className="fg-muted">
                      This task is linked to the current session.
                    </span>
                  )}
                </div>
                <div className="fg-list-item__actions">
                  {!linkedAndRunning && (
                    <Button
                      variant="secondary"
                      onClick={() => void startTask(task)}
                      disabled={state.session.status !== "idle"}
                      title={
                        state.session.status !== "idle"
                          ? "End the current session before starting a task."
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
      )}

      <Modal
        open={addOpen}
        title="Add a task"
        onClose={() => setAddOpen(false)}
        actions={
          <>
            <Button variant="secondary" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="add-task-form">
              Save task
            </Button>
          </>
        }
      >
        <form id="add-task-form" className="fg-stack" onSubmit={createTask}>
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
