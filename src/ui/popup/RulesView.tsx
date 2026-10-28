import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import type {
  Allowance,
  AppState,
  KeywordRule,
  Schedule,
} from "../../shared/types.ts";
import { matchesDomain, normalizeDomain } from "../../shared/domains.ts";
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
        {section === "sites" && <SitesPanel state={state} />}
        {section === "exceptions" && <ExceptionsPanel state={state} />}
        {section === "keywords" && <KeywordsPanel state={state} />}
        {section === "schedules" && <SchedulesPanel state={state} />}
        {section === "limits" && <LimitsPanel state={state} />}
      </div>
    </section>
  );
}

function SitesPanel({ state }: { state: AppState }) {
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
    } catch {
      showToast("The site could not be saved.", "error");
    }
  }

  async function removeSite(domain: string, siteMode: SiteMode) {
    const key = siteMode === "focus" ? "blockedSites" : "alwaysBlockedSites";
    try {
      await uiStorageStore.set(key, (latest) =>
        latest.filter((item) => item !== domain),
      );
      showToast(`${domain} removed.`, "success");
    } catch {
      showToast("The site could not be removed.", "error");
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

  return (
    <>
      <Card
        title="Check a URL"
        description="See whether a page is blocked by your current rules."
      >
        <UrlCheck state={state} />
      </Card>
      <Card title="Add a site">
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
                    {isBlockedNow(domain) && <Chip tone="accent">Blocked now</Chip>}
                  </div>
                </div>
                <div className="fg-list-item__actions">
                  {[...modes].map((siteMode) => (
                    <Button
                      key={siteMode}
                      variant="quiet"
                      aria-label={`Remove ${domain} from ${siteMode === "focus" ? "Focus" : "Always"} rules`}
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
        const parsed = new URL(value);
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

function ExceptionsPanel({ state }: { state: AppState }) {
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
    } catch {
      showToast("The exception could not be saved.", "error");
    }
  }
  return (
    <>
      <Card
        title="Allow one page"
        description="An exception allows a page even when its site is blocked."
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
          <Button type="submit">Add exception</Button>
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
                      .catch(() => showToast("The exception could not be removed.", "error"));
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

function KeywordsPanel({ state }: { state: AppState }) {
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
    } catch {
      showToast("The keywords could not be saved.", "error");
    }
  }

  return (
    <>
      <Card
        title="Add keywords"
        description="Separate several words with commas or new lines."
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
                      .catch(() => showToast("The keyword could not be removed.", "error"));
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

function SchedulesPanel({ state }: { state: AppState }) {
  const showToast = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState("");
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("17:00");
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]);

  async function addSchedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanName = name.trim();
    if (!cleanName || days.length === 0) {
      showToast("Add a name and choose at least one day.", "error");
      return;
    }
    if (!isClockTime(start) || !isClockTime(end, true)) {
      showToast("Use a valid start time and an end time up to 24:00.", "error");
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
      showToast("Schedule added.", "success");
    } catch {
      showToast("The schedule could not be saved.", "error");
    }
  }

  async function updateSchedule(id: string, changes: Partial<Schedule>) {
    try {
      await uiStorageStore.set("schedules", (latest) =>
        latest.map((schedule) =>
          schedule.id === id ? { ...schedule, ...changes } : schedule,
        ),
      );
    } catch {
      showToast("The schedule could not be updated.", "error");
    }
  }

  return (
    <>
      <Card
        title="Schedules"
        description="Block your chosen lists on the days and hours you set."
        actions={<Button onClick={() => setAddOpen(true)}>Add schedule</Button>}
      >
        {state.schedules.length === 0 ? (
          <EmptyState
            title="No schedules"
            description="Add a schedule to set recurring block hours."
            action={<Button onClick={() => setAddOpen(true)}>Add schedule</Button>}
          />
        ) : (
          <ul className="fg-list">
            {state.schedules.map((schedule) => (
              <li className="fg-list-item fg-list-item--column" key={schedule.id}>
                <div className="fg-row">
                  <div className="fg-list-item__copy">
                    <strong>{schedule.name}</strong>
                    <span className="fg-muted">
                      {schedule.days.map((day) => WEEKDAYS[day]).join(", ")} · {schedule.start}–{schedule.end}
                    </span>
                  </div>
                  <Toggle
                    label={`Enable ${schedule.name}`}
                    checked={schedule.enabled}
                    onCheckedChange={(enabled) =>
                      void updateSchedule(schedule.id, { enabled })
                    }
                  />
                </div>
                <div className="fg-wrap">
                  <Chip>{schedule.sites.length ? `${schedule.sites.length} custom sites` : "Use global lists"}</Chip>
                  {schedule.useGlobalLists && <Chip tone="accent">Also block global lists</Chip>}
                </div>
                <div className="fg-grid-two">
                  <Field id={`schedule-start-${schedule.id}`} label="Start">
                    <input
                      id={`schedule-start-${schedule.id}`}
                      type="time"
                      value={schedule.start}
                      onChange={(event) =>
                        void updateSchedule(schedule.id, { start: event.target.value })
                      }
                    />
                  </Field>
                  <Field id={`schedule-end-${schedule.id}`} label="End">
                    <input
                      id={`schedule-end-${schedule.id}`}
                      type="text"
                      inputMode="numeric"
                      value={schedule.end}
                      onChange={(event) =>
                        void updateSchedule(schedule.id, { end: event.target.value })
                      }
                      onBlur={(event) => {
                        if (isClockTime(event.target.value, true)) return;
                        void updateSchedule(schedule.id, { end: "17:00" });
                        showToast("Enter a valid end time or 24:00.", "info");
                      }}
                    />
                  </Field>
                </div>
                <div className="fg-wrap" aria-label={`Days for ${schedule.name}`}>
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
                        if (next.length === 0) {
                          showToast("A schedule needs at least one day.", "info");
                          return;
                        }
                        void updateSchedule(schedule.id, { days: next });
                      }}
                    >
                      {day}
                    </button>
                  ))}
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
          <div className="fg-wrap" aria-label="Schedule days">
            {WEEKDAYS.map((day, index) => (
              <button
                className={`fg-day-chip ${days.includes(index) ? "is-selected" : ""}`}
                key={day}
                type="button"
                aria-pressed={days.includes(index)}
                onClick={() =>
                  setDays((current) =>
                    current.includes(index)
                      ? current.filter((value) => value !== index)
                      : [...current, index].sort(),
                  )
                }
              >
                {day}
              </button>
            ))}
          </div>
          <p className="fg-muted">End time 24:00 means midnight at the end of the selected day.</p>
        </form>
      </Modal>
    </>
  );
}

function isClockTime(value: string, allowEndOfDay = false): boolean {
  if (allowEndOfDay && value === "24:00") return true;
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  return Boolean(match);
}

function LimitsPanel({ state }: { state: AppState }) {
  const showToast = useToast();
  const entries = Object.entries(state.allowances);
  const [addOpen, setAddOpen] = useState(false);
  const [domainInput, setDomainInput] = useState("");
  const [domainError, setDomainError] = useState("");
  async function addLimit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = normalizeDomain(domainInput);
    if (!normalized) {
      setDomainError("Enter a valid website address or domain.");
      return;
    }
    try {
      await uiStorageStore.set("allowances", (latest) => ({
        ...latest,
        [normalized]: {
          mode: "time_budget",
          limitMin: 60,
          duringBlocks: false,
        },
      }));
      setDomainInput("");
      setDomainError("");
      setAddOpen(false);
      showToast("A 60-minute daily limit was added.", "success");
    } catch {
      showToast("The limit could not be saved.", "error");
    }
  }
  return (
    <Card
      title="Daily limits"
      description="Set a daily allowance before pages are blocked until midnight."
      actions={<Button onClick={() => setAddOpen(true)}>Add limit</Button>}
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
              used={state.usage[domain]?.usedMs ?? 0}
              onRemove={async () => {
                try {
                  await uiStorageStore.set("allowances", (latest) => {
                    const next = { ...latest };
                    delete next[domain];
                    return next;
                  });
                  showToast("Daily limit removed.", "success");
                } catch {
                  showToast("The limit could not be removed.", "error");
                }
              }}
              onChange={async (next) => {
                try {
                  await uiStorageStore.set("allowances", (latest) => ({
                    ...latest,
                    [domain]: next,
                  }));
                } catch {
                  showToast("The limit could not be updated.", "error");
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
            id="limit-domain"
            label="Website or URL"
            helper="The limit starts at 60 minutes per day."
            error={domainError}
          >
            <input
              id="limit-domain"
              value={domainInput}
              placeholder="example.com"
              onChange={(event) => {
                setDomainInput(event.target.value);
                if (domainError) setDomainError("");
              }}
              required
            />
          </Field>
        </form>
      </Modal>
    </Card>
  );
}

function AllowanceRow({
  domain,
  allowance,
  used,
  onRemove,
  onChange,
}: {
  domain: string;
  allowance: Allowance;
  used: number;
  onRemove(): void;
  onChange(value: Allowance): void;
}) {
  const limitValue =
    allowance.mode === "time_budget"
      ? allowance.limitMin
      : allowance.mode === "count"
        ? allowance.maxOpens
        : allowance.allowMin;
  const usedValue =
    allowance.mode === "time_budget"
      ? Math.floor(used / 60_000)
      : allowance.mode === "count"
        ? 0
        : allowance.allowMin;
  const progress = Math.max(0, Math.min(1, usedValue / Math.max(1, limitValue)));
  return (
    <li className="fg-list-item fg-list-item--column">
      <div className="fg-row">
        <div className="fg-list-item__copy">
          <strong>{domain}</strong>
          <span className="fg-muted">
            {allowance.mode === "time_budget"
              ? `${allowance.limitMin} minutes per day`
              : allowance.mode === "count"
                ? `${allowance.maxOpens} opens per day`
                : `${allowance.allowMin} minutes every ${allowance.everyMin} minutes`}
          </span>
        </div>
        <Button variant="quiet" onClick={onRemove} aria-label={`Remove limit for ${domain}`}>
          Remove
        </Button>
      </div>
      <div className="fg-limit-bar" role="img" aria-label={`${usedValue} of ${limitValue} used`}>
        <span style={{ width: `${progress * 100}%` }} />
      </div>
      <div className="fg-row">
        <span className="fg-muted">Also applies during blocks</span>
        <Toggle
          label={`Apply limit during blocks for ${domain}`}
          checked={allowance.duringBlocks}
          onCheckedChange={(duringBlocks) =>
            onChange({ ...allowance, duringBlocks } as Allowance)
          }
        />
      </div>
    </li>
  );
}
