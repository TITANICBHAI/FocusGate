import { useEffect, useState } from "react";
import {
  BarChart3,
  LayoutDashboard,
  ListTodo,
  Settings2,
  Shield,
  Timer,
} from "lucide-react";
import type { AppState } from "../../shared/types.ts";
import { StorageGate } from "../components/StorageGate.tsx";
import { Tabs } from "../components/Tabs.tsx";
import type { TabOption } from "../components/Tabs.tsx";
import { ToastProvider } from "../components/feedback.tsx";
import { APP_STATE_KEYS } from "../hooks/storageStore.ts";
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
          <PopupShell />
        </ThemeRoot>
      </ToastProvider>
    </StorageGate>
  );
}

function PopupShell() {
  const [tab, setTab] = useState<PopupTab>("focus");
  const state = useAppState();
  const locked =
    state.session.status !== "idle" && state.session.lockLevel !== "none";
  const status = <StatusChip state={state} />;

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
        <PopupScreen tab={tab} state={state} />
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
}: {
  tab: PopupTab;
  state: AppState;
}) {
  if (tab === "tasks") return <TasksView state={state} />;
  if (tab === "rules") return <RulesView state={state} />;
  if (tab === "stats") return <StatsView state={state} />;
  if (tab === "settings") return <SettingsView state={state} />;
  return <FocusView state={state} />;
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
