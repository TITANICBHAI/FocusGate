import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Shield, Timer, User } from "lucide-react";
import type { AppState } from "../../shared/types.ts";
import { APP_STATE_KEYS } from "../hooks/storageStore.ts";
import { useAppState } from "../hooks/useStorage.ts";
import { StorageGate } from "../components/StorageGate.tsx";
import { GuardPromptHost } from "../components/GuardPromptHost.tsx";
import { ToastProvider } from "../components/feedback.tsx";
import { AppHeader, Card } from "../components/primitives.tsx";
import { ThemeRoot } from "../theme.tsx";

type PanelTab = "focus" | "rules" | "you";

const TABS: ReadonlyArray<{
  value: PanelTab;
  label: string;
  icon: ReactNode;
}> = [
  { value: "focus", label: "Focus", icon: <Timer aria-hidden="true" /> },
  { value: "rules", label: "Rules", icon: <Shield aria-hidden="true" /> },
  { value: "you", label: "You", icon: <User aria-hidden="true" /> },
];

function statusFromState(state: AppState): "idle" | "focus" | "break" | "block" {
  if (state.session.status === "work") return "focus";
  if (state.session.status === "shortBreak" || state.session.status === "longBreak") {
    return "break";
  }
  const now = Date.now();
  if (
    state.standalone.active &&
    state.standalone.startsAt <= now &&
    now < state.standalone.until
  ) {
    return "block";
  }
  return "idle";
}

function PanelPage() {
  return (
    <StorageGate keys={APP_STATE_KEYS}>
      <ToastProvider>
        <ThemeRoot>
          <GuardPromptHost />
          <PanelShell />
        </ThemeRoot>
      </ToastProvider>
    </StorageGate>
  );
}

function PanelShell() {
  const state = useAppState();
  const [tab, setTab] = useState<PanelTab>("focus");

  // The panel marks itself so the toast host clears the tab bar.
  useEffect(() => {
    document.documentElement.classList.add("fg-in-panel");
    return () => document.documentElement.classList.remove("fg-in-panel");
  }, []);

  function openSettings(): void {
    if (typeof chrome !== "undefined" && chrome.tabs?.create) {
      chrome.tabs.create({
        url: chrome.runtime.getURL("dashboard.html#settings"),
      });
    }
  }

  return (
    <div className="fg-panel">
      <AppHeader status={statusFromState(state)} onOpenSettings={openSettings} />
      <main
        className="fg-panel__main"
        id={`panel-${tab}-panel`}
        role="tabpanel"
        aria-labelledby={`panel-${tab}-tab`}
        tabIndex={0}
      >
        <div className="fg-stack">
          {tab === "focus" && <Placeholder label="Focus" />}
          {tab === "rules" && <Placeholder label="Rules" />}
          {tab === "you" && <Placeholder label="You" />}
        </div>
      </main>
      <nav className="fg-tabbar" aria-label="Panel sections">
        {TABS.map((item) => (
          <button
            key={item.value}
            type="button"
            role="tab"
            id={`panel-${item.value}-tab`}
            aria-selected={tab === item.value}
            aria-controls={`panel-${item.value}-panel`}
            className="fg-tabbar__btn"
            onClick={() => setTab(item.value)}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </nav>
    </div>
  );
}

function Placeholder({ label }: { label: string }) {
  return (
    <Card title={label}>
      <p className="fg-card__desc">This screen is being rebuilt.</p>
    </Card>
  );
}

export { PanelPage, statusFromState };
