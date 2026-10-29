import { useEffect, useState } from "react";
import {
  BarChart3,
  LayoutDashboard,
  ListTodo,
  Settings2,
  Shield,
  Timer,
} from "lucide-react";
import { explainBlock } from "../../shared/plan.ts";
import { quickBlockTarget } from "../../shared/quickBlock.ts";
import type { AppState } from "../../shared/types.ts";
import { StorageGate } from "../components/StorageGate.tsx";
import { Tabs } from "../components/Tabs.tsx";
import { GuardPromptHost } from "../components/GuardPromptHost.tsx";
import type { TabOption } from "../components/Tabs.tsx";
import { ToastProvider } from "../components/feedback.tsx";
import { useToast } from "../components/feedback.tsx";
import { Button } from "../components/primitives.tsx";
import { APP_STATE_KEYS } from "../hooks/storageStore.ts";
import { uiStorageStore } from "../hooks/storageStore.ts";
import { useAppState } from "../hooks/useStorage.ts";
import { activeScheduleAt } from "../lib/scheduleStatus.ts";
import { ThemeRoot } from "../theme.tsx";
import { FocusView } from "./FocusView.tsx";
import { RulesView } from "./RulesView.tsx";
import { SettingsView } from "./SettingsView.tsx";
import { StatsView } from "./StatsView.tsx";
import { TasksView } from "./TasksView.tsx";

type PopupTab = "focus" | "tasks" | "rules" | "stats" | "settings";

const POPUP_TABS: readonly TabOption<PopupTab>[] = [
  { value: "focus", label: "Focus", icon: <Timer aria-hidden="true" /> },
  { value: "tasks", label: "Tasks", icon: <ListTodo aria-hidden="true" /> },
  { value: "rules", label: "Rules", icon: <Shield aria-hidden="true" /> },
  { value: "stats", label: "Stats", icon: <BarChart3 aria-hidden="true" /> },
  { value: "settings", label: "Settings", icon: <Settings2 aria-hidden="true" /> },
];

export function PopupPage() {
  return (
    <StorageGate keys={APP_STATE_KEYS}>
      <ToastProvider>
        <ThemeRoot>
          <GuardPromptHost />
          <PopupShell />
        </ThemeRoot>
      </ToastProvider>
    </StorageGate>
  );
}

function PopupShell() {
  const [tab, setTab] = useState<PopupTab>("focus");
  const [activeTab, setActiveTab] = useState<{ id: number; url?: string } | null>(null);
  const state = useAppState();
  const showToast = useToast();
  const locked =
    state.session.status !== "idle" && state.session.lockLevel !== "none";
  const status = <StatusChip state={state} />;
  const quickTarget = quickBlockTarget(activeTab?.url);
  const quickBlockDisabledReason =
    activeTab === null
      ? "The active browser tab is unavailable."
      : quickTarget
        ? ""
        : "Quick block is available only on HTTP and HTTPS pages.";

  useEffect(() => {
    if (typeof chrome === "undefined" || !chrome.tabs?.query) return;
    void chrome.tabs
      .query({ active: true, currentWindow: true })
      .then(([current]) => {
        if (current?.id !== undefined) {
          setActiveTab({ id: current.id, url: current.url });
        }
      })
      .catch(() => setActiveTab(null));
  }, []);

  async function quickBlockCurrentTab() {
    if (!quickTarget || activeTab?.id === undefined) return;
    const key =
      state.quickBlockMode === "always" ? "alwaysBlockedSites" : "blockedSites";
    try {
      const saved = await uiStorageStore.set(key, (latest) => [
        ...new Set([...latest, ...quickTarget.domains]),
      ]);
      const nextState = {
        ...state,
        [key]: saved,
      };
      const reason = explainBlock(quickTarget.url, nextState, Date.now());
      if (reason && typeof chrome !== "undefined" && chrome.runtime?.getURL) {
        const blockedUrl = chrome.runtime.getURL(
          `blocked.html#${encodeURIComponent(quickTarget.url)}`,
        );
        await chrome.tabs.update(activeTab.id, { url: blockedUrl });
      }
      const aliases = quickTarget.domains.filter(
        (domain) => domain !== quickTarget.domain,
      );
      const aliasCopy = aliases.length ? ` (and ${aliases.join(", ")})` : "";
      showToast(
        `Added ${quickTarget.domain}${aliasCopy} to ${
          state.quickBlockMode === "always" ? "Always" : "Focus"
        }.`,
        "success",
      );
    } catch {
      showToast("FocusGate could not add this site. Try again.", "error");
    }
  }

  function setQuickBlockMode(value: "focus" | "always") {
    void uiStorageStore
      .set("quickBlockMode", value)
      .catch(() => showToast("The quick-block destination could not be saved.", "error"));
  }

  return (
    <div className="fg-popup">
      <header className="fg-popup__header">
        <div className="fg-brand">
          <img src="/icon.png" alt="" />
          <span>FocusGate</span>
        </div>
        <div className="fg-header-status">
          {state.health.lastError && (
            <span
              className="fg-protection-dot"
              role="img"
              aria-label="Protection needs attention"
              title="Protection needs attention"
            />
          )}
          {status}
          <select
            className="fg-quick-block-mode"
            aria-label="Quick block destination"
            value={state.quickBlockMode}
            onChange={(event) =>
              setQuickBlockMode(event.target.value as "focus" | "always")
            }
          >
            <option value="focus">Focus</option>
            <option value="always">Always</option>
          </select>
          <Button
            className="fg-quick-block"
            variant="secondary"
            disabled={!quickTarget}
            aria-label="Block this site"
            aria-describedby={
              quickBlockDisabledReason ? "quick-block-disabled-reason" : undefined
            }
            title={
              quickBlockDisabledReason || "Block this site"
            }
            onClick={() => void quickBlockCurrentTab()}
          >
            Block
          </Button>
          {quickBlockDisabledReason && (
            <span id="quick-block-disabled-reason" className="fg-visually-hidden">
              {quickBlockDisabledReason}
            </span>
          )}
          {!locked && (
            <a
              className="fg-dashboard-link"
              href="./dashboard.html"
              target="_blank"
              rel="noreferrer"
              aria-label="Open the full FocusGate dashboard in a new tab"
              title="Open full dashboard"
            >
              <LayoutDashboard aria-hidden="true" />
            </a>
          )}
        </div>
      </header>
      <main
        className="fg-popup__main"
        id={`popup-${tab}-panel`}
        role="tabpanel"
        aria-labelledby={`popup-${tab}-tab`}
        tabIndex={0}
      >
        <PopupScreen
          tab={tab}
          state={state}
          onOpenRules={() => setTab("rules")}
          onOpenTasks={() => setTab("tasks")}
        />
      </main>
      {!locked && (
        <Tabs
          idPrefix="popup"
          label="Main sections"
          options={POPUP_TABS}
          value={tab}
          onChange={setTab}
          compact
          className="fg-tabs--nav"
        />
      )}
    </div>
  );
}

function PopupScreen({
  tab,
  state,
  onOpenRules,
  onOpenTasks,
}: {
  tab: PopupTab;
  state: AppState;
  onOpenRules: () => void;
  onOpenTasks: () => void;
}) {
  if (tab === "tasks") return <TasksView state={state} />;
  if (tab === "rules") return <RulesView state={state} />;
  if (tab === "stats") return <StatsView state={state} />;
  if (tab === "settings") return <SettingsView state={state} />;
  return (
    <FocusView
      state={state}
      onOpenRules={onOpenRules}
      onOpenTasks={onOpenTasks}
    />
  );
}

function StatusChip({ state }: { state: AppState }) {
  const [now, setNow] = useState(() => Date.now());
  const activeSchedule = activeScheduleAt(state.schedules, now);
  // Only this small header chip and the ring timer update once per second.
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  let label = "Idle";
  let active = false;
  let until = 0;
  if (state.session.status === "work") {
    label = "Focus";
    active = true;
    until = state.session.phaseEndsAt;
  } else if (
    state.session.status === "shortBreak" ||
    state.session.status === "longBreak"
  ) {
    label = "Break";
    active = true;
    until = state.session.phaseEndsAt;
  } else if (state.standalone.active && state.standalone.until > now) {
    label = "Block now";
    active = true;
    until = state.standalone.until;
  } else if (activeSchedule) {
    label = "Schedule";
    active = true;
  }

  const remaining = Math.max(0, Math.ceil((until - now) / 1_000));
  const time = `${String(Math.floor(remaining / 60)).padStart(2, "0")}:${String(
    remaining % 60,
  ).padStart(2, "0")}`;
  return (
    <span
      className={`fg-status ${active ? "is-active" : ""}`}
      title={activeSchedule ? `Scheduled block: ${activeSchedule.name}` : undefined}
    >
      {label}
      {active && until > now && ` ${time}`}
    </span>
  );
}
