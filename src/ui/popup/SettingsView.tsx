import { useState } from "react";
import type { AppState, Settings } from "../../shared/types.ts";
import { Button, Card, Field, Toggle } from "../components/primitives.tsx";
import { Tabs } from "../components/Tabs.tsx";
import { useToast } from "../components/feedback.tsx";
import { uiStorageStore } from "../hooks/storageStore.ts";

type SettingsSection =
  | "security"
  | "timer"
  | "notifications"
  | "block-page"
  | "content"
  | "protection"
  | "data"
  | "about";

const SETTINGS_TABS = [
  { value: "security", label: "Security" },
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

export function SettingsView({ state }: { state: AppState }) {
  const [section, setSection] = useState<SettingsSection>("security");
  const showToast = useToast();
  const updateSettings = async (
    updater: (current: Settings) => Settings,
    successMessage: string,
  ) => {
    try {
      await uiStorageStore.set("settings", updater);
      showToast(successMessage, "success");
    } catch {
      showToast("The setting could not be saved.", "error");
    }
  };

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
        {section === "security" && (
          <Card title="Password">
            <p className="fg-muted">
              A password can confirm ending a Strict session early. It does not
              prevent this extension from being disabled or removed.
            </p>
            <Button
              variant="secondary"
              disabled
              aria-describedby="password-controls-help"
              title="Password controls are not ready yet."
            >
              Change password
            </Button>
            <p className="fg-muted" id="password-controls-help">
              Password controls are not available yet.
            </p>
            <p className="fg-muted">
              {state.password
                ? "A password is set. Changing or removing it is not available yet."
                : "No password is set."}
            </p>
          </Card>
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
              )}
            </Card>
            <Card title="Appearance">
              <Field id="theme-setting" label="Theme">
                <select
                  id="theme-setting"
                  value={state.settings.theme}
                  onChange={(event) =>
                    void updateSettings(
                      (current) => ({
                        ...current,
                        theme: event.target.value as Settings["theme"],
                      }),
                      "Theme saved.",
                    )
                  }
                >
                  <option value="system">Use system setting</option>
                  <option value="dark">Dark</option>
                  <option value="light">Light</option>
                </select>
              </Field>
            </Card>
          </>
        )}

        {section === "notifications" && (
          <Card title="Notifications">
            {Object.entries(state.settings.notifications).map(([key, enabled]) => (
              <Toggle
                key={key}
                label={notificationLabel(key)}
                checked={enabled}
                onCheckedChange={(value) =>
                  void updateSettings(
                    (current) => ({
                      ...current,
                      notifications: {
                        ...current.notifications,
                        [key]: value,
                      },
                    }),
                    "Notification setting saved.",
                  )
                }
              />
            ))}
          </Card>
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
            <Toggle
              label="Play a sound"
              description="Sound playback is not available in the staged block page."
              checked={state.settings.blockPage.sound}
              disabled
            />
          </Card>
        )}

        {section === "content" && (
          <Card
            title="Content filters"
            description="Choose which feed sections FocusGate hides on supported sites."
          >
            {Object.entries(state.settings.contentFilters).map(([key, enabled]) => (
              <Toggle
                key={key}
                label={labelFromKey(key)}
                checked={enabled}
                onCheckedChange={(value) =>
                  void updateSettings(
                    (current) => ({
                      ...current,
                      contentFilters: {
                        ...current.contentFilters,
                        [key]: value,
                      },
                    }),
                    "Content filter setting saved.",
                  )
                }
              />
            ))}
            <p className="fg-muted">
              These filters apply only to sites that FocusGate supports.
            </p>
          </Card>
        )}

        {section === "protection" && (
          <Card title="Protection status">
            <div className="fg-row">
              <span>Background check</span>
              <span>{localDateTime(state.health.lastHeartbeatAt)}</span>
            </div>
            <div className="fg-row">
              <span>Last rule update</span>
              <span>{localDateTime(state.health.lastReconcileAt)}</span>
            </div>
            <div className="fg-row">
              <span>Blocking rules</span>
              <span>{state.health.ruleCount}</span>
            </div>
            {state.health.lastError ? (
              <p className="fg-field__error">{state.health.lastError}</p>
            ) : (
              <p className="fg-muted">
                No recent background error is recorded.
              </p>
            )}
            <p className="fg-muted">
              Incognito and site permissions are checked separately by your browser.
            </p>
          </Card>
        )}

        {section === "data" && (
          <Card title="Your data">
            <p className="fg-muted">
              FocusGate stores your focus settings and activity in this browser.
              Backup and restore controls are part of the security and data work.
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
