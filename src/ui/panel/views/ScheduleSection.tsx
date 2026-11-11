import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import type { AppState, Schedule } from "../../../shared/types.ts";
import { isScheduleActiveAt } from "../../../shared/time.ts";
import {
  Button,
  Card,
  Chip,
  EmptyState,
  Field,
  InfoButton,
  InfoNote,
  Sheet,
  useInfoState,
} from "../../components/primitives.tsx";
import { ConfirmDialog, useToast } from "../../components/feedback.tsx";
import { WeekStrip } from "../../components/WeekStrip.tsx";
import { uiStorageStore } from "../../hooks/storageStore.ts";
import { storageWriteErrorMessage } from "../../lib/guardPrompts.ts";
import {
  SCHEDULE_TEMPLATES,
  TARGET_CHOICES,
  blocksNothing,
  draftFromSchedule,
  emptyDraft,
  planScheduleSave,
} from "../../lib/scheduleForm.ts";
import type { ScheduleDraft } from "../../lib/scheduleForm.ts";
import { scheduleStatus } from "../../lib/scheduleStatus.ts";
import {
  describeTargets,
  formatRange,
  statusLine,
  summarizeDays,
} from "../../lib/scheduleSummary.ts";

/** Monday first. Values follow Date#getDay (0 = Sunday). */
const DAY_BUTTONS = [
  { day: 1, label: "Mon" },
  { day: 2, label: "Tue" },
  { day: 3, label: "Wed" },
  { day: 4, label: "Thu" },
  { day: 5, label: "Fri" },
  { day: 6, label: "Sat" },
  { day: 0, label: "Sun" },
] as const;

function isOnNow(schedule: Schedule, nowMs: number): boolean {
  try {
    return isScheduleActiveAt(schedule, new Date(nowMs));
  } catch {
    return false;
  }
}

type SheetState = { key: number; id: string | null; draft: ScheduleDraft };

export function ScheduleSection({
  state,
  lockedReason,
}: {
  state: AppState;
  lockedReason: string | null;
}) {
  const showToast = useToast();
  const [sheet, setSheet] = useState<SheetState | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const openAdd = (draft: ScheduleDraft = emptyDraft()) =>
    setSheet({ key: Date.now(), id: null, draft });
  const openEdit = (schedule: Schedule) =>
    setSheet({ key: Date.now(), id: schedule.id, draft: draftFromSchedule(schedule) });

  const status = scheduleStatus(state.schedules, now);

  return (
    <div className="fg-stack">
      <Card
        title="Schedules"
        description="Block sites on a weekly timetable. Schedules start and stop on their own, so you don't need to start a session."
        actions={
          <Button variant="primary" size="dense" onClick={() => openAdd()}>
            Add schedule
          </Button>
        }
      >
        {state.schedules.length === 0 ? (
          <EmptyState
            title="Block sites on a timetable"
            description="Pick a starting point. You can change the days, times and sites afterwards."
            action={
              <div className="fg-wrap">
                {SCHEDULE_TEMPLATES.map((template) => (
                  <Button
                    key={template.name}
                    variant="secondary"
                    size="dense"
                    onClick={() =>
                      openAdd({
                        ...emptyDraft(),
                        name: template.name,
                        days: [...template.days],
                        start: template.start,
                        end: template.end,
                      })
                    }
                  >
                    {template.name}
                  </Button>
                ))}
                <Button variant="quiet" size="dense" onClick={() => openAdd()}>
                  Start from scratch
                </Button>
              </div>
            }
          />
        ) : (
          <div className="fg-stack">
            <p className="fg-sched__status" role="status">
              {statusLine(status, now)}
            </p>
            <WeekStrip schedules={state.schedules} now={now} />
            <div className="fg-list">
              {state.schedules.map((schedule) => (
                <ScheduleRow
                  key={schedule.id}
                  schedule={schedule}
                  state={state}
                  now={now}
                  lockedReason={lockedReason}
                  onEdit={() => openEdit(schedule)}
                  onError={(message) => showToast(message, "error")}
                />
              ))}
            </div>
          </div>
        )}
      </Card>

      {sheet && (
        <ScheduleSheet
          key={sheet.key}
          state={state}
          editingId={sheet.id}
          initial={sheet.draft}
          lockedReason={lockedReason}
          onClose={() => setSheet(null)}
        />
      )}
    </div>
  );
}

function ScheduleRow({
  schedule,
  state,
  now,
  lockedReason,
  onEdit,
  onError,
}: {
  schedule: Schedule;
  state: AppState;
  now: number;
  lockedReason: string | null;
  onEdit(): void;
  onError(message: string): void;
}) {
  const onNow = schedule.enabled && isOnNow(schedule, now);
  const empty = blocksNothing(schedule, state);
  const switchDisabled = schedule.enabled && Boolean(lockedReason);

  return (
    <div className={`fg-sched${onNow ? " is-on" : ""}`}>
      <div className="fg-sched__copy">
        <span className="fg-sched__title">
          {schedule.name}
          {onNow && <Chip tone="warning">On now</Chip>}
        </span>
        <span className="fg-sched__meta">
          {summarizeDays(schedule.days)} · {formatRange(schedule.start, schedule.end)}
        </span>
        <span className="fg-sched__targets">{describeTargets(schedule, state)}</span>
        {empty && (
          <span className="fg-sched__warn">
            This schedule blocks nothing yet.{" "}
            <Button variant="quiet" size="dense" onClick={onEdit}>
              Fix
            </Button>
          </span>
        )}
      </div>
      <div className="fg-sched__actions">
        <span className="fg-toggle fg-sched__switch">
          <button
            type="button"
            role="switch"
            aria-checked={schedule.enabled}
            aria-label={`Enable ${schedule.name}`}
            className="fg-toggle__track"
            disabled={switchDisabled}
            title={switchDisabled ? (lockedReason ?? undefined) : undefined}
            aria-describedby={switchDisabled ? "lock-reason" : undefined}
            onClick={() => {
              const enabled = !schedule.enabled;
              void uiStorageStore
                .set("schedules", (latest) =>
                  latest.map((item) =>
                    item.id === schedule.id ? { ...item, enabled } : item,
                  ),
                )
                .catch((error) =>
                  onError(storageWriteErrorMessage(error, "The schedule could not be updated.")),
                );
            }}
          />
        </span>
        <Button
          variant="quiet"
          size="dense"
          aria-label={`Edit ${schedule.name}`}
          onClick={onEdit}
        >
          Edit
        </Button>
      </div>
    </div>
  );
}

/** What each "What should it block?" choice does, shown by the "i" button. */
export function TargetHelp() {
  return (
    <ul className="fg-info-note__list">
      {TARGET_CHOICES.map((choice) => (
        <li key={choice.value}>
          <strong>{choice.label}.</strong> {choice.help}
        </li>
      ))}
    </ul>
  );
}

export function ScheduleSheet({
  state,
  editingId,
  initial,
  lockedReason,
  onClose,
}: {
  state: AppState;
  editingId: string | null;
  initial: ScheduleDraft;
  lockedReason: string | null;
  onClose(): void;
}) {
  const showToast = useToast();
  const [draft, setDraft] = useState<ScheduleDraft>(initial);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const targetInfo = useInfoState();
  const editing = editingId !== null;
  const patch = (changes: Partial<ScheduleDraft>) => {
    setDraft((current) => ({ ...current, ...changes }));
    setError("");
  };

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const at = Date.now();
    const result = planScheduleSave({
      state,
      draft,
      editingId,
      now: at,
      newId: () => crypto.randomUUID(),
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    try {
      await uiStorageStore.set("schedules", (latest) =>
        editingId
          ? latest.map((item) => (item.id === editingId ? result.schedule : item))
          : [...latest, result.schedule],
      );
    } catch (failure) {
      setError(storageWriteErrorMessage(failure, "The schedule could not be saved."));
      return;
    }
    showToast(
      `Schedule saved. ${statusLine(scheduleStatus(result.schedules, at), at)}`,
      "success",
    );
    onClose();
  }

  async function remove() {
    if (!editingId) return;
    try {
      await uiStorageStore.set("schedules", (latest) =>
        latest.filter((item) => item.id !== editingId),
      );
      showToast("Schedule deleted.", "success");
      onClose();
    } catch (failure) {
      setConfirmDelete(false);
      setError(storageWriteErrorMessage(failure, "The schedule could not be deleted."));
    }
  }

  const usesOwnSites = draft.target !== "list";
  const timeValue = (value: string) => (value === "24:00" ? "23:59" : value);

  return (
    <>
      <Sheet
        open
        title={editing ? "Edit schedule" : "Add a schedule"}
        onClose={onClose}
        footer={
          <>
            <Button variant="primary" wide type="submit" form="schedule-form">
              Save schedule
            </Button>
            <Button variant="quiet" onClick={onClose}>
              Cancel
            </Button>
            {editing && (
              <Button
                variant="danger"
                disabled={Boolean(lockedReason)}
                title={lockedReason ?? undefined}
                aria-describedby={lockedReason ? "lock-reason" : undefined}
                onClick={() => setConfirmDelete(true)}
              >
                Delete schedule
              </Button>
            )}
          </>
        }
      >
        <form id="schedule-form" className="fg-stack" onSubmit={(event) => void save(event)}>
          <Field id="schedule-name" label="Name">
            <input
              id="schedule-name"
              className="fg-input"
              value={draft.name}
              onChange={(event) => patch({ name: event.target.value })}
              required
            />
          </Field>

          <div className="fg-stack" role="group" aria-labelledby="schedule-days-label" style={{ gap: 8 }}>
            <span className="fg-field__label" id="schedule-days-label">
              Days
            </span>
            <div className="fg-wrap">
              {DAY_BUTTONS.map(({ day, label }) => {
                const on = draft.days.includes(day);
                return (
                  <Button
                    key={day}
                    variant={on ? "primary" : "secondary"}
                    size="dense"
                    aria-pressed={on}
                    onClick={() =>
                      patch({
                        days: on
                          ? draft.days.filter((value) => value !== day)
                          : [...draft.days, day],
                      })
                    }
                  >
                    {label}
                  </Button>
                );
              })}
            </div>
          </div>

          <div className="fg-wrap">
            <Field id="schedule-start" label="From">
              <input
                id="schedule-start"
                className="fg-input"
                type="time"
                value={timeValue(draft.start)}
                onChange={(event) => patch({ start: event.target.value })}
              />
            </Field>
            <Field id="schedule-end" label="Until">
              <input
                id="schedule-end"
                className="fg-input"
                type="time"
                value={timeValue(draft.end)}
                onChange={(event) => patch({ end: event.target.value })}
              />
            </Field>
          </div>
          {draft.days.length > 0 && /^\d\d:\d\d$/.test(draft.start) && /^\d\d:\d\d$/.test(timeValue(draft.end)) && (
            <p className="fg-field__helper">
              {summarizeDays(draft.days)} · {formatRange(draft.start, draft.end)}
            </p>
          )}

          <div className="fg-sched__fieldset" role="group" aria-labelledby="schedule-target-label">
            <div className="fg-info-row">
              <span className="fg-field__label" id="schedule-target-label">
                What should it block?
              </span>
              <InfoButton label="What do these choices mean?" info={targetInfo} />
            </div>
            <InfoNote info={targetInfo}>
              <TargetHelp />
            </InfoNote>
            {TARGET_CHOICES.map((option) => (
              <label key={option.value} className="fg-sched__radio">
                <input
                  type="radio"
                  name="schedule-target"
                  value={option.value}
                  checked={draft.target === option.value}
                  onChange={() => patch({ target: option.value })}
                />
                <span>
                  {option.label}
                  {option.value === "list" && (
                    <span className="fg-field__helper">
                      {" "}
                      ({state.blockedSites.length} {state.blockedSites.length === 1 ? "site" : "sites"})
                    </span>
                  )}
                </span>
              </label>
            ))}
          </div>

          {usesOwnSites && (
            <Field
              id="schedule-sites"
              label="Sites"
              helper="One site per line, like youtube.com."
            >
              <textarea
                id="schedule-sites"
                className="fg-input"
                rows={4}
                value={draft.sitesText}
                onChange={(event) => patch({ sitesText: event.target.value })}
              />
            </Field>
          )}

          {error && (
            <p className="fg-field__error" role="alert">
              {error}
            </p>
          )}
        </form>
      </Sheet>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this schedule?"
        message={`${draft.name.trim() || "This schedule"} will stop blocking. This is permanent.`}
        confirmLabel="Delete"
        cancelLabel="Keep"
        danger
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => void remove()}
      />
    </>
  );
}
