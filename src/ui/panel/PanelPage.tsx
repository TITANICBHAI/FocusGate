import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Shield, Timer, User } from "lucide-react";
import { describeNow } from "../lib/statusSummary.ts";
import { APP_STATE_KEYS } from "../hooks/storageStore.ts";
import { useAppState } from "../hooks/useStorage.ts";
import { StorageGate } from "../components/StorageGate.tsx";
import { GuardPromptHost } from "../components/GuardPromptHost.tsx";
import { ToastProvider } from "../components/feedback.tsx";
import { AppHeader } from "../components/primitives.tsx";
import { StatusStrip, pillFor } from "../components/StatusStrip.tsx";
import { FocusScreen } from "./views/FocusScreen.tsx";
import { RulesScreen } from "./views/RulesScreen.tsx";
import type { RuleSection } from "./views/RulesScreen.tsx";
import { YouScreen } from "./views/YouScreen.tsx";
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
  const [jump, setJump] = useState<{ section: RuleSection; nonce: number }>({
    section: "sites",
    nonce: 0,
  });
  // The status line depends on the clock (a schedule can start by itself), so
  // look again every half minute. Per-second timing stays in the Focus tab.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const summary = describeNow(state, now);

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
      <AppHeader pill={pillFor(summary, state, now)} onOpenSettings={openSettings} />
      <StatusStrip
        summary={summary}
        onCta={(target) => {
          setJump((current) => ({
            section: target === "schedule" ? "schedule" : "sites",
            nonce: current.nonce + 1,
          }));
          setTab("rules");
        }}
      />
      <main
        className="fg-panel__main"
        id={`panel-${tab}-panel`}
        role="tabpanel"
        aria-labelledby={`panel-${tab}-tab`}
        tabIndex={0}
      >
        <div className="fg-stack">
          <div hidden={tab !== "focus"}>
            <FocusScreen
              state={state}
              onOpenRules={() => setTab("rules")}
              onOpenTasks={() => setTab("you")}
            />
          </div>
          <div hidden={tab !== "rules"}>
            <RulesScreen state={state} jumpTo={jump} />
          </div>
          <div hidden={tab !== "you"}>
            <YouScreen state={state} />
          </div>
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

export { PanelPage };
