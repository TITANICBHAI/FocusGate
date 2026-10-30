import { useEffect, useState } from "react";
import type { AppState, Settings } from "../../shared/types.ts";
import { Button, Card, Field, Toggle } from "../components/primitives.tsx";
import { Tabs } from "../components/Tabs.tsx";
import { useToast } from "../components/feedback.tsx";
import { uiStorageStore } from "../hooks/storageStore.ts";
import { PasswordSettings } from "./PasswordSettings.tsx";
import { storageWriteErrorMessage } from "../lib/guardPrompts.ts";
import { CONTENT_FILTER_OPTIONS } from "../../content/sites.ts";
import { weakeningLockReason } from "../lib/guardState.ts";
import {
  canRequestHostAccess,
  checkProtection,
  extensionSettingsUrl,
  getBrowserProtectionApi,
  requestHostAccess,
  summarizeProtectionGaps,
} from "../lib/protectionStatus.ts";
import type { ProtectionPermission, ProtectionStatus } from "../lib/protectionStatus.ts";

type SettingsSection =
  | "security"
  | "appearance"
  | "timer"
  | "notifications"
  | "block-page"
  | "content"
  | "protection"
  | "data"
  | "about";

const SETTINGS_TABS = [
  { value: "security", label: "Security" },
  { value: "appearance", label: "Appearance" },
  { value: "timer", label: "Timer" },
  { value: "notifications", label: "Alerts" },
  { value: "block-page", label: "Block page" },
  { value: "content", label: "Content" },
  { value: "protection", label: "Protection" },
  { value: "data", label: "Data" },
  { value: "about", label: "About" },
] as const;

function localDateTime(value: number): string {
  return value > 0
    ? new Date(value).toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "Not recorded";
}

function permissionLabel(value: ProtectionPermission): string {
  if (value === "available") return "Available";
  if (value === "review") return "Needs review";
  if (value === "unavailable") return "Check unavailable";
  return "Checking";
}

function permissionClass(value: ProtectionPermission): string {
  return value === "review" ? "fg-field__error" : "fg-muted";
}

function ageLabel(value: number, now: number): string {
  if (value <= 0) return "Not recorded";
  const minutes = Math.max(0, Math.floor((now - value) / 60_000));
  if (minutes < 1) return "Less than a minute ago";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours < 24) return remainder ? `${hours} h ${remainder} min ago` : `${hours} h ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function gapDurationLabel(durationMs: number): string {
  const minutes = Math.ceil(durationMs / 60_000);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours} h ${remainder} min` : `${hours} h`;
}

export function SettingsView({ state }: { state: AppState }) {
  const [section, setSection] = useState<SettingsSection>("security");
  const [preStartText, setPreStartText] = useState(
    state.settings.reminders.preStartMin.join(", "),
  );
  const [midSessionText, setMidSessionText] = useState(
    state.settings.reminders.midSessionMin.join(", "),
  );
  const [quotesText, setQuotesText] = useState(
    state.settings.blockPage.quotes.join("\n"),
  );
  const showToast = useToast();
  const [protection, setProtection] = useState<ProtectionStatus>({
    incognito: "checking",
    siteAccess: "checking",
    notifications: "checking",
  });
  const [checkingProtection, setCheckingProtection] = useState(false);
  const browserApi = getBrowserProtectionApi();
  const browserSettingsUrl = extensionSettingsUrl(
    browserApi?.userAgent ?? "",
    browserApi?.id,
  );
  const lockReason = weakeningLockReason(state);

  async function refreshProtection() {
    setCheckingProtection(true);
    try {
      setProtection(await checkProtection(browserApi));
    } finally {
      setCheckingProtection(false);
    }
  }

  useEffect(() => {
    if (section === "protection") void refreshProtection();
  }, [section]);

  useEffect(() => {
    setPreStartText(state.settings.reminders.preStartMin.join(", "));
    setMidSessionText(state.settings.reminders.midSessionMin.join(", "));
    setQuotesText(state.settings.blockPage.quotes.join("\n"));
  }, [
    state.settings.blockPage.quotes,
    state.settings.reminders.midSessionMin,
    state.settings.reminders.preStartMin,
  ]);

  async function requestSiteAccess() {
    const result = await requestHostAccess(browserApi);
    if (!result.requested) {
      showToast("Open extension settings to grant site access.", "info");
    } else if (!result.granted) {
      showToast("Site access was not granted.", "info");
    } else {
      showToast("Site access granted.", "success");
    }
    await refreshProtection();
  }

  const protectionGaps = summarizeProtectionGaps(
    state.sessionHistory,
    state.session.gaps,
    Date.now(),
  );
  const updateSettings = async (
    updater: (current: Settings) => Settings,
    successMessage: string,
  ) => {
    try {
      await uiStorageStore.set("settings", updater);
      showToast(successMessage, "success");
    } catch (error) {
      showToast(storageWriteErrorMessage(error, "The setting could not be saved."), "error");
    }
  };

  function saveReminderOffsets(
    text: string,
    key: "preStartMin" | "midSessionMin",
  ) {
    const parts = text.split(",").map((part) => part.trim()).filter(Boolean);
    const offsets = parts.map(Number);
    if (
      offsets.some((value) => !Number.isInteger(value) || value < 1 || value > 1_440) ||
      offsets.length > 5
    ) {
      showToast("Use up to five whole-minute offsets from 1 to 1440.", "error");
      setPreStartText(state.settings.reminders.preStartMin.join(", "));
      setMidSessionText(state.settings.reminders.midSessionMin.join(", "));
      return;
    }
    const normalized = [...new Set(offsets)].sort((left, right) => right - left);
    void updateSettings(
      (current) => ({
        ...current,
        reminders: { ...current.reminders, [key]: normalized },
      }),
      "Reminder times saved.",
    );
  }

  async function requestNotificationPermission(): Promise<boolean> {
    if (
      typeof chrome === "undefined" ||
      !chrome.permissions?.contains ||
      !chrome.permissions.request
    ) {
      return true;
    }
    try {
      if (await chrome.permissions.contains({ permissions: ["notifications"] })) {
        return true;
      }
      const granted = await chrome.permissions.request({
        permissions: ["notifications"],
      });
      if (!granted) {
        showToast("Enable notifications in your browser settings to use alerts.", "info");
      }
      return granted;
    } catch {
      showToast("Open extension settings to allow notifications.", "info");
      return false;
    }
  }

  return (
    <section className="fg-page" aria-labelledby="settings-title">
      <div className="fg-page__heading">
        <div>
          <h1 id="settings-title">Settings</h1>
          <p className="fg-muted">Adjust how FocusGate works for you.</p>
        </div>
      </div>
      <Tabs
        idPrefix="settings"
        label="Settings sections"
        options={SETTINGS_TABS}
        value={section}
        onChange={setSection}
        compact
      />
      <div
        id={`settings-${section}-panel`}
        role="tabpanel"
        aria-labelledby={`settings-${section}-tab`}
        className="fg-stack"
      >
        {section === "appearance" && (
          <Card title="Appearance">
            <Field id="appearance-theme" label="Theme">
              <select
                id="appearance-theme"
                value={state.settings.theme}
                onChange={(event) => {
                  const theme = event.target.value as Settings["theme"];
                  void updateSettings(
                    (current) => ({ ...current, theme }),
                    "Theme saved.",
                  );
                }}
              >
                <option value="system">Use system setting</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </Field>
            <Field
              id="font-scale"
              label="Text size"
              helper="Adjust text from 90% to 120%."
            >
              <div className="fg-wrap">
                <input
                  id="font-scale"
                  type="range"
                  min={9}
                  max={12}
                  step={1}
                  value={Math.round(state.settings.fontScale * 10)}
                  aria-valuetext={`${Math.round(state.settings.fontScale * 100)}%`}
                  onChange={(event) => {
                    const fontScale = Number(event.target.value) / 10;
                    void updateSettings(
                      (current) => ({ ...current, fontScale }),
                      "Text size saved.",
                    );
                  }}
                />
                <output htmlFor="font-scale">
                  {Math.round(state.settings.fontScale * 100)}%
                </output>
              </div>
            </Field>
          </Card>
        )}

        {section === "security" && (
          <PasswordSettings state={state} />
        )}

        {section === "timer" && (
          <>
            <Card title="Timer">
              <div className="fg-grid-two">
                <Field id="default-duration" label="Default focus duration">
                  <input
                    id="default-duration"
                    type="number"
                    min={1}
                    max={999}
                    value={state.settings.defaultDurationMin}
                    onChange={(event) => {
                      const value = Number(event.target.value);
                      if (!Number.isInteger(value) || value < 1 || value > 999) return;
                      void updateSettings(
                        (current) => ({ ...current, defaultDurationMin: value }),
                        "Default duration saved.",
                      );
                    }}
                  />
                </Field>
                <Field id="daily-goal" label="Daily focus goal">
                  <input
                    id="daily-goal"
                    type="number"
                    min={1}
                    max={1440}
                    value={state.settings.dailyGoalMin}
                    onChange={(event) => {
                      const value = Number(event.target.value);
                      if (!Number.isInteger(value) || value < 1 || value > 1440) return;
                      void updateSettings(
                        (current) => ({ ...current, dailyGoalMin: value }),
                        "Daily goal saved.",
                      );
                    }}
                  />
                </Field>
              </div>
              <Toggle
                label="Use focus and break cycles"
                description="Add scheduled short and long breaks to your sessions."
                checked={state.settings.breaks.enabled}
                onCheckedChange={(enabled) =>
                  void updateSettings(
                    (current) => ({
                      ...current,
                      breaks: { ...current.breaks, enabled },
                    }),
                    "Break setting saved.",
                  )
                }
              />
              {state.settings.breaks.enabled && (
                <>
                <div className="fg-grid-two">
                  <Field id="short-break" label="Short break (minutes)">
                    <input
                      id="short-break"
                      type="number"
                      min={1}
                      max={60}
                      value={state.settings.breaks.shortMin}
                      onChange={(event) => {
                        const shortMin = Number(event.target.value);
                        if (!Number.isInteger(shortMin) || shortMin < 1 || shortMin > 60) return;
                        void updateSettings(
                          (current) => ({
                            ...current,
                            breaks: { ...current.breaks, shortMin },
                          }),
                          "Break duration saved.",
                        );
                      }}
                    />
                  </Field>
                  <Field id="long-break" label="Long break (minutes)">
                    <input
                      id="long-break"
                      type="number"
                      min={1}
                      max={120}
                      value={state.settings.breaks.longMin}
                      onChange={(event) => {
                        const longMin = Number(event.target.value);
                        if (!Number.isInteger(longMin) || longMin < 1 || longMin > 120) return;
                        void updateSettings(
                          (current) => ({
                            ...current,
                            breaks: { ...current.breaks, longMin },
                          }),
                          "Break duration saved.",
                        );
                      }}
                    />
                  </Field>
                </div>
                <Field id="cycles-before-long-break" label="Focus cycles before a long break">
                  <input
                    id="cycles-before-long-break"
                    type="number"
                    min={1}
                    max={20}
                    step={1}
                    value={state.settings.breaks.cyclesBeforeLong}
                    onChange={(event) => {
                      const cyclesBeforeLong = Number(event.target.value);
                      if (
                        !Number.isInteger(cyclesBeforeLong) ||
                        cyclesBeforeLong < 1 ||
                        cyclesBeforeLong > 20
                      ) return;
                      void updateSettings(
                        (current) => ({
                          ...current,
                          breaks: { ...current.breaks, cyclesBeforeLong },
                        }),
                        "Break cycle setting saved.",
                      );
                    }}
                  />
                </Field>
                <Toggle
                  label="Automatically start the next phase"
                  description="Move straight into the next focus or break phase."
                  checked={state.settings.breaks.autoStartNext}
                  onCheckedChange={(autoStartNext) =>
                    void updateSettings(
                      (current) => ({
                        ...current,
                        breaks: { ...current.breaks, autoStartNext },
                      }),
                      "Break setting saved.",
                    )
                  }
                />
                </>
              )}
            </Card>
            <Card title="Scheduled tasks">
              <Toggle
                label="Automatically start scheduled tasks"
                description="Start a focus session when a scheduled task begins."
                checked={state.settings.autoStartTasks}
                onCheckedChange={(autoStartTasks) =>
                  void updateSettings(
                    (current) => ({ ...current, autoStartTasks }),
                    "Task setting saved.",
                  )
                }
              />
            </Card>
          </>
        )}

        {section === "notifications" && (
          <>
            <Card title="Notifications">
              {Object.entries(state.settings.notifications).map(([key, enabled]) => (
                <Toggle
                  key={key}
                  label={notificationLabel(key)}
                  checked={enabled}
                  onCheckedChange={(value) => {
                    void (async () => {
                      if (value && !(await requestNotificationPermission())) return;
                      await updateSettings(
                        (current) => ({
                          ...current,
                          notifications: {
                            ...current.notifications,
                            [key]: value,
                          },
                        }),
                        "Notification setting saved.",
                      );
                    })();
                  }}
                />
              ))}
            </Card>
            <Card title="Task reminder timing">
              <Field
                id="pre-start-offsets"
                label="Before a task starts"
                helper="Minutes before start, separated by commas."
              >
                <input
                  id="pre-start-offsets"
                  value={preStartText}
                  onChange={(event) => setPreStartText(event.target.value)}
                  onBlur={() => saveReminderOffsets(preStartText, "preStartMin")}
                />
              </Field>
              <Toggle
                label="At task start"
                checked={state.settings.reminders.atStart}
                onCheckedChange={(atStart) =>
                  void updateSettings(
                    (current) => ({
                      ...current,
                      reminders: { ...current.reminders, atStart },
                    }),
                    "Reminder setting saved.",
                  )
                }
              />
              <Field
                id="mid-session-offsets"
                label="During a task"
                helper="Minutes after starting; reminders need at least 10 minutes left."
              >
                <input
                  id="mid-session-offsets"
                  value={midSessionText}
                  onChange={(event) => setMidSessionText(event.target.value)}
                  onBlur={() => saveReminderOffsets(midSessionText, "midSessionMin")}
                />
              </Field>
              <Toggle
                label="Almost done"
                checked={state.settings.reminders.almostDone}
                onCheckedChange={(almostDone) =>
                  void updateSettings(
                    (current) => ({
                      ...current,
                      reminders: { ...current.reminders, almostDone },
                    }),
                    "Reminder setting saved.",
                  )
                }
              />
              <Toggle
                label="Task window ends"
                checked={state.settings.reminders.atEnd}
                onCheckedChange={(atEnd) =>
                  void updateSettings(
                    (current) => ({
                      ...current,
                      reminders: { ...current.reminders, atEnd },
                    }),
                    "Reminder setting saved.",
                  )
                }
              />
            </Card>
          </>
        )}

        {section === "block-page" && (
          <Card title="Block page">
            <Field id="block-message" label="Message">
              <textarea
                id="block-message"
                value={state.settings.blockPage.message}
                maxLength={240}
                onChange={(event) => {
                  const message = event.target.value;
                  void updateSettings(
                    (current) => ({
                      ...current,
                      blockPage: { ...current.blockPage, message },
                    }),
                    "Block page message saved.",
                  );
                }}
              />
            </Field>
            <Toggle
              label="Show a focus quote"
              checked={state.settings.blockPage.showQuotes}
              onCheckedChange={(showQuotes) =>
                void updateSettings(
                  (current) => ({
                    ...current,
                    blockPage: { ...current.blockPage, showQuotes },
                  }),
                  "Block page setting saved.",
                )
              }
            />
            <Field id="block-quotes" label="Quotes" helper="One quote per line; the block page rotates one each day.">
              <textarea
                id="block-quotes"
                value={quotesText}
                maxLength={4_000}
                onChange={(event) => setQuotesText(event.target.value)}
                onBlur={() => {
                  const quotes = quotesText
                    .split("\n")
                    .map((quote) => quote.trim())
                    .filter(Boolean)
                    .slice(0, 20);
                  void updateSettings(
                    (current) => ({
                      ...current,
                      blockPage: { ...current.blockPage, quotes },
                    }),
                    "Block-page quotes saved.",
                  );
                }}
              />
            </Field>
            <Toggle
              label="Play a short sound on the block page"
              checked={state.settings.blockPage.sound}
              onCheckedChange={(sound) =>
                void updateSettings(
                  (current) => ({
                    ...current,
                    blockPage: { ...current.blockPage, sound },
                  }),
                  "Block-page setting saved.",
                )
              }
            />
          </Card>
        )}

        {section === "content" && (
          <Card
            title="Content filters"
            description="Choose which feed sections FocusGate hides on supported sites."
          >
            {CONTENT_FILTER_OPTIONS.map(({ id, label }) => {
              const enabled = state.settings.contentFilters[id] === true;
              return (
              <Toggle
                key={id}
                label={label}
                description={enabled && lockReason ? lockReason : undefined}
                checked={enabled}
                disabled={enabled && Boolean(lockReason)}
                onCheckedChange={(value) =>
                  void updateSettings(
                    (current) => ({
                      ...current,
                      contentFilters: {
                        ...current.contentFilters,
                        [id]: value,
                      },
                    }),
                    "Content filter setting saved.",
                  )
                }
              />
              );
            })}
            <p className="fg-muted">
              These filters apply only to sites that FocusGate supports.
            </p>
          </Card>
        )}

        {section === "protection" && (
          <Card title="Protection status">
            <div className="fg-row">
              <span>Incognito access</span>
              <strong className={permissionClass(protection.incognito)}>
                {permissionLabel(protection.incognito)}
              </strong>
            </div>
            {protection.incognito === "review" && (
              <p className="fg-field__error">
                Incognito access is off. Enable it from your browser’s extension settings.
              </p>
            )}
            <div className="fg-row">
              <span>Site access</span>
              <strong className={permissionClass(protection.siteAccess)}>
                {permissionLabel(protection.siteAccess)}
              </strong>
            </div>
            {protection.siteAccess === "review" && (
              <p className="fg-field__error">
                FocusGate needs access to sites to enforce your rules. Use the
                browser settings link below to review site access.
              </p>
            )}
            <div className="fg-row">
              <span>Notifications</span>
              <strong className={permissionClass(protection.notifications)}>
                {permissionLabel(protection.notifications)}
              </strong>
            </div>
            {protection.notifications === "review" && (
              <p className="fg-field__error">
                Browser notification permission is off. FocusGate won't show alerts
                until it is enabled.
              </p>
            )}
            <div className="fg-row">
              <span>Last background heartbeat</span>
              <span>
                {ageLabel(state.health.lastHeartbeatAt, Date.now())}
                {state.health.lastHeartbeatAt > 0 && (
                  <> · {localDateTime(state.health.lastHeartbeatAt)}</>
                )}
              </span>
            </div>
            <div className="fg-row">
              <span>Last rule update</span>
              <span>{localDateTime(state.health.lastReconcileAt)}</span>
            </div>
            <div className="fg-row">
              <span>Blocking rules</span>
              <span>{state.health.ruleCount}</span>
            </div>
            <div className="fg-row">
              <span>Protection gaps · last 7 days</span>
              <span>
                {protectionGaps.count === 0
                  ? "None recorded"
                  : `${protectionGaps.count} · ${gapDurationLabel(protectionGaps.durationMs)}`}
              </span>
            </div>
            {state.health.lastError ? (
              <p className="fg-field__error">{state.health.lastError}</p>
            ) : (
              <p className="fg-muted">
                No recent background error is recorded.
              </p>
            )}
            <div className="fg-wrap">
              <Button
                variant="secondary"
                disabled={checkingProtection}
                onClick={() => void refreshProtection()}
              >
                {checkingProtection ? "Checking…" : "Check again"}
              </Button>
              {protection.siteAccess === "review" &&
                canRequestHostAccess(browserApi) && (
                  <Button
                    variant="secondary"
                    onClick={() => void requestSiteAccess()}
                  >
                    Grant site access
                  </Button>
                )}
              {browserSettingsUrl && (
                <a href={browserSettingsUrl} target="_blank" rel="noreferrer">
                  Open extension settings
                </a>
              )}
            </div>
            {!browserSettingsUrl && (
              <p className="fg-muted">
                Browser settings could not be opened from this browser.
              </p>
            )}
            <p className="fg-muted">
              Blocking works only while FocusGate is enabled in this browser
              profile. The browser controls incognito access, site permissions,
              and notifications. Clearing extension storage or disabling the
              extension can remove protection.
            </p>
          </Card>
        )}

        {section === "data" && (
          <Card title="Your data">
            <p className="fg-muted">
              FocusGate stores your focus settings and activity in this browser.
              Use the dashboard Backup page to export, import, or reset your data.
            </p>
            <dl className="fg-stat-list">
              <div><dt>Tasks</dt><dd>{state.tasks.length}</dd></div>
              <div><dt>Rules</dt><dd>{state.blockedSites.length + state.alwaysBlockedSites.length}</dd></div>
              <div><dt>Recorded sessions</dt><dd>{state.sessionHistory.length}</dd></div>
            </dl>
          </Card>
        )}

        {section === "about" && (
          <Card title="About FocusGate">
            <p>
              FocusGate helps you plan focus sessions and manage the pages that
              distract you.
            </p>
            <p className="fg-muted">
              Blocking behavior depends on your browser permissions and the rules
              you configure.
            </p>
            <div className="fg-wrap">
              <a href="https://focusflowpc.pages.dev" target="_blank" rel="noreferrer">
                FocusGate PC
              </a>
              <a href="https://focusflowapp.pages.dev" target="_blank" rel="noreferrer">
                FocusGate App
              </a>
            </div>
          </Card>
        )}
      </div>
    </section>
  );
}

function notificationLabel(key: string): string {
  const labels: Record<string, string> = {
    sessionEnd: "Session ends",
    breakEnd: "Break ends",
    taskReminders: "Task reminders",
    weeklyReport: "Weekly report",
    achievements: "Achievements",
  };
  return labels[key] ?? labelFromKey(key);
}

function labelFromKey(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (first) => first.toUpperCase());
}
