import { useEffect, useState } from "react";
import { BUILT_IN_PRESETS, getPresetDomains } from "../../shared/presets.ts";
import { normalizeDomain } from "../../shared/domains.ts";
import {
  checkProtection as checkBrowserProtection,
  getBrowserProtectionApi,
} from "../lib/protectionStatus.ts";
import { Button, Card, Chip, Field, ListRow } from "../components/primitives.tsx";
import { StorageGate } from "../components/StorageGate.tsx";
import { APP_STATE_KEYS } from "../hooks/storageStore.ts";
import { uiStorageStore } from "../hooks/storageStore.ts";
import { useAppState } from "../hooks/useStorage.ts";
import { ThemeRoot } from "../theme.tsx";
import { sendPasswordMessage } from "../lib/passwordActions.ts";

type Goal = "social" | "gaming" | "web" | "deep";
type PermissionState = "checking" | "available" | "review" | "unavailable";
type ProtectionCheck = {
  incognito: PermissionState;
  siteAccess: PermissionState;
  notifications: PermissionState;
};

const GOAL_PRESETS: Record<Goal, string[]> = {
  social: ["social", "messaging"],
  gaming: ["gaming", "video"],
  web: ["news", "video"],
  deep: ["deep-focus"],
};

const GOALS: { id: Goal; title: string; copy: string; dailyGoalMin: number }[] = [
  {
    id: "social",
    title: "Spend less time on social apps",
    copy: "Choose social and messaging sites to block during focus.",
    dailyGoalMin: 60,
  },
  {
    id: "gaming",
    title: "Stay focused on work or study",
    copy: "Choose gaming and video sites as a starting point.",
    dailyGoalMin: 120,
  },
  {
    id: "web",
    title: "Reduce browsing distractions",
    copy: "Start with news and video sites.",
    dailyGoalMin: 120,
  },
  {
    id: "deep",
    title: "Set up a deep-focus block list",
    copy: "Review the full built-in list before adding it.",
    dailyGoalMin: 180,
  },
];

const EMPTY_PROTECTION: ProtectionCheck = {
  incognito: "checking",
  siteAccess: "checking",
  notifications: "checking",
};

function permissionLabel(value: PermissionState): string {
  if (value === "available") return "Available";
  if (value === "review") return "Needs review";
  if (value === "unavailable") return "Check unavailable";
  return "Checking";
}

function permissionChip(value: PermissionState) {
  if (value === "available") return <Chip tone="live">Available</Chip>;
  if (value === "review") return <Chip tone="lock">Needs review</Chip>;
  if (value === "unavailable") return <Chip tone="neutral">Check unavailable</Chip>;
  return <Chip tone="neutral">Checking</Chip>;
}

async function checkProtection(): Promise<ProtectionCheck> {
  return checkBrowserProtection(getBrowserProtectionApi());
}

export function OnboardingPage() {
  return (
    <StorageGate keys={APP_STATE_KEYS}>
      <ThemeRoot>
        <OnboardingFlow />
      </ThemeRoot>
    </StorageGate>
  );
}

function OnboardingFlow() {
  const state = useAppState();
  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState<Goal>("social");
  const [dailyGoalMin, setDailyGoalMin] = useState(60);
  const [selectedPresets, setSelectedPresets] = useState<string[]>(
    GOAL_PRESETS.social,
  );
  const [customDomains, setCustomDomains] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [protection, setProtection] = useState(EMPTY_PROTECTION);
  const [protectionMessage, setProtectionMessage] = useState("");
  const [checkingProtection, setCheckingProtection] = useState(false);

  useEffect(() => {
    let active = true;
    void checkProtection()
      .then((result) => {
        if (active) setProtection(result);
      })
      .catch(() => {
        if (active) {
          setProtection({
            incognito: "review",
            siteAccess: "review",
            notifications: "review",
          });
        }
      });
    return () => {
      active = false;
    };
  }, []);

  function chooseGoal(nextGoal: Goal) {
    setGoal(nextGoal);
    setSelectedPresets(GOAL_PRESETS[nextGoal]);
    setDailyGoalMin(
      GOALS.find((item) => item.id === nextGoal)?.dailyGoalMin ?? 120,
    );
    setError("");
  }

  function parseCustomDomains(): { valid: string[]; invalid: string[] } {
    const entries = customDomains
      .split(/[,\n]/)
      .map((entry) => entry.trim())
      .filter(Boolean);
    const valid: string[] = [];
    const invalid: string[] = [];
    for (const entry of entries) {
      const domain = normalizeDomain(entry);
      if (domain) valid.push(domain);
      else invalid.push(entry);
    }
    return { valid: [...new Set(valid)], invalid };
  }

  function togglePreset(id: string) {
    setSelectedPresets((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  }

  async function saveSetup() {
    setError("");
    const custom = parseCustomDomains();
    if (custom.invalid.length > 0) {
      setError(`Check these entries: ${custom.invalid.join(", ")}`);
      setStep(1);
      return;
    }
    if (state.password && (password || passwordConfirm)) {
      setError("A password is already set. Password changes are managed in Settings.");
      setStep(2);
      return;
    }
    if (password || passwordConfirm) {
      if (password.length < 8 || password.length > 64) {
        setError("Use 8 to 64 characters, or leave both password fields empty.");
        setStep(2);
        return;
      }
      if (password !== passwordConfirm) {
        setError("The passwords do not match.");
        setStep(2);
        return;
      }
    }

    setSaving(true);
    try {
      const selectedDomains = [
        ...new Set([...getPresetDomains(selectedPresets), ...custom.valid]),
      ];
      await uiStorageStore.set("blockedSites", (latest) => [
        ...new Set([...latest, ...selectedDomains]),
      ]);
      await uiStorageStore.set("settings", (latest) => ({
        ...latest,
        dailyGoalMin,
      }));
      if (password) {
        const result = await sendPasswordMessage({
          type: "password/set",
          newPassword: password,
        });
        if (!result.ok) {
          throw new Error(result.message || "The password could not be saved.");
        }
      }
      setStep(4);
    } catch {
      setError("FocusGate could not save setup. Your selected sites can be saved again by retrying.");
    } finally {
      setSaving(false);
    }
  }

  async function openFocusGate() {
    const fallback =
      "Setup is saved. Open FocusGate from your browser toolbar to continue.";
    if (typeof chrome === "undefined" || !chrome.runtime?.id) {
      setProtectionMessage(fallback);
      return;
    }
    try {
      const sidePanel = (
        chrome as unknown as {
          sidePanel?: {
            open(options: { windowId?: number; tabId?: number }): Promise<void>;
          };
        }
      ).sidePanel;
      if (sidePanel?.open) {
        const win = await chrome.windows.getCurrent();
        await sidePanel.open({ windowId: win.id });
      } else {
        setProtectionMessage(fallback);
        return;
      }
      const tab = await chrome.tabs.getCurrent();
      if (tab?.id !== undefined) await chrome.tabs.remove(tab.id);
    } catch {
      setProtectionMessage(fallback);
    }
  }

  async function refreshProtection() {
    setCheckingProtection(true);
    try {
      setProtection(await checkProtection());
    } catch {
      setProtection({
        incognito: "review",
        siteAccess: "review",
        notifications: "review",
      });
    } finally {
      setCheckingProtection(false);
    }
  }

  function continueFromPassword() {
    setError("");
    if (password || passwordConfirm) {
      if (password.length < 8 || password.length > 64) {
        setError("Use 8 to 64 characters, or leave both password fields empty.");
        return;
      }
      if (password !== passwordConfirm) {
        setError("The passwords do not match.");
        return;
      }
    }
    setStep(3);
  }

  const selectedCount = new Set([
    ...getPresetDomains(selectedPresets),
    ...parseCustomDomains().valid,
  ]).size;

  return (
    <main className="fg-full-page">
      <div className="fg-full-page__inner">
        <header className="fg-onboard-head">
          <img src="/icon.png" alt="" width="36" height="36" />
          <span>FocusGate setup</span>
        </header>
        {step < 4 && (
          <div className="fg-dots" aria-live="polite" aria-label={`Step ${step + 1} of 4`}>
            {[0, 1, 2, 3].map((dot) => (
              <span
                key={dot}
                className={`fg-dot${dot === step ? " fg-dot--active" : ""}`}
              />
            ))}
          </div>
        )}

        {step === 0 && (
          <section className="fg-stack" aria-labelledby="onboarding-welcome">
            <h1 id="onboarding-welcome">Make room for focused time</h1>
            <p className="fg-muted">
              Choose a starting goal. You can review every site before it is added.
            </p>
            <div role="group" aria-label="Focus goal">
              {GOALS.map((item) => (
                <button
                  key={item.id}
                  className="fg-row fg-row--select"
                  type="button"
                  aria-pressed={goal === item.id}
                  onClick={() => chooseGoal(item.id)}
                >
                  <div className="fg-row__copy">
                    <span className="fg-row__title">{item.title}</span>
                    <span className="fg-row__sub">{item.copy}</span>
                  </div>
                </button>
              ))}
            </div>
            <Field id="onboarding-goal" label="Daily focus goal">
              <select
                id="onboarding-goal"
                value={dailyGoalMin}
                onChange={(event) => setDailyGoalMin(Number(event.target.value))}
              >
                <option value={60}>1 hour</option>
                <option value={120}>2 hours</option>
                <option value={180}>3 hours</option>
                <option value={240}>4 hours</option>
              </select>
            </Field>
            <div className="fg-onboard-actions">
              <Button wide onClick={() => setStep(1)}>Continue</Button>
            </div>
          </section>
        )}

        {step === 1 && (
          <section className="fg-stack" aria-labelledby="onboarding-sites">
            <h1 id="onboarding-sites">Choose sites to block</h1>
            <p className="fg-muted">
              Review the presets, then add the selected sites to your Focus list.
              Nothing is added until you save setup.
            </p>
            <div>
              {BUILT_IN_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  className="fg-row fg-row--select"
                  type="button"
                  aria-pressed={selectedPresets.includes(preset.id)}
                  onClick={() => togglePreset(preset.id)}
                >
                  <div className="fg-row__swatch" aria-hidden="true">
                    {preset.emoji}
                  </div>
                  <div className="fg-row__copy">
                    <span className="fg-row__title">{preset.name}</span>
                    <span className="fg-row__sub">
                      {preset.domains.length} sites · {preset.domains.slice(0, 3).join(", ")}
                    </span>
                  </div>
                </button>
              ))}
            </div>
            <Field
              id="onboarding-custom-sites"
              label="Add your own sites"
              helper="Separate domains or URLs with commas or new lines."
              error={step === 1 ? error : undefined}
            >
              <textarea
                id="onboarding-custom-sites"
                value={customDomains}
                placeholder={"example.com, https://news.example.org"}
                onChange={(event) => setCustomDomains(event.target.value)}
              />
            </Field>
            <p className="fg-muted" role="status">
              {selectedCount} sites selected
            </p>
            <div className="fg-onboard-actions">
              <Button variant="secondary" onClick={() => setStep(0)}>Back</Button>
              <Button
                onClick={() => {
                  const custom = parseCustomDomains();
                  if (custom.invalid.length) {
                    setError(`Check these entries: ${custom.invalid.join(", ")}`);
                    return;
                  }
                  setError("");
                  setStep(2);
                }}
              >
                Continue
              </Button>
            </div>
          </section>
        )}

        {step === 2 && (
          <section className="fg-stack" aria-labelledby="onboarding-password">
            <h1 id="onboarding-password">Password protection is optional</h1>
            <p className="fg-muted">
              A password adds friction when ending a Strict session early. It does
              not stop you from disabling or removing the extension.
            </p>
            {state.password ? (
              <Card title="Password already set">
                <p className="fg-muted">
                  Your current password will stay in place. You can continue setup.
                </p>
              </Card>
            ) : (
              <>
                <Field
                  id="onboarding-password-value"
                  label="Password"
                  helper="Use 8 to 64 characters, or leave both fields empty to skip."
                  error={step === 2 ? error : undefined}
                >
                  <input
                    id="onboarding-password-value"
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                </Field>
                <Field id="onboarding-password-confirm" label="Confirm password">
                  <input
                    id="onboarding-password-confirm"
                    type="password"
                    autoComplete="new-password"
                    value={passwordConfirm}
                    onChange={(event) => setPasswordConfirm(event.target.value)}
                  />
                </Field>
              </>
            )}
            <div className="fg-onboard-actions">
              <Button variant="secondary" onClick={() => setStep(1)}>Back</Button>
              <Button onClick={continueFromPassword}>Continue</Button>
            </div>
          </section>
        )}

        {step === 3 && (
          <section className="fg-stack" aria-labelledby="onboarding-protection">
            <h1 id="onboarding-protection">Check browser access</h1>
            <p className="fg-muted">
              These permissions affect where FocusGate can work. Your browser
              controls incognito access and site permissions.
            </p>
            <ListRow
              title="Incognito access"
              sub="Work inside private windows."
              status={permissionChip(protection.incognito)}
            />
            <ListRow
              title="Website access"
              sub="Block and allow sites in normal windows."
              status={permissionChip(protection.siteAccess)}
            />
            <ListRow
              title="Notifications"
              sub="Session end and break reminders."
              status={permissionChip(protection.notifications)}
            />
            {protection.siteAccess === "review" && (
              <p className="fg-muted">
                Review FocusGate’s site access in your browser’s extension settings.
              </p>
            )}
            {protection.incognito === "review" && (
              <p className="fg-muted">
                To use FocusGate in a private window, enable its incognito access in
                your browser’s extension settings.
              </p>
            )}
            <div>
              <Button
                variant="quiet"
                onClick={() => void refreshProtection()}
                disabled={checkingProtection}
                title={checkingProtection ? "Checking browser permissions." : undefined}
              >
                {checkingProtection ? "Checking…" : "Check again"}
              </Button>
            </div>
            {error && <p className="fg-field__error" role="alert">{error}</p>}
            <div className="fg-onboard-actions">
              <Button variant="secondary" onClick={() => setStep(2)}>Back</Button>
              <Button onClick={() => void saveSetup()} disabled={saving}>
                {saving ? "Saving…" : "Save setup"}
              </Button>
            </div>
          </section>
        )}

        {step === 4 && (
          <section className="fg-stack" aria-labelledby="onboarding-done">
            <h1 id="onboarding-done">Your setup is saved</h1>
            <p className="fg-muted">
              {selectedCount} sites were added to your Focus list. Your daily goal
              is {dailyGoalMin} minutes.
            </p>
            <Card title="What happens next">
              <p className="fg-muted">
                Open the FocusGate side panel to start a focus session. Blocking
                depends on your configured rules and browser permissions.
              </p>
            </Card>
            <div className="fg-onboard-actions">
              <Button wide onClick={() => void openFocusGate()}>
                Open FocusGate in the side panel
              </Button>
            </div>
            {protectionMessage && (
              <p className="fg-muted" role="status">{protectionMessage}</p>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
