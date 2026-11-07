import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Eye, Search } from "lucide-react";
import type {
  Allowance,
  AppState,
  KeywordRule,
} from "../../../shared/types.ts";
import { normalizeDomain, matchesDomain } from "../../../shared/domains.ts";
import { assessUrl, computeBlockPlan } from "../../../shared/plan.ts";
import { BUILT_IN_PRESETS } from "../../../shared/presets.ts";
import {
  Button,
  Card,
  Chip,
  EmptyState,
  Field,
  ListRow,
  Progress,
  Segmented,
} from "../../components/primitives.tsx";
import { useToast } from "../../components/feedback.tsx";
import { uiStorageStore } from "../../hooks/storageStore.ts";
import { storageWriteErrorMessage } from "../../lib/guardPrompts.ts";
import { weakeningLockReason } from "../../lib/guardState.ts";
import { aliasesForSiteDisplay } from "../../lib/aliasPresentation.ts";
import { ScheduleSection } from "./ScheduleSection.tsx";

export type RuleSection = "sites" | "keywords" | "schedule" | "limits";
type SiteMode = "focus" | "always";
type KeywordMode = KeywordRule["mode"];

const RULE_SECTIONS: ReadonlyArray<{ value: RuleSection; label: string }> = [
  { value: "sites", label: "Sites" },
  { value: "keywords", label: "Keywords" },
  { value: "schedule", label: "Schedule" },
  { value: "limits", label: "Limits" },
];

export function RulesScreen({
  state,
  density = "narrow",
  jumpTo,
}: {
  state: AppState;
  density?: "narrow" | "wide";
  /** Switches to a section when `nonce` changes, for links from the status strip. */
  jumpTo?: { section: RuleSection; nonce: number };
}) {
  const [section, setSection] = useState<RuleSection>("sites");
  const jumpNonce = jumpTo?.nonce;
  useEffect(() => {
    if (jumpTo) setSection(jumpTo.section);
    // Only a new nonce is a new request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jumpNonce]);
  const lockedReason = weakeningLockReason(state);

  return (
    <div className="fg-stack">
      <UrlCheckRow state={state} />
      {lockedReason && (
        <p id="lock-reason" className="fg-field__helper" role="status">
          {lockedReason} Additions that strengthen protection remain available.
        </p>
      )}
      <Segmented
        label="Rule sections"
        options={RULE_SECTIONS}
        value={section}
        onChange={setSection}
      />
      {section === "sites" && <SitesSection state={state} lockedReason={lockedReason} />}
      {section === "keywords" && <KeywordsSection state={state} lockedReason={lockedReason} />}
      {section === "schedule" && <ScheduleSection state={state} lockedReason={lockedReason} />}
      {section === "limits" && <LimitsSection state={state} lockedReason={lockedReason} />}
      {/* density is applied by the host surface; kept for the shared-view rule */}
      <span hidden data-density={density} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Check a URL (design.md §5.3 top row)                                */
/* ------------------------------------------------------------------ */

function UrlCheckRow({ state }: { state: AppState }) {
  const [input, setInput] = useState("");
  const [result, setResult] = useState<string | null>(null);

  function check() {
    const value = input.trim();
    if (!value) {
      setResult(null);
      return;
    }
    const candidate = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    try {
      const parsed = new URL(candidate);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        setResult(null);
        return;
      }
      setResult(parsed.href);
    } catch {
      setResult(null);
    }
  }

  const assessment = result ? assessUrl(result, state, Date.now()) : null;
  let reasonCopy = "";
  if (result && assessment) {
    if (assessment.exception) {
      reasonCopy = `Allowed by exception: ${assessment.exception}.`;
    } else if (assessment.reason) {
      switch (assessment.reason.kind) {
        case "always":
          reasonCopy = "On your permanent 24/7 block list.";
          break;
        case "session":
          reasonCopy = "On your focus site list.";
          break;
        case "standalone":
          reasonCopy = "In the running Block now list.";
          break;
        case "schedule":
          reasonCopy = `Schedule: ${assessment.reason.name}.`;
          break;
        case "allowance":
          reasonCopy = "Daily limit reached.";
          break;
        case "allowOnly":
          reasonCopy = "This domain is not on the focus allowlist.";
          break;
        case "keyword":
          reasonCopy = `Keyword “${assessment.reason.keyword}” matched the ${assessment.reason.where}.`;
          break;
      }
    } else {
      reasonCopy = "No active rule blocks this URL.";
    }
  }

  return (
    <Card title="Check a URL">
      <div className="fg-wrap">
        <Search aria-hidden="true" className="fg-icon-16" />
        <input
          className="fg-input fg-grow"
          value={input}
          placeholder="Paste any address to check"
          aria-label="URL to check"
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              check();
            }
          }}
        />
        <Button variant="secondary" size="dense" onClick={check}>
          Check
        </Button>
      </div>
      {result && assessment && (
        <p className="fg-field__helper" role="status">
          <strong>{assessment.blocked ? "Blocked" : "Allowed"}</strong> — {reasonCopy}
          {assessment.nextChangeAt !== null && (
            <>
              {" "}
              Next change at{" "}
              {new Date(assessment.nextChangeAt).toLocaleTimeString([], {
                hour: "numeric",
                minute: "2-digit",
              })}
              .
            </>
          )}
        </p>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Sites (quick block, add, list, aliases, exceptions, presets)         */
/* ------------------------------------------------------------------ */

function SitesSection({
  state,
  lockedReason,
}: {
  state: AppState;
  lockedReason: string | null;
}) {
  const showToast = useToast();
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<SiteMode>("focus");
  const [exceptionsOpen, setExceptionsOpen] = useState(false);
  const [presetsOpen, setPresetsOpen] = useState(false);
  const plan = useMemo(() => assessBlockedNow(state), [state]);

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
    return [...sites.entries()].sort(([left], [right]) => left.localeCompare(right));
  }, [state.alwaysBlockedSites, state.blockedSites]);

  async function addSite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const domain = normalizeDomain(input);
    if (!domain) {
      showToast("Enter a valid website address or domain.", "error");
      return;
    }
    const key = mode === "focus" ? "blockedSites" : "alwaysBlockedSites";
    try {
      await uiStorageStore.set(key, (latest) =>
        latest.includes(domain) ? latest : [...latest, domain],
      );
      setInput("");
      showToast(`${domain} added to ${mode === "focus" ? "Focus" : "Always"}.`, "success");
    } catch (error) {
      showToast(storageWriteErrorMessage(error, "The site could not be saved."), "error");
    }
  }

  async function removeSite(domain: string, siteMode: SiteMode) {
    const key = siteMode === "focus" ? "blockedSites" : "alwaysBlockedSites";
    try {
      await uiStorageStore.set(key, (latest) => latest.filter((item) => item !== domain));
      showToast(`${domain} removed.`, "success");
    } catch (error) {
      showToast(storageWriteErrorMessage(error, "The site could not be removed."), "error");
    }
  }

  async function removeAlias(domain: string, alias: string) {
    try {
      await uiStorageStore.set("aliasExclusions", (current) => ({
        ...current,
        [domain]: [...new Set([...(current[domain] ?? []), alias])],
      }));
      showToast(`${alias} will no longer be blocked through ${domain}.`, "success");
    } catch (error) {
      showToast(storageWriteErrorMessage(error, "The alias could not be removed."), "error");
    }
  }

  async function blockCurrentSite(): Promise<void> {
    if (typeof chrome === "undefined" || !chrome.tabs?.query) return;
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url) {
      showToast("No active tab address to block.", "info");
      return;
    }
    const domain = normalizeDomain(new URL(tab.url).hostname);
    if (!domain) {
      showToast("No active tab address to block.", "info");
      return;
    }
    try {
      await uiStorageStore.set("blockedSites", (latest) =>
        latest.includes(domain) ? latest : [...latest, domain],
      );
      showToast(`${domain} added to Focus.`, "success");
    } catch (error) {
      showToast(storageWriteErrorMessage(error, "The site could not be saved."), "error");
    }
  }

  return (
    <div className="fg-stack">
      <Card title="Add a site">
        <form className="fg-stack" onSubmit={addSite}>
          <Field
            id="site-domain"
            label="Website or URL"
            helper="Paste a URL or enter a domain, such as reddit.com."
          >
            <input
              id="site-domain"
              className="fg-input"
              value={input}
              autoComplete="url"
              placeholder="https://www.reddit.com/r/all"
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
          <Button variant="primary" type="submit">
            Add site
          </Button>
        </form>
      </Card>

      <Card
        title="Blocked sites"
        actions={
          <Button variant="secondary" size="dense" onClick={() => void blockCurrentSite()}>
            Block current site
          </Button>
        }
      >
        {allSites.length === 0 ? (
          <EmptyState
            title="No sites yet"
            description="Add a site above, or use Block current site."
          />
        ) : (
          <div className="fg-list">
            {allSites.map(([domain, modes]) => {
              const blockedNow =
                plan.blocked.has(domain) ||
                [...plan.blocked.keys()].some((active) => matchesDomain(domain, active));
              const aliases = aliasesForSiteDisplay(domain, state.aliasExclusions[domain] ?? []);
              const scheduleNames = state.schedules
                .filter(
                  (schedule) =>
                    schedule.enabled &&
                    (schedule.sites.some(
                      (site) => matchesDomain(domain, site) || matchesDomain(site, domain),
                    ) ||
                      (schedule.useGlobalLists &&
                        (state.blockedSites.includes(domain) ||
                          state.alwaysBlockedSites.includes(domain)))),
                )
                .map((schedule) => schedule.name);
              return (
                <ListRow
                  key={domain}
                  blocking={blockedNow}
                  swatch={domain.charAt(0).toUpperCase()}
                  title={domain}
                  status={
                    blockedNow ? <Chip tone="warning">Blocked now</Chip> : undefined
                  }
                  chips={
                    <>
                      {[...modes].map((siteMode) => (
                        <Chip
                          key={siteMode}
                          tone={siteMode === "always" ? "strong" : "neutral"}
                        >
                          {siteMode === "always" ? "Always" : "Focus"}
                        </Chip>
                      ))}
                      {scheduleNames.map((name) => (
                        <Chip key={name}>{`Schedule: ${name}`}</Chip>
                      ))}
                      {aliases.map((alias) => (
                        <Chip
                          key={`alias:${alias}`}
                          onRemove={() => void removeAlias(domain, alias)}
                          removeLabel={`Stop blocking ${alias} through ${domain}`}
                        >
                          {alias}
                        </Chip>
                      ))}
                    </>
                  }
                  actions={
                    [...modes].map((siteMode) => (
                      <Button
                        key={siteMode}
                        variant="quiet"
                        size="dense"
                        disabled={Boolean(lockedReason)}
                        title={lockedReason ?? undefined}
                        aria-describedby={lockedReason ? "lock-reason" : undefined}
                        aria-label={`Remove ${domain} from ${siteMode === "focus" ? "Focus" : "Always"} rules`}
                        onClick={() => void removeSite(domain, siteMode)}
                      >
                        Remove
                      </Button>
                    ))
                  }
                />
              );
            })}
          </div>
        )}
      </Card>

      <Card>
        <ListRow
          title={`Exceptions (${state.exceptions.length})`}
          sub="Pages you allow even when their site is blocked."
          actions={
            <Button
              variant="quiet"
              size="dense"
              aria-expanded={exceptionsOpen}
              onClick={() => setExceptionsOpen((open) => !open)}
            >
              <Eye aria-hidden="true" className="fg-icon-16" />
              {exceptionsOpen ? "Hide" : "Show"}
            </Button>
          }
        />
        {exceptionsOpen && (
          <ExceptionsBlock state={state} lockedReason={lockedReason} />
        )}
      </Card>

      <Card>
        <ListRow
          title={`Presets (${state.customPresets.length} custom)`}
          sub="Ready-made lists and your own saved sets."
          actions={
            <Button
              variant="quiet"
              size="dense"
              aria-expanded={presetsOpen}
              onClick={() => setPresetsOpen((open) => !open)}
            >
              <Eye aria-hidden="true" className="fg-icon-16" />
              {presetsOpen ? "Hide" : "Show"}
            </Button>
          }
        />
        {presetsOpen && <PresetsBlock state={state} mode={mode} />}
      </Card>
    </div>
  );
}

function assessBlockedNow(state: AppState) {
  return computeBlockPlan(state, Date.now());
}

function ExceptionsBlock({
  state,
  lockedReason,
}: {
  state: AppState;
  lockedReason: string | null;
}) {
  const showToast = useToast();
  const [input, setInput] = useState("");

  async function addException(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    let url: URL;
    try {
      url = new URL(input.trim());
    } catch {
      showToast("Enter a complete page URL, including https://.", "error");
      return;
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      showToast("Only http and https page addresses can be excepted.", "error");
      return;
    }
    const normalized = `${url.origin}${url.pathname}${url.search}`.replace(/\/$/, "");
    try {
      await uiStorageStore.set("exceptions", (latest) =>
        latest.includes(normalized) ? latest : [...latest, normalized],
      );
      setInput("");
      showToast("Exception added.", "success");
    } catch (error) {
      showToast(storageWriteErrorMessage(error, "The exception could not be saved."), "error");
    }
  }

  return (
    <div className="fg-stack fg-stack--offset">
      <form className="fg-wrap" onSubmit={addException}>
        <input
          className="fg-input fg-grow"
          value={input}
          placeholder="https://youtube.com/watch?v=abc123"
          aria-label="Page address to allow"
          onChange={(event) => setInput(event.target.value)}
        />
        <Button
          variant="secondary"
          size="dense"
          type="submit"
          disabled={Boolean(lockedReason)}
          aria-describedby={lockedReason ? "lock-reason" : undefined}
        >
          Allow page
        </Button>
      </form>
      {state.exceptions.length === 0 ? (
        <p className="fg-field__helper">No exceptions yet.</p>
      ) : (
        <div className="fg-list">
          {state.exceptions.map((exception) => (
            <ListRow
              key={exception}
              title={exception}
              actions={
                <Button
                  variant="quiet"
                  size="dense"
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
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PresetsBlock({ state, mode }: { state: AppState; mode: SiteMode }) {
  const showToast = useToast();
  const [selected, setSelected] = useState<string[]>([]);
  const presets = [...BUILT_IN_PRESETS, ...state.customPresets];

  async function addSelected() {
    const domains = [
      ...new Set(
        presets
          .filter((preset) => selected.includes(preset.id))
          .flatMap((preset) => preset.domains),
      ),
    ];
    if (domains.length === 0) return;
    const key = mode === "always" ? "alwaysBlockedSites" : "blockedSites";
    try {
      await uiStorageStore.set(key, (latest) => [...new Set([...latest, ...domains])]);
      setSelected([]);
      showToast(
        `Added ${domains.length} site${domains.length === 1 ? "" : "s"} to ${
          mode === "always" ? "Always" : "Focus"
        }.`,
        "success",
      );
    } catch (error) {
      showToast(storageWriteErrorMessage(error, "The selected sites could not be added."), "error");
    }
  }

  return (
    <div className="fg-stack fg-stack--offset">
      {presets.map((preset) => (
        <ListRow
          key={preset.id}
          swatch={preset.emoji}
          title={preset.name}
          sub={`${preset.domains.length} sites · ${preset.domains.slice(0, 3).join(", ")}`}
          actions={
            <input
              type="checkbox"
              checked={selected.includes(preset.id)}
              aria-label={`Select preset ${preset.name}`}
              onChange={() =>
                setSelected((current) =>
                  current.includes(preset.id)
                    ? current.filter((id) => id !== preset.id)
                    : [...current, preset.id],
                )
              }
            />
          }
        />
      ))}
      <Button variant="secondary" size="dense" disabled={selected.length === 0} onClick={() => void addSelected()}>
        Add selected
      </Button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Keywords                                                            */
/* ------------------------------------------------------------------ */

function KeywordsSection({
  state,
  lockedReason,
}: {
  state: AppState;
  lockedReason: string | null;
}) {
  const showToast = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<KeywordMode>("block");
  const [when, setWhen] = useState<KeywordRule["when"]>("blocks");
  const [logOpen, setLogOpen] = useState(false);

  async function addKeywords(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const entries = [
      ...new Set(
        input
          .split(/[,\n]/)
          .map((word) => word.trim().toLowerCase())
          .filter(Boolean),
      ),
    ];
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
      setAddOpen(false);
      showToast(`${entries.length} keyword${entries.length === 1 ? "" : "s"} saved.`, "success");
    } catch (error) {
      showToast(storageWriteErrorMessage(error, "The keywords could not be saved."), "error");
    }
  }

  return (
    <div className="fg-stack">
      <Card
        title="Keywords"
        description="Block searches and page addresses, or hide matching feed items on supported pages."
        actions={
          <Button variant="primary" size="dense" onClick={() => setAddOpen(true)}>
            Add keywords
          </Button>
        }
      >
        {state.keywords.length === 0 ? (
          <EmptyState
            title="No keywords yet"
            description="Add words to block matching pages or hide matching feed items."
          />
        ) : (
          <div className="fg-list">
            {state.keywords.map((rule) => (
              <ListRow
                key={`${rule.text}:${rule.mode}:${rule.when}`}
                title={rule.text}
                chips={
                  <>
                    <Chip>{rule.mode}</Chip>
                    <Chip tone={rule.when === "always" ? "strong" : "neutral"}>
                      {rule.when === "always" ? "Always" : "During blocks"}
                    </Chip>
                  </>
                }
                actions={
                  <Button
                    variant="quiet"
                    size="dense"
                    disabled={Boolean(lockedReason)}
                    title={lockedReason ?? undefined}
                        aria-describedby={lockedReason ? "lock-reason" : undefined}
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
                }
              />
            ))}
          </div>
        )}
      </Card>

      <Card>
        <ListRow
          title={`Recent matches (${state.keywordMatches.length})`}
          sub="The last 50 matches recorded while keywords were active."
          actions={
            <>
              <Button
                variant="quiet"
                size="dense"
                aria-expanded={logOpen}
                onClick={() => setLogOpen((open) => !open)}
              >
                <Eye aria-hidden="true" className="fg-icon-16" />
                {logOpen ? "Hide" : "Show"}
              </Button>
              {state.keywordMatches.length > 0 && (
                <Button
                  variant="quiet"
                  size="dense"
                  onClick={() => {
                    void uiStorageStore
                      .set("keywordMatches", [])
                      .then(() => showToast("Match log cleared.", "success"))
                      .catch((error) =>
                        showToast(
                          storageWriteErrorMessage(error, "The match log could not be cleared."),
                          "error",
                        ),
                      );
                  }}
                >
                  Clear
                </Button>
              )}
            </>
          }
        />
        {logOpen &&
          (state.keywordMatches.length === 0 ? (
            <p className="fg-field__helper">No matches recorded.</p>
          ) : (
            <div className="fg-list">
              {[...state.keywordMatches].reverse().map((match, index) => (
                <ListRow
                  key={`${match.at}:${match.keyword}:${index}`}
                  title={match.keyword}
                  sub={`${match.domain} · matched the ${match.where}`}
                />
              ))}
            </div>
          ))}
      </Card>

      <Sheet
        open={addOpen}
        title="Add keywords"
        onClose={() => setAddOpen(false)}
        footer={
          <Button variant="primary" wide type="submit" form="keywords-form">
            Save keywords
          </Button>
        }
      >
        <form id="keywords-form" className="fg-stack" onSubmit={addKeywords}>
          <Field id="keyword-list" label="Keywords" helper="Separate several with commas.">
            <textarea
              id="keyword-list"
              className="fg-textarea"
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
        </form>
      </Sheet>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Schedule                                                            */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* Limits (allowances)                                                 */
/* ------------------------------------------------------------------ */

function allowanceAmount(allowance: Allowance): number {
  return allowance.mode === "time_budget"
    ? allowance.limitMin
    : allowance.mode === "count"
      ? allowance.maxOpens
      : allowance.allowMin;
}

function LimitsSection({
  state,
  lockedReason,
}: {
  state: AppState;
  lockedReason: string | null;
}) {
  const showToast = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [domainInput, setDomainInput] = useState("");
  const [mode, setMode] = useState<Allowance["mode"]>("time_budget");
  const [amount, setAmount] = useState("60");
  const [period, setPeriod] = useState("60");
  const [formError, setFormError] = useState("");

  async function addLimit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = normalizeDomain(domainInput);
    if (!normalized) {
      setFormError("Enter a valid website address or domain.");
      return;
    }
    const amountValue = Number(amount);
    const periodValue = Number(period);
    if (mode === "time_budget") {
      if (!Number.isInteger(amountValue) || amountValue < 1 || amountValue > 1_440) {
        setFormError("Enter minutes from 1 to 1440.");
        return;
      }
    } else if (mode === "count") {
      if (!Number.isInteger(amountValue) || amountValue < 1 || amountValue > 100) {
        setFormError("Enter opens from 1 to 100.");
        return;
      }
    } else {
      if (!Number.isInteger(amountValue) || amountValue < 1 || amountValue > 1_440) {
        setFormError("Enter minutes from 1 to 1440.");
        return;
      }
      if (!Number.isInteger(periodValue) || periodValue < 1 || periodValue > 10_080) {
        setFormError("Enter a window length from 1 to 10080 minutes.");
        return;
      }
    }
    let exists = false;
    try {
      await uiStorageStore.set("allowances", (latest) => {
        if (latest[normalized]) {
          exists = true;
          return latest;
        }
        return {
          ...latest,
          [normalized]:
            mode === "time_budget"
              ? { mode, limitMin: amountValue, duringBlocks: true }
              : mode === "count"
                ? { mode, maxOpens: amountValue, duringBlocks: true }
                : { mode, allowMin: amountValue, everyMin: periodValue, duringBlocks: true },
        };
      });
      if (exists) {
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
    <div className="fg-stack">
      <Card
        title="Daily limits"
        description="A site is blocked after its budget is used until the day or window resets."
        actions={
          <Button
            variant="primary"
            size="dense"
            onClick={() => {
              setFormError("");
              setAddOpen(true);
            }}
          >
            Add limit
          </Button>
        }
      >
        {Object.entries(state.allowances).length === 0 ? (
          <EmptyState
            title="No daily limits"
            description="Add a site-specific allowance to set a daily cap."
          />
        ) : (
          <div className="fg-list">
            {Object.entries(state.allowances).map(([domain, allowance]) => {
              const usage = state.usage[domain];
              const usedMinutes = Math.floor((usage?.usedMs ?? 0) / 60_000);
              const limitMinutes = allowance.mode === "time_budget" ? allowance.limitMin : null;
              const limitValue = allowanceAmount(allowance);
              const usedValue = allowance.mode === "count" ? (usage?.opens ?? 0) : usedMinutes;
              return (
                <div className="fg-stack fg-stack--entry" key={domain}>
                  <ListRow
                    title={domain}
                    sub={
                      allowance.mode === "count"
                        ? `${usedValue} of ${limitValue} opens used`
                        : `${usedMinutes} of ${limitMinutes ?? "—"} min used`
                    }
                    actions={
                      <Button
                        variant="quiet"
                        size="dense"
                        disabled={Boolean(lockedReason)}
                        aria-describedby={lockedReason ? "lock-reason" : undefined}
                        aria-label={`Remove limit for ${domain}`}
                        onClick={() => {
                          void uiStorageStore
                            .set("allowances", (latest) => {
                              const next = { ...latest };
                              delete next[domain];
                              return next;
                            })
                            .then(() => showToast("Daily limit removed.", "success"))
                            .catch((error) =>
                              showToast(
                                storageWriteErrorMessage(error, "The limit could not be removed."),
                                "error",
                              ),
                            );
                        }}
                      >
                        Remove
                      </Button>
                    }
                  />
                  {limitMinutes !== null && (
                    <Progress value={Math.min(1, usedMinutes / Math.max(1, limitMinutes))} />
                  )}
                  <Toggle
                    label="Also allow during focus sessions and blocks"
                    checked={allowance.duringBlocks}
                    onCheckedChange={(duringBlocks) => {
                      void uiStorageStore
                        .set("allowances", (latest) => ({
                          ...latest,
                          [domain]: { ...allowance, duringBlocks },
                        }))
                        .catch((error) =>
                          showToast(
                            storageWriteErrorMessage(error, "The setting could not be saved."),
                            "error",
                          ),
                        );
                    }}
                  />
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Sheet
        open={addOpen}
        title="Add a daily limit"
        onClose={() => setAddOpen(false)}
        footer={
          <Button variant="primary" wide type="submit" form="limit-form">
            Add limit
          </Button>
        }
      >
        <form id="limit-form" className="fg-stack" onSubmit={addLimit}>
          <Field id="limit-domain" label="Website or URL" helper="Enter a site-specific domain.">
            <input
              id="limit-domain"
              className="fg-input"
              value={domainInput}
              placeholder="example.com"
              onChange={(event) => {
                setDomainInput(event.target.value);
                if (formError) setFormError("");
              }}
              required
            />
          </Field>
          <Segmented
            label="Limit type"
            options={[
              { value: "time_budget", label: "Minutes/day" },
              { value: "count", label: "Opens/day" },
              { value: "interval", label: "Per interval" },
            ]}
            value={mode}
            onChange={(next) => {
              setMode(next as Allowance["mode"]);
              setAmount(next === "count" ? "5" : "60");
              setPeriod("60");
              setFormError("");
            }}
          />
          <Field
            id="limit-amount"
            label={mode === "count" ? "Opens per day" : "Minutes allowed"}
          >
            <input
              id="limit-amount"
              className="fg-input"
              type="number"
              min={1}
              max={mode === "count" ? 100 : 1_440}
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              required
            />
          </Field>
          {mode === "interval" && (
            <Field id="limit-period" label="Window length in minutes">
              <input
                id="limit-period"
                className="fg-input"
                type="number"
                min={1}
                max={10_080}
                value={period}
                onChange={(event) => setPeriod(event.target.value)}
                required
              />
            </Field>
          )}
          {formError && <p className="fg-field__error" role="alert">{formError}</p>}
        </form>
      </Sheet>

      {/* todayKey kept for the usage reset label */}
    </div>
  );
}
