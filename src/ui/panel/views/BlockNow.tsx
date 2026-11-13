import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { ShieldX } from "lucide-react";
import { normalizeDomain } from "../../../shared/domains.ts";
import {
  fromLocalDateTimeInput,
  isValidStandaloneExpiry,
  STANDALONE_ACKNOWLEDGEMENT_MS,
  toLocalDateTimeInput,
} from "../../../shared/standalone.ts";
import type { AppState } from "../../../shared/types.ts";
import { Button, Card, Chip, Field, ListRow, Sheet } from "../../components/primitives.tsx";
import { useToast } from "../../components/feedback.tsx";
import {
  addDomainsToText,
  domainsInText,
  pickableGroups,
  removeDomainsFromText,
  siteEntries,
  toggleDomainInText,
} from "../../lib/blockNowPicker.ts";
import type { PickableGroup } from "../../lib/blockNowPicker.ts";
import { sendStandaloneMessage } from "../../lib/standaloneActions.ts";

const STANDALONE_EXPIRY_PRESETS = [
  { label: "+30 min", minutes: 30 },
  { label: "+1 hour", minutes: 60 },
  { label: "+4 hours", minutes: 240 },
  { label: "+24 hours", minutes: 1_440 },
] as const;
const STANDALONE_EXTENSIONS = [15, 30, 60, 120] as const;

/** Plain-language promise shown wherever Block now is started or running. */
export function BlockNowLockNote({ running }: { running: boolean }) {
  return (
    <div className="fg-stack">
      <p className="fg-muted">
        <strong>It never uses your password.</strong> Block now works the same
        with or without one, and it can’t be stopped early with a password
        either.
      </p>
      <p className="fg-muted">
        {running ? "Until it ends" : "While it runs"}, FocusGate also refuses
        these, even with your password: removing or loosening sites, keywords,
        schedules and limits; turning content filters off; changing or removing
        the password; and <strong>Reset all data</strong>. You can still add
        more sites and extend the time.
      </p>
    </div>
  );
}

function SitePicker({
  groups,
  selected,
  onToggle,
  onToggleGroup,
  groupActionLabel,
}: {
  groups: PickableGroup[];
  selected: ReadonlySet<string>;
  onToggle(domain: string): void;
  onToggleGroup(group: PickableGroup, allSelected: boolean): void;
  groupActionLabel(allSelected: boolean): string;
}) {
  if (groups.length === 0) {
    return (
      <p className="fg-muted">
        You have no sites in Rules yet. Add some there and they will appear here
        to pick from.
      </p>
    );
  }
  return (
    <div className="fg-stack">
      {groups.map((group) => {
        const allSelected = group.domains.every((domain) => selected.has(domain));
        return (
          <div key={group.id} className="fg-stack">
            <div className="fg-wrap">
              <strong className="fg-grow">{group.label}</strong>
              <Button
                variant="quiet"
                size="dense"
                onClick={() => onToggleGroup(group, allSelected)}
              >
                {groupActionLabel(allSelected)}
              </Button>
            </div>
            <div className="fg-wrap" role="group" aria-label={group.label}>
              {group.domains.map((domain) => {
                const on = selected.has(domain);
                return (
                  <Button
                    key={domain}
                    variant={on ? "primary" : "secondary"}
                    size="dense"
                    aria-pressed={on}
                    onClick={() => onToggle(domain)}
                  >
                    {on ? "✓ " : "+ "}
                    {domain}
                  </Button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Block now (a timed block with no early stop). Used by the side panel's Focus
 * screen and by the dashboard's own Block now tab, so both behave the same.
 */
export function BlockNow({
  state,
  canStart = true,
  layout = "panel",
}: {
  state: AppState;
  /** False while a focus session is running; the start card is hidden then. */
  canStart?: boolean;
  layout?: "panel" | "page";
}) {
  const showToast = useToast();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [untilText, setUntilText] = useState(() =>
    toLocalDateTimeInput(Date.now() + 60 * 60_000),
  );
  const [longAcknowledged, setLongAcknowledged] = useState(false);
  const [sitesText, setSitesText] = useState("");
  const [siteInput, setSiteInput] = useState("");
  const [error, setError] = useState("");

  const atTime = Date.now();
  const active =
    state.standalone.active &&
    state.standalone.startsAt <= atTime &&
    atTime < state.standalone.until;

  const until = fromLocalDateTimeInput(untilText);
  const entries = useMemo(() => siteEntries(sitesText), [sitesText]);
  const previewSites = useMemo(() => domainsInText(sitesText), [sitesText]);
  const selected = useMemo(() => new Set(previewSites), [previewSites]);
  const untilDelta = until === null ? 0 : until - Date.now();

  const startGroups = useMemo(() => pickableGroups(state), [state]);
  const addGroups = useMemo(
    () => pickableGroups(state, state.standalone.sites),
    [state],
  );

  async function start(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const at = Date.now();
    const end = fromLocalDateTimeInput(untilText);
    if (end === null || !isValidStandaloneExpiry(end, at)) {
      setError("Choose an end time from 5 minutes to 30 days from now.");
      return;
    }
    if (entries.length === 0) {
      setError("Add at least one website to block.");
      return;
    }
    if (previewSites.length === 0) {
      setError("None of those look like websites. Try something like reddit.com.");
      return;
    }
    if (previewSites.length > 500) {
      setError("Block now can contain at most 500 sites.");
      return;
    }
    if (end - at > STANDALONE_ACKNOWLEDGEMENT_MS && !longAcknowledged) {
      setError("Confirm that you understand this block has no early stop.");
      return;
    }
    const reply = await sendStandaloneMessage({
      type: "standalone/start",
      until: end,
      sites: previewSites,
    });
    if (!reply.ok) {
      setError(reply.message ?? "The block could not be started.");
      return;
    }
    setError("");
    setSheetOpen(false);
    setSitesText("");
    setLongAcknowledged(false);
    showToast("Block now started.", "success");
    if (reply.warning) showToast(reply.warning, "error");
  }

  async function extend(minutes: number): Promise<void> {
    const reply = await sendStandaloneMessage({
      type: "standalone/extend",
      minutes,
    });
    if (!reply.ok) {
      showToast(reply.message ?? "The block could not be extended.", "error");
      return;
    }
    showToast(`Block extended by ${minutes} minutes.`, "success");
    if (reply.warning) showToast(reply.warning, "error");
  }

  async function addSites(sites: string[], event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (sites.length === 0) {
      setError("Enter a website to add.");
      return;
    }
    const reply = await sendStandaloneMessage({
      type: "standalone/addSites",
      sites,
    });
    if (!reply.ok) {
      setError(reply.message ?? "The site could not be added.");
      return;
    }
    setSiteInput("");
    setError("");
    showToast(
      sites.length === 1
        ? "Site added to Block now."
        : `${sites.length} sites added to Block now.`,
      "success",
    );
    if (reply.warning) showToast(reply.warning, "error");
  }

  function openSetup() {
    setError("");
    setUntilText(toLocalDateTimeInput(Date.now() + 60 * 60_000));
    setLongAcknowledged(false);
    setSitesText("");
    setSheetOpen(true);
  }

  const wide = layout === "page";

  return (
    <>
      {active ? (
        <Card
          title="Block now"
          description={
            wide
              ? "Running. It can’t be stopped early, but you can add sites or extend it."
              : undefined
          }
        >
          <ListRow
            title={`${state.standalone.sites.length} site${
              state.standalone.sites.length === 1 ? "" : "s"
            } blocked`}
            sub={`Ends ${new Date(state.standalone.until).toLocaleString([], {
              ...(wide ? { weekday: "short", day: "numeric", month: "short" } : {}),
              hour: "numeric",
              minute: "2-digit",
            })}`}
          />
          {wide && (
            <div className="fg-wrap" aria-label="Sites in this block">
              {state.standalone.sites.map((site) => (
                <Chip key={site}>{site}</Chip>
              ))}
            </div>
          )}
          <form
            className="fg-wrap"
            onSubmit={(event) => {
              const site = normalizeDomain(siteInput.trim());
              void addSites(site ? [site] : [], event);
            }}
          >
            <input
              className="fg-input fg-grow"
              value={siteInput}
              placeholder="Add a site to this block"
              aria-label="Add a site to this block"
              onChange={(event) => {
                setSiteInput(event.target.value);
                setError("");
              }}
            />
            <Button variant="secondary" size="dense" type="submit">
              Add
            </Button>
          </form>
          {error && (
            <p className="fg-field__error" role="alert">
              {error}
            </p>
          )}
          {addGroups.length > 0 && (
            <>
              <p className="fg-section-label">Add from your rules</p>
              <SitePicker
                groups={addGroups}
                selected={new Set()}
                onToggle={(domain) => void addSites([domain])}
                onToggleGroup={(group) => void addSites(group.domains)}
                groupActionLabel={() => "Add all"}
              />
            </>
          )}
          <div className="fg-wrap" role="group" aria-label="Extend block">
            {STANDALONE_EXTENSIONS.map((minutes) => (
              <Button
                key={minutes}
                variant="secondary"
                size="dense"
                onClick={() => void extend(minutes)}
              >
                +{minutes < 60 ? `${minutes} min` : `${minutes / 60} h`}
              </Button>
            ))}
          </div>
          <BlockNowLockNote running />
        </Card>
      ) : !canStart ? (
        layout === "page" && (
          <Card title="Block now">
            <p className="fg-muted">
              A focus session is running, and it already blocks your sites. You
              can set up Block now as soon as it ends.
            </p>
          </Card>
        )
      ) : (
        canStart && (
          <Card title="Block now">
            <ListRow
              swatch={<ShieldX aria-hidden="true" className="fg-icon-16" />}
              title="Timed block with no early stop"
              sub="Block selected sites without starting a focus session."
              actions={
                <Button variant="secondary" size="dense" onClick={openSetup}>
                  Set up…
                </Button>
              }
            />
            {wide && <BlockNowLockNote running={false} />}
          </Card>
        )
      )}

      <Sheet
        open={sheetOpen}
        title="Block now"
        onClose={() => setSheetOpen(false)}
        footer={
          <Button variant="primary" wide type="submit" form="standalone-start-form">
            Confirm and start
          </Button>
        }
      >
        <form
          id="standalone-start-form"
          className="fg-stack"
          onSubmit={(event) => void start(event)}
        >
          <Field
            id="standalone-until"
            label="End date and time"
            helper="Choose an end time from 5 minutes to 30 days from now. There is no early stop; you can extend or add sites."
            error={error || undefined}
          >
            <div className="fg-wrap" role="group" aria-label="End time presets">
              {STANDALONE_EXPIRY_PRESETS.map((preset) => (
                <Button
                  key={preset.minutes}
                  variant="secondary"
                  size="dense"
                  onClick={() => {
                    setUntilText(
                      toLocalDateTimeInput(Date.now() + preset.minutes * 60_000),
                    );
                    setLongAcknowledged(false);
                    setError("");
                  }}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
            <input
              id="standalone-until"
              className="fg-input"
              type="datetime-local"
              value={untilText}
              onChange={(event) => {
                setUntilText(event.target.value);
                setLongAcknowledged(false);
                setError("");
              }}
            />
          </Field>
          <Field
            id="standalone-sites"
            label="Sites to block"
            helper="Pick from your rules below, or type domains or URLs, one per line or comma-separated (up to 500)."
          >
            <SitePicker
              groups={startGroups}
              selected={selected}
              onToggle={(domain) => {
                setSitesText((text) => toggleDomainInText(text, domain));
                setError("");
              }}
              onToggleGroup={(group, allSelected) => {
                setSitesText((text) =>
                  allSelected
                    ? removeDomainsFromText(text, group.domains)
                    : addDomainsToText(text, group.domains),
                );
                setError("");
              }}
              groupActionLabel={(allSelected) =>
                allSelected ? "Remove all" : "Add all"
              }
            />
            <textarea
              id="standalone-sites"
              className="fg-textarea"
              rows={4}
              value={sitesText}
              placeholder={"example.com\nreddit.com"}
              onChange={(event) => {
                setSitesText(event.target.value);
                setError("");
              }}
            />
          </Field>
          {untilDelta > STANDALONE_ACKNOWLEDGEMENT_MS && (
            <label className="fg-field">
              <span className="fg-field__label">
                <input
                  type="checkbox"
                  checked={longAcknowledged}
                  onChange={(event) => setLongAcknowledged(event.target.checked)}
                  className="fg-mr-8"
                />
                I understand this block lasts over 24 hours and has no early-stop
                action.
              </span>
            </label>
          )}
          <BlockNowLockNote running={false} />
        </form>
      </Sheet>
    </>
  );
}
