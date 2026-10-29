import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import type {
  Allowance,
  AppState,
  KeywordRule,
  Schedule,
} from "../../shared/types.ts";
import {
  matchesDomain,
  normalizeDomain,
} from "../../shared/domains.ts";
import { computeBlockPlan } from "../../shared/plan.ts";
import {
  Button,
  Card,
  Chip,
  EmptyState,
  Field,
  Segmented,
  Toggle,
} from "../components/primitives.tsx";
import { ConfirmDialog, Modal, useToast } from "../components/feedback.tsx";
import { Tabs } from "../components/Tabs.tsx";
import { uiStorageStore } from "../hooks/storageStore.ts";
import { storageWriteErrorMessage } from "../lib/guardPrompts.ts";
import { weakeningLockReason } from "../lib/guardState.ts";
import { aliasesForSiteDisplay } from "../lib/aliasPresentation.ts";

type RuleSection = "sites" | "exceptions" | "keywords" | "schedules" | "limits";
type SiteMode = "focus" | "always";
type KeywordMode = KeywordRule["mode"];

const RULE_TABS = [
  { value: "sites", label: "Sites" },
  { value: "exceptions", label: "Exceptions" },
  { value: "keywords", label: "Keywords" },
  { value: "schedules", label: "Schedules" },
  { value: "limits", label: "Limits" },
] as const;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function RulesView({ state }: { state: AppState }) {
  const [section, setSection] = useState<RuleSection>("sites");
  const lockedReason = weakeningLockReason(state);
  return (
    <section className="fg-page" aria-labelledby="rules-title">
      <div className="fg-page__heading">
        <div>
          <h1 id="rules-title">Rules</h1>
          <p className="fg-muted">
            Choose which pages are blocked and when.
          </p>
        </div>
      </div>
      <Tabs
        idPrefix="rules"
        label="Rule categories"
        options={RULE_TABS}
        value={section}
        onChange={setSection}
        compact
      />
      <div
        id={`rules-${section}-panel`}
        role="tabpanel"
        aria-labelledby={`rules-${section}-tab`}
        className="fg-stack"
      >
        {lockedReason && (
          <p className="fg-note" role="status">
            {lockedReason} Weakening changes are blocked while this lock runs.
            Additions that strengthen protection remain available.
          </p>
        )}
        {section === "sites" && (
          <SitesPanel state={state} lockedReason={lockedReason} />
        )}
        {section === "exceptions" && (
          <ExceptionsPanel state={state} lockedReason={lockedReason} />
        )}
        {section === "keywords" && (
          <KeywordsPanel state={state} lockedReason={lockedReason} />
        )}
        {section === "schedules" && (
          <SchedulesPanel state={state} lockedReason={lockedReason} />
        )}
        {section === "limits" && (
          <LimitsPanel state={state} lockedReason={lockedReason} />
        )}
      </div>
    </section>
  );
}

function SitesPanel({
  state,
  lockedReason,
}: {
  state: AppState;
  lockedReason: string | null;
}) {
  const showToast = useToast();
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<SiteMode>("focus");
  const [error, setError] = useState("");
  const plan = useMemo(() => computeBlockPlan(state, Date.now()), [state]);

  const allSites = useMemo(() => {
    const sites = new Map<string, Set<SiteMode>>();
    for (const domain of state.blockedSites) {
      const modes = sites.get(domain) ?? new Set<SiteMode>();
      modes.add("focus");
      sites.set(domain, modes);
    }
    for (const domain of state.alwaysBlockedSites) {
      const modes = sites.get(domain) ?? new Set<SiteMode>();
      modes.add("always");
      sites.set(domain, modes);
    }
    return [...sites.entries()].sort(([left], [right]) =>
      left.localeCompare(right),
    );
  }, [state.alwaysBlockedSites, state.blockedSites]);

  async function addSite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const domain = normalizeDomain(input);
    if (!domain) {
      setError("Enter a valid website address or domain.");
      return;
    }
    const key = mode === "focus" ? "blockedSites" : "alwaysBlockedSites";
    try {
      await uiStorageStore.set(key, (latest) =>
        latest.includes(domain) ? latest : [...latest, domain],
      );
      setInput("");
      setError("");
      showToast(`${domain} added to ${mode === "focus" ? "Focus" : "Always"}.`, "success");
    } catch (error) {
      showToast(storageWriteErrorMessage(error, "The site could not be saved."), "error");
    }
  }

  async function removeSite(domain: string, siteMode: SiteMode) {
    const key = siteMode === "focus" ? "blockedSites" : "alwaysBlockedSites";
    try {
      await uiStorageStore.set(key, (latest) =>
        latest.filter((item) => item !== domain),
      );
      showToast(`${domain} removed.`, "success");
    } catch (error) {
      showToast(storageWriteErrorMessage(error, "The site could not be removed."), "error");
    }
  }

  function isBlockedNow(domain: string): boolean {
    return (
      plan.blocked.has(domain) ||
      [...plan.blocked.keys()].some((activeDomain) =>
        matchesDomain(domain, activeDomain),
      )
    );
  }

  function schedulesForSite(domain: string): Schedule[] {
    return state.schedules.filter(
      (schedule) =>
        schedule.enabled &&
        (schedule.sites.some(
          (site) => matchesDomain(domain, site) || matchesDomain(site, domain),
        ) ||
          (schedule.useGlobalLists &&
            (state.blockedSites.includes(domain) ||
              state.alwaysBlockedSites.includes(domain)))),
    );
  }

  return (
    <>
      <Card
        title="Check a URL"
        description="See whether a page is blocked by your current rules."
      >
        <UrlCheck state={state} />
      </Card>
      <Card
        title="Add a site"
        description="Focus sites are blocked during focus sessions and schedules. Standalone blocks use a separate list. Embedded content on other sites is not affected."
      >
        <form className="fg-stack" onSubmit={addSite}>
          <Field
            id="site-domain"
            label="Website or URL"
            helper="Paste a URL or enter a domain, such as reddit.com."
            error={error}
          >
            <input
              id="site-domain"
              value={input}
              autoComplete="url"
              placeholder="https://www.reddit.com/r/all"
              aria-invalid={Boolean(error)}
              onChange={(event) => setInput(event.target.value)}
            />
          </Field>
          <Segmented
            label="When should it block?"
            options={[
              { value: "focus", label: "During focus" },
              { value: "always", label: "Always" },
            ]}
            value={mode}
            onChange={setMode}
          />
          <Button type="submit">Add site</Button>
        </form>
      </Card>
      <Card title="Blocked sites">
        {allSites.length === 0 ? (
          <EmptyState
            title="No sites added"
            description="Add a site above to include it in your blocking rules."
          />
        ) : (
          <ul className="fg-list">
            {allSites.map(([domain, modes]) => (
              <li className="fg-list-item" key={domain}>
                <div className="fg-list-item__copy">
                  <strong>{domain}</strong>
                  <div className="fg-wrap">
                    {[...modes].map((siteMode) => (
                      <Chip
                        key={siteMode}
                        tone={siteMode === "always" ? "warning" : "neutral"}
                      >
                        {siteMode === "always" ? "Always" : "Focus"}
                      </Chip>
                    ))}
                    {schedulesForSite(domain).map((schedule) => (
                      <Chip key={schedule.id} tone="neutral">
                        Schedule: {schedule.name}
                      </Chip>
                    ))}
                    {aliasesForSiteDisplay(domain).map((alias) => (
                        <Chip key={`alias:${alias}`} tone="neutral">
                          Also blocks: {alias}
                        </Chip>
                      ))}
                    {isBlockedNow(domain) && <Chip tone="accent">Blocked now</Chip>}
                  </div>
                </div>
                <div className="fg-list-item__actions">
                  {[...modes].map((siteMode) => (
                    <Button
                      key={siteMode}
                      variant="quiet"
                      aria-label={`Remove ${domain} from ${siteMode === "focus" ? "Focus" : "Always"} rules`}
                      disabled={Boolean(lockedReason)}
                      title={lockedReason ?? undefined}
                      onClick={() => void removeSite(domain, siteMode)}
                    >
                      Remove
                    </Button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

function UrlCheck({ state }: { state: AppState }) {
  const [input, setInput] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState("");
  return (
    <form
      className="fg-stack"
      onSubmit={(event) => {
        event.preventDefault();
        const value = input.trim();
        if (!/^https?:\/\//i.test(value)) {
          setError("Enter a complete http or https URL.");
          setResult(null);
          return;
        }
        const reason = computeBlockPlan(state, Date.now());
        let parsed: URL;
        try {
          parsed = new URL(value);
        } catch {
          setError("Enter a complete http or https URL.");
          setResult(null);
          return;
        }
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
          setError("Enter a complete http or https URL.");
          setResult(null);
          return;
        }
        const domain = normalizeDomain(parsed.hostname);
        if (!domain) {
          setError("Enter a valid website address.");
          setResult(null);
          return;
        }
        const blocked =
          reason.blocked.has(domain) ||
          [...reason.blocked.keys()].some((blockedDomain) =>
            matchesDomain(domain, blockedDomain),
          ) ||
          (reason.allowOnly !== null &&
            !reason.allowOnly.some((allowed) => matchesDomain(domain, allowed)));
        setError("");
        setResult(
          blocked
            ? `${domain} is blocked by the current rules.`
            : `${domain} is not blocked by the current rules.`,
        );
      }}
    >
      <div className="fg-inline-form">
        <input
          aria-label="URL to check"
          value={input}
          placeholder="https://example.com/page"
          onChange={(event) => setInput(event.target.value)}
        />
        <Button type="submit" variant="secondary">
          Check
        </Button>
      </div>
      {error && <p className="fg-field__error">{error}</p>}
      {result && <p className="fg-muted" role="status">{result}</p>}
    </form>
  );
}

function ExceptionsPanel({
  state,
  lockedReason,
}: {
  state: AppState;
  lockedReason: string | null;
}) {
  const showToast = useToast();
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  async function addException(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    let url: URL;
    try {
      url = new URL(input.trim());
    } catch {
      setError("Enter a complete page URL, including https://.");
      return;
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      setError("Only http and https page addresses can be excepted.");
      return;
    }
    const normalized = `${url.origin}${url.pathname}${url.search}`.replace(/\/$/, "");
    try {
      await uiStorageStore.set("exceptions", (latest) =>
        latest.includes(normalized) ? latest : [...latest, normalized],
      );
      setInput("");
      setError("");
      showToast("Exception added.", "success");
    } catch (error) {
      showToast(storageWriteErrorMessage(error, "The exception could not be saved."), "error");
    }
  }
  return (
    <>
      <Card
        title="Allow one page"
        description="Allow one page even when its site is blocked."
      >
        <form className="fg-stack" onSubmit={addException}>
          <Field
            id="exception-url"
            label="Page address"
            helper="Example: youtube.com/watch?v=abc123. https:// and www. are optional."
            error={error}
          >
            <input
              id="exception-url"
              value={input}
              placeholder="https://www.youtube.com/watch?v=abc123"
              onChange={(event) => setInput(event.target.value)}
            />
          </Field>
          <Button type="submit" disabled={Boolean(lockedReason)} title={lockedReason ?? undefined}>
            Add exception
          </Button>
        </form>
      </Card>
      <Card title="Exceptions">
        {state.exceptions.length === 0 ? (
          <EmptyState
            title="No exceptions"
            description="Pages you allow will appear here."
          />
        ) : (
          <ul className="fg-list">
            {state.exceptions.map((exception) => (
              <li className="fg-list-item" key={exception}>
                <div className="fg-list-item__copy">
                  <strong>{exception}</strong>
                </div>
                <Button
                  variant="quiet"
                  aria-label={`Remove exception ${exception}`}
                  onClick={() => {
                    void uiStorageStore
                      .set("exceptions", (latest) =>
                        latest.filter((item) => item !== exception),
                      )
                      .then(() => showToast("Exception removed.", "success"))
                      .catch((error) =>
                        showToast(
                          storageWriteErrorMessage(error, "The exception could not be removed."),
                          "error",
                        ),
                      );
                  }}
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

function KeywordsPanel({
  state,
  lockedReason,
}: {
  state: AppState;
  lockedReason: string | null;
}) {
  const showToast = useToast();
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<KeywordMode>("block");
  const [when, setWhen] = useState<KeywordRule["when"]>("blocks");
  async function addKeywords(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const entries = [...new Set(input.split(/[,\n]/).map((word) => word.trim().toLowerCase()).filter(Boolean))];
    if (entries.length === 0) {
      showToast("Enter one or more keywords.", "error");
      return;
    }
    try {
      await uiStorageStore.set("keywords", (latest) => {
        const existing = new Set(latest.map((rule) => rule.text.toLowerCase()));
        const additions = entries
          .filter((word) => !existing.has(word))
          .map((text) => ({ text, mode, when }));
        return [...latest, ...additions];
      });
      setInput("");
      showToast(`${entries.length} keyword${entries.length === 1 ? "" : "s"} saved.`, "success");
    } catch (error) {
      showToast(storageWriteErrorMessage(error, "The keywords could not be saved."), "error");
    }
  }

  return (
    <>
      <Card
        title="Add keywords"
        description={
          mode === "hide"
            ? "Hide matching feed items on supported pages. Separate several with commas."
            : mode === "both"
              ? "Block matching searches and page addresses, and hide matching feed items on supported pages. Separate several with commas."
              : "Block searches and page addresses that contain these words. Separate several with commas."
        }
      >
        <form className="fg-stack" onSubmit={addKeywords}>
          <Field id="keyword-list" label="Keywords">
            <textarea
              id="keyword-list"
              value={input}
              placeholder={"funny shorts, #gaming"}
              onChange={(event) => setInput(event.target.value)}
            />
          </Field>
          <Segmented
            label="Action"
            options={[
              { value: "block", label: "Block" },
              { value: "hide", label: "Hide" },
              { value: "both", label: "Both" },
            ]}
            value={mode}
            onChange={setMode}
          />
          <Segmented
            label="Apply"
            options={[
              { value: "blocks", label: "During blocks" },
              { value: "always", label: "Always" },
            ]}
            value={when}
            onChange={setWhen}
          />
          <Button type="submit">Add keywords</Button>
        </form>
      </Card>
      <Card title="Your keywords">
        {state.keywords.length === 0 ? (
          <EmptyState
            title="No keywords yet"
            description="Add words to block matching pages or hide matching feed items."
          />
        ) : (
          <ul className="fg-list">
            {state.keywords.map((rule) => (
              <li className="fg-list-item" key={`${rule.text}:${rule.mode}:${rule.when}`}>
                <div className="fg-list-item__copy">
                  <strong>{rule.text}</strong>
                  <div className="fg-wrap">
                    <Chip>{rule.mode}</Chip>
                    <Chip tone={rule.when === "always" ? "warning" : "neutral"}>
                      {rule.when === "always" ? "Always" : "During blocks"}
                    </Chip>
                  </div>
                </div>
                <Button
                  variant="quiet"
                  aria-label={`Remove keyword ${rule.text}`}
                  disabled={Boolean(lockedReason)}
                  title={lockedReason ?? undefined}
                  onClick={() => {
                    void uiStorageStore
                      .set("keywords", (latest) =>
                        latest.filter(
                          (item) =>
                            !(
                              item.text === rule.text &&
                              item.mode === rule.mode &&
                              item.when === rule.when
                            ),
                        ),
                      )
                      .then(() => showToast("Keyword removed.", "success"))
                      .catch((error) =>
                        showToast(
                          storageWriteErrorMessage(error, "The keyword could not be removed."),
                          "error",
                        ),
                      );
                  }}
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

function SchedulesPanel({
  state,
  lockedReason,
}: {
  state: AppState;
  lockedReason: string | null;
}) {
  const showToast = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("17:00");
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [formError, setFormError] = useState("");

  async function addSchedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) {
      setFormError("Enter a name for this schedule.");
      return;
    }
    if (days.length === 0) {
      setFormError("Choose at least one day.");
      return;
    }
    if (!isClockTime(start) || !isClockTime(end, true)) {
      setFormError("Use a valid start time and an end time up to 24:00.");
      return;
    }
    const schedule: Schedule = {
      id: crypto.randomUUID(),
      name: cleanName,
      enabled: true,
      days,
      start,
      end,
      sites: [],
      keywords: [],
      useGlobalLists: true,
    };
    try {
      await uiStorageStore.set("schedules", (latest) => [...latest, schedule]);
      setName("");
      setAddOpen(false);
      setFormError("");
      showToast("Schedule added.", "success");
    } catch (error) {
      showToast(storageWriteErrorMessage(error, "The schedule could not be saved."), "error");
    }
  }

  async function updateSchedule(id: string, changes: Partial<Schedule>) {
    try {
      await uiStorageStore.set("schedules", (latest) =>
        latest.map((schedule) =>
          schedule.id === id ? { ...schedule, ...changes } : schedule,
        ),
      );
    } catch (error) {
      showToast(storageWriteErrorMessage(error, "The schedule could not be updated."), "error");
    }
  }

  async function deleteSchedule() {
    if (!deleteId) return;
    try {
      await uiStorageStore.set("schedules", (latest) =>
        latest.filter((schedule) => schedule.id !== deleteId),
      );
      showToast("Schedule deleted.", "success");
    } catch (error) {
      showToast(storageWriteErrorMessage(error, "The schedule could not be deleted."), "error");
    } finally {
      setDeleteId(null);
    }
  }

  return (
    <>
      <Card
        title="Schedules"
        description="Block these sites on the days and hours you choose. Each schedule can have its own list."
        actions={
          <Button
            onClick={() => {
              setFormError("");
              setAddOpen(true);
            }}
          >
            Add schedule
          </Button>
        }
      >
        {state.schedules.length === 0 ? (
          <EmptyState
            title="No schedules"
            description="Add a schedule to set recurring block hours."
            action={
              <Button
                onClick={() => {
                  setFormError("");
                  setAddOpen(true);
                }}
              >
                Add schedule
              </Button>
            }
          />
        ) : (
          <ul className="fg-list">
            {state.schedules.map((schedule) => (
              <li className="fg-list-item fg-list-item--column" key={schedule.id}>
                <div className="fg-row">
                  <div className="fg-list-item__copy">
                    <ScheduleNameField
                      id={`schedule-name-${schedule.id}`}
                      value={schedule.name}
                      onCommit={(nextName) =>
                        void updateSchedule(schedule.id, { name: nextName })
                      }
                    />
                    <span className="fg-muted">
                      {schedule.days.map((day) => WEEKDAYS[day]).join(", ")} · {schedule.start}–{schedule.end}
                    </span>
                  </div>
                  <Toggle
                    label={`Enable ${schedule.name}`}
                    checked={schedule.enabled}
                    description={
                      schedule.enabled && lockedReason ? lockedReason : undefined
                    }
                    disabled={schedule.enabled && Boolean(lockedReason)}
                    onCheckedChange={(enabled) =>
                      void updateSchedule(schedule.id, { enabled })
                    }
                  />
                </div>
                <div className="fg-wrap">
                  <Chip>{schedule.sites.length ? `${schedule.sites.length} custom sites` : "Use global lists"}</Chip>
                  {schedule.useGlobalLists && <Chip tone="accent">Also block global lists</Chip>}
                </div>
                <ScheduleListEditor
                  schedule={schedule}
                  lockedReason={lockedReason}
                  onUpdate={(changes) => void updateSchedule(schedule.id, changes)}
                />
                <div className="fg-grid-two">
                  <ScheduleTimeField
                    id={`schedule-start-${schedule.id}`}
                    label="Start"
                    value={schedule.start}
                    onCommit={(value) =>
                      void updateSchedule(schedule.id, { start: value })
                    }
                  />
                  <ScheduleTimeField
                    id={`schedule-end-${schedule.id}`}
                    label="End"
                    value={schedule.end}
                    allowEndOfDay
                    onCommit={(value) =>
                      void updateSchedule(schedule.id, { end: value })
                    }
                  />
                </div>
                <div
                  className="fg-wrap"
                  role="group"
                  aria-label={`Days for ${schedule.name}`}
                >
                  {WEEKDAYS.map((day, index) => (
                    <button
                      className={`fg-day-chip ${schedule.days.includes(index) ? "is-selected" : ""}`}
                      key={day}
                      type="button"
                      aria-pressed={schedule.days.includes(index)}
                      onClick={() => {
                        const next = schedule.days.includes(index)
                          ? schedule.days.filter((value) => value !== index)
                          : [...schedule.days, index].sort();
                        void updateSchedule(schedule.id, { days: next });
                      }}
                    >
                      {day}
                    </button>
                  ))}
                </div>
                <div className="fg-list-item__actions">
                  <Button
                    variant="danger"
                    disabled={Boolean(lockedReason)}
                    title={lockedReason ?? undefined}
                    onClick={() => setDeleteId(schedule.id)}
                  >
                    Delete schedule
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Modal
        open={addOpen}
        title="Add a schedule"
        onClose={() => setAddOpen(false)}
        actions={
          <>
            <Button variant="secondary" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="schedule-form">
              Save schedule
            </Button>
          </>
        }
      >
        <form id="schedule-form" className="fg-stack" onSubmit={addSchedule}>
          <Field id="schedule-name" label="Schedule name">
            <input
              id="schedule-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </Field>
          <div className="fg-grid-two">
            <Field id="new-schedule-start" label="Start">
              <input
                id="new-schedule-start"
                type="time"
                value={start}
                onChange={(event) => setStart(event.target.value)}
              />
            </Field>
            <Field id="new-schedule-end" label="End">
              <input
                id="new-schedule-end"
                type="text"
                inputMode="numeric"
                value={end}
                onChange={(event) => setEnd(event.target.value)}
              />
            </Field>
          </div>
          <div className="fg-wrap" role="group" aria-label="Schedule days">
            {WEEKDAYS.map((day, index) => (
              <button
                className={`fg-day-chip ${days.includes(index) ? "is-selected" : ""}`}
                key={day}
                type="button"
                aria-pressed={days.includes(index)}
                onClick={() => {
                  setDays((current) =>
                    current.includes(index)
                      ? current.filter((value) => value !== index)
                      : [...current, index].sort(),
                  );
                  setFormError("");
                }}
              >
                {day}
              </button>
            ))}
          </div>
          <p className="fg-muted">End time 24:00 means midnight at the end of the selected day.</p>
          {formError && <p className="fg-field__error" role="alert">{formError}</p>}
        </form>
      </Modal>
      <ConfirmDialog
        open={deleteId !== null}
        title="Delete this schedule?"
        message="This removes its recurring schedule and list associations."
        confirmLabel="Delete schedule"
        danger
        onCancel={() => setDeleteId(null)}
        onConfirm={() => void deleteSchedule()}
      />
    </>
  );
}

function isClockTime(value: string, allowEndOfDay = false): boolean {
  if (allowEndOfDay && value === "24:00") return true;
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  return Boolean(match);
}

function ScheduleNameField({
  id,
  value,
  onCommit,
}: {
  id: string;
  value: string;
  onCommit(value: string): void;
}) {
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState("");
  useEffect(() => setDraft(value), [value]);
  return (
    <Field id={id} label="Schedule name" error={error}>
      <input
        id={id}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => {
          const clean = draft.trim();
          if (!clean) {
            setError("A schedule name is required.");
            setDraft(value);
            return;
          }
          setError("");
          if (clean !== value) onCommit(clean);
        }}
      />
    </Field>
  );
}

function ScheduleTimeField({
  id,
  label,
  value,
  allowEndOfDay = false,
  onCommit,
}: {
  id: string;
  label: string;
  value: string;
  allowEndOfDay?: boolean;
  onCommit(value: string): void;
}) {
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState("");
  useEffect(() => {
    setDraft(value);
    setError("");
  }, [value]);
  return (
    <Field
      id={id}
      label={label}
      helper={allowEndOfDay ? "Use 24:00 for midnight." : undefined}
      error={error}
    >
      <input
        id={id}
        type="text"
        inputMode="numeric"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => {
          if (!isClockTime(draft, allowEndOfDay)) {
            setError(
              allowEndOfDay
                ? "Enter a valid time or 24:00."
                : "Enter a valid time from 00:00 to 23:59.",
            );
            return;
          }
          setError("");
          if (draft !== value) onCommit(draft);
        }}
      />
    </Field>
  );
}

function ScheduleListEditor({
  schedule,
  lockedReason,
  onUpdate,
}: {
  schedule: Schedule;
  lockedReason: string | null;
  onUpdate(changes: Partial<Schedule>): void;
}) {
  const [siteDraft, setSiteDraft] = useState("");
  const [keywordDraft, setKeywordDraft] = useState("");
  const [error, setError] = useState("");

  function addSite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const domain = normalizeDomain(siteDraft);
    if (!domain) {
      setError("Enter a valid website address or domain.");
      return;
    }
    if (schedule.sites.includes(domain)) {
      setError("That site is already in this schedule.");
      return;
    }
    onUpdate({ sites: [...schedule.sites, domain] });
    setSiteDraft("");
    setError("");
  }

  function addKeyword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const keyword = keywordDraft.trim();
    if (!keyword) {
      setError("Enter a keyword.");
      return;
    }
    if (
      schedule.keywords.some(
        (current) => current.toLocaleLowerCase() === keyword.toLocaleLowerCase(),
      )
    ) {
      setError("That keyword is already in this schedule.");
      return;
    }
    onUpdate({ keywords: [...schedule.keywords, keyword] });
    setKeywordDraft("");
    setError("");
  }

  return (
    <div className="fg-stack fg-schedule-lists">
      <Toggle
        label="Use global site and keyword lists"
        description="Include your Focus and keyword rules while this schedule is active."
        checked={schedule.useGlobalLists}
        disabled={schedule.useGlobalLists && Boolean(lockedReason)}
        onCheckedChange={(useGlobalLists) => onUpdate({ useGlobalLists })}
      />
      <form className="fg-inline-form" onSubmit={addSite}>
        <input
          aria-label={`Add site to ${schedule.name}`}
          value={siteDraft}
          placeholder="Add a schedule-specific site"
          onChange={(event) => {
            setSiteDraft(event.target.value);
            if (error) setError("");
          }}
        />
        <Button type="submit" variant="secondary">Add site</Button>
      </form>
      {schedule.sites.length > 0 && (
        <ul className="fg-wrap fg-chip-list" aria-label={`Sites in ${schedule.name}`}>
          {schedule.sites.map((site) => (
            <li key={site}>
              <Chip>
                {site}
                <button
                  type="button"
                  aria-label={`Remove ${site} from ${schedule.name}`}
                  disabled={Boolean(lockedReason)}
                  title={lockedReason ?? undefined}
                  onClick={() =>
                    onUpdate({ sites: schedule.sites.filter((item) => item !== site) })
                  }
                >
                  ×
                </button>
              </Chip>
            </li>
          ))}
        </ul>
      )}
      <form className="fg-inline-form" onSubmit={addKeyword}>
        <input
          aria-label={`Add keyword to ${schedule.name}`}
          value={keywordDraft}
          placeholder="Add a schedule-specific keyword"
          onChange={(event) => {
            setKeywordDraft(event.target.value);
            if (error) setError("");
          }}
        />
        <Button type="submit" variant="secondary">Add keyword</Button>
      </form>
      {schedule.keywords.length > 0 && (
        <ul className="fg-wrap fg-chip-list" aria-label={`Keywords in ${schedule.name}`}>
          {schedule.keywords.map((keyword) => (
            <li key={keyword}>
              <Chip>
                {keyword}
                <button
                  type="button"
                  aria-label={`Remove keyword ${keyword} from ${schedule.name}`}
                  disabled={Boolean(lockedReason)}
                  title={lockedReason ?? undefined}
                  onClick={() =>
                    onUpdate({
                      keywords: schedule.keywords.filter((item) => item !== keyword),
                    })
                  }
                >
                  ×
                </button>
              </Chip>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="fg-field__error" role="alert">{error}</p>}
    </div>
  );
}

function LimitsPanel({
  state,
  lockedReason,
}: {
  state: AppState;
  lockedReason: string | null;
}) {
  const showToast = useToast();
  const entries = Object.entries(state.allowances);
  const [addOpen, setAddOpen] = useState(false);
  const [domainInput, setDomainInput] = useState("");
  const [mode, setMode] = useState<Allowance["mode"]>("time_budget");
  const [amount, setAmount] = useState("60");
  const [period, setPeriod] = useState("60");
  const [formError, setFormError] = useState("");

  function chooseMode(nextMode: Allowance["mode"]) {
    setMode(nextMode);
    setAmount(nextMode === "time_budget" ? "60" : nextMode === "count" ? "5" : "5");
    setPeriod("60");
    setFormError("");
  }

  async function addLimit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = normalizeDomain(domainInput);
    if (!normalized) {
      setFormError("Enter a valid website address or domain.");
      return;
    }
    const amountValue = Number(amount);
    const periodValue = Number(period);
    const maxAmount = mode === "count" ? 100 : 1_440;
    if (!Number.isInteger(amountValue) || amountValue < 1 || amountValue > maxAmount) {
      setFormError(`Enter a whole number from 1 to ${maxAmount}.`);
      return;
    }
    if (
      mode === "interval" &&
      (!Number.isInteger(periodValue) || periodValue < 1 || periodValue > 10_080)
    ) {
      setFormError("Enter a window length from 1 to 10080 minutes.");
      return;
    }
    let alreadyExists = false;
    try {
      await uiStorageStore.set("allowances", (latest) => ({
        ...latest,
        ...(latest[normalized]
          ? ((alreadyExists = true), {})
          : {
              [normalized]:
                mode === "time_budget"
                  ? {
                      mode,
                      limitMin: amountValue,
                       duringBlocks: true,
                    }
                  : mode === "count"
                    ? {
                        mode,
                        maxOpens: amountValue,
                         duringBlocks: true,
                      }
                    : {
                        mode,
                        allowMin: amountValue,
                        everyMin: periodValue,
                       duringBlocks: true,
                      },
            }),
      }));
      if (alreadyExists) {
        setFormError("A limit already exists for this site. Edit it in the list.");
        return;
      }
      setDomainInput("");
      setFormError("");
      setAddOpen(false);
      showToast("Daily limit added.", "success");
    } catch (error) {
      showToast(storageWriteErrorMessage(error, "The limit could not be saved."), "error");
    }
  }

  return (
    <Card
      title="Daily limits"
      description="A site is blocked after its budget is used until the day or window resets. Usage counts throughout the day, including outside focus sessions."
      actions={
        <Button
          onClick={() => {
            setFormError("");
            setAddOpen(true);
          }}
        >
          Add limit
        </Button>
      }
    >
      {entries.length === 0 ? (
        <EmptyState
          title="No daily limits"
          description="Add a site-specific allowance to set a daily cap."
          action={<Button onClick={() => setAddOpen(true)}>Add limit</Button>}
        />
      ) : (
        <ul className="fg-list">
          {entries.map(([domain, allowance]) => (
            <AllowanceRow
              key={domain}
              domain={domain}
              allowance={allowance}
              lockedReason={lockedReason}
              usedMs={state.usage[domain]?.usedMs ?? 0}
              opens={state.usage[domain]?.opens ?? 0}
              onRemove={async () => {
                try {
                  await uiStorageStore.set("allowances", (latest) => {
                    const next = { ...latest };
                    delete next[domain];
                    return next;
                  });
                  showToast("Daily limit removed.", "success");
                } catch (error) {
                  showToast(storageWriteErrorMessage(error, "The limit could not be removed."), "error");
                }
              }}
              onChange={async (next) => {
                try {
                  await uiStorageStore.set("allowances", (latest) => ({
                    ...latest,
                    [domain]: next,
                  }));
                } catch (error) {
                  showToast(storageWriteErrorMessage(error, "The limit could not be updated."), "error");
                }
              }}
            />
          ))}
        </ul>
      )}
      <Modal
        open={addOpen}
        title="Add a daily limit"
        onClose={() => setAddOpen(false)}
        actions={
          <>
            <Button variant="secondary" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
          <Button type="submit" form="limit-form">
              Add limit
            </Button>
          </>
        }
      >
        <form id="limit-form" className="fg-stack" onSubmit={addLimit}>
          <Field
            id="limit-mode"
            label="Limit type"
            helper={allowanceModeDescription(mode)}
          >
            <select
              id="limit-mode"
              value={mode}
              onChange={(event) =>
                chooseMode(event.target.value as Allowance["mode"])
              }
            >
              <option value="time_budget">Minutes per day</option>
              <option value="count">Page opens per day</option>
              <option value="interval">Minutes in each interval</option>
            </select>
          </Field>
          <Field
            id="limit-domain"
            label="Website or URL"
            helper="Enter a site-specific domain."
          >
            <input
              id="limit-domain"
              value={domainInput}
              placeholder="example.com"
              onChange={(event) => {
                setDomainInput(event.target.value);
                if (formError) setFormError("");
              }}
              required
            />
          </Field>
          <Field
            id="limit-amount"
            label={
              mode === "time_budget"
                ? "Minutes allowed per day"
                : mode === "count"
                  ? "Page opens allowed per day"
                  : "Minutes allowed per interval"
            }
          >
            <input
              id="limit-amount"
              type="number"
              min={1}
              max={mode === "count" ? 100 : 1_440}
              value={amount}
              onChange={(event) => {
                setAmount(event.target.value);
                if (formError) setFormError("");
              }}
              required
            />
          </Field>
          <div className="fg-wrap" role="group" aria-label="Limit presets">
            {(mode === "time_budget"
              ? [5, 10, 15, 30, 60, 120]
              : mode === "count"
                ? [1, 2, 3, 5, 10]
                : [5, 10, 15, 30, 60, 120, 180, 240, 360, 720, 1440]
            ).map((preset) => (
              <button
                className={`fg-duration-chip ${amount === String(preset) ? "is-selected" : ""}`}
                type="button"
                key={preset}
                aria-pressed={amount === String(preset)}
                onClick={() => {
                  setAmount(String(preset));
                  setFormError("");
                }}
              >
                {mode === "count"
                  ? `${preset} opens`
                  : mode === "interval" && preset >= 60
                    ? `${preset / 60} h`
                    : `${preset} min`}
              </button>
            ))}
          </div>
          {mode === "interval" && (
            <Field
              id="limit-period"
              label="Window length in minutes"
              helper="Maximum 10080 minutes (168 hours)."
            >
              <input
                id="limit-period"
                type="number"
                min={1}
                max={10_080}
                value={period}
                onChange={(event) => {
                  setPeriod(event.target.value);
                  if (formError) setFormError("");
                }}
                required
              />
            </Field>
          )}
          {formError && <p className="fg-field__error" role="alert">{formError}</p>}
        </form>
      </Modal>
    </Card>
  );
}

function AllowanceRow({
  domain,
  allowance,
  lockedReason,
  usedMs,
  opens,
  onRemove,
  onChange,
}: {
  domain: string;
  allowance: Allowance;
  lockedReason: string | null;
  usedMs: number;
  opens: number;
  onRemove(): void;
  onChange(value: Allowance): void;
}) {
  const [amountDraft, setAmountDraft] = useState(String(allowanceValue(allowance)));
  const [periodDraft, setPeriodDraft] = useState(
    allowance.mode === "interval" ? String(allowance.everyMin) : "30",
  );
  const [error, setError] = useState("");
  useEffect(() => {
    setAmountDraft(String(allowanceValue(allowance)));
    setPeriodDraft(
      allowance.mode === "interval" ? String(allowance.everyMin) : "30",
    );
    setError("");
  }, [allowance]);

  const limitValue = allowanceValue(allowance);
  const usedValue =
    allowance.mode === "count" ? opens : Math.floor(usedMs / 60_000);
  const progress = Math.max(0, Math.min(1, usedValue / Math.max(1, limitValue)));
  const usageLabel =
    allowance.mode === "count"
      ? `${usedValue} of ${limitValue} opens used`
      : allowance.mode === "interval"
        ? `${usedValue} of ${limitValue} minutes used in this interval`
        : `${usedValue} of ${limitValue} minutes used today`;

  function setMode(nextMode: Allowance["mode"]) {
    const next: Allowance =
      nextMode === "time_budget"
        ? { mode: nextMode, limitMin: 60, duringBlocks: allowance.duringBlocks }
        : nextMode === "count"
          ? { mode: nextMode, maxOpens: 5, duringBlocks: allowance.duringBlocks }
          : {
              mode: nextMode,
              allowMin: 5,
              everyMin: 60,
              duringBlocks: allowance.duringBlocks,
            };
    setAmountDraft(String(allowanceValue(next)));
    setPeriodDraft(next.mode === "interval" ? String(next.everyMin) : "30");
    setError("");
    onChange(next);
  }

  function saveValues() {
    const amount = Number(amountDraft);
    const period = Number(periodDraft);
    const max = allowance.mode === "count" ? 100 : 1_440;
    if (!Number.isInteger(amount) || amount < 1 || amount > max) {
      setError(`Enter a whole number from 1 to ${max}.`);
      return;
    }
    if (
      allowance.mode === "interval" &&
      (!Number.isInteger(period) || period < 1 || period > 10_080)
    ) {
      setError("Enter a window length from 1 to 10080 minutes.");
      return;
    }
    setError("");
    onChange(
      allowance.mode === "time_budget"
        ? { ...allowance, limitMin: amount }
        : allowance.mode === "count"
          ? { ...allowance, maxOpens: amount }
          : { ...allowance, allowMin: amount, everyMin: period },
    );
  }

  return (
    <li className="fg-list-item fg-list-item--column">
      <div className="fg-row">
        <div className="fg-list-item__copy">
          <strong>{domain}</strong>
          <span className="fg-muted">{usageLabel}</span>
        </div>
        <Button
          variant="quiet"
          onClick={onRemove}
          aria-label={`Remove limit for ${domain}`}
          disabled={Boolean(lockedReason)}
          title={lockedReason ?? undefined}
        >
          Remove
        </Button>
      </div>
      <Field
        id={`allowance-mode-${domain}`}
        label="Limit type"
        helper={allowanceModeDescription(allowance.mode)}
      >
        <select
          id={`allowance-mode-${domain}`}
          value={allowance.mode}
          onChange={(event) => setMode(event.target.value as Allowance["mode"])}
        >
          <option value="time_budget">Minutes per day</option>
          <option value="count">Page opens per day</option>
          <option value="interval">Minutes in each interval</option>
        </select>
      </Field>
      <div className="fg-grid-two">
        <Field
          id={`allowance-value-${domain}`}
          label={allowance.mode === "count" ? "Opens allowed" : "Minutes allowed"}
          error={error || undefined}
        >
          <input
            id={`allowance-value-${domain}`}
            type="number"
            min={1}
            max={allowance.mode === "count" ? 10_000 : 1_440}
            value={amountDraft}
            onChange={(event) => setAmountDraft(event.target.value)}
            onBlur={saveValues}
          />
        </Field>
        {allowance.mode === "interval" && (
          <Field
            id={`allowance-period-${domain}`}
            label="Window length in minutes"
            helper="Maximum 10080 minutes (168 hours)."
          >
            <input
              id={`allowance-period-${domain}`}
              type="number"
              min={1}
              max={10_080}
              value={periodDraft}
              onChange={(event) => setPeriodDraft(event.target.value)}
              onBlur={saveValues}
            />
          </Field>
        )}
      </div>
      <div className="fg-limit-bar" role="img" aria-label={usageLabel}>
        <span style={{ width: `${progress * 100}%` }} />
      </div>
      <div className="fg-row">
        <Toggle
          label={`Also allow ${domain} during focus sessions and blocks`}
          description="When on, this site remains available during focus sessions, schedules, or standalone blocks while budget remains. The permanent-block list still takes priority."
          checked={allowance.duringBlocks}
          onCheckedChange={(duringBlocks) => onChange({ ...allowance, duringBlocks })}
        />
      </div>
    </li>
  );
}

function allowanceValue(allowance: Allowance): number {
  return allowance.mode === "time_budget"
    ? allowance.limitMin
    : allowance.mode === "count"
      ? allowance.maxOpens
      : allowance.allowMin;
}

function allowanceModeDescription(mode: Allowance["mode"]): string {
  switch (mode) {
    case "time_budget":
      return "The site is blocked when its daily minutes are used; the cap resets at local midnight.";
    case "count":
      return "The site is blocked after its daily page opens are used; the cap resets at local midnight.";
    case "interval":
      return "The site is blocked when its window minutes are used; the cap returns when the window resets.";
  }
}
