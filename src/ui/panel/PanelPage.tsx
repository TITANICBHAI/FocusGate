import { useEffect, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";
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
    <PanelChrome
      tab={tab}
      onTabChange={setTab}
      header={<AppHeader pill={pillFor(summary, state, now)} onOpenSettings={openSettings} />}
      strip={
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
      }
      panels={{
        focus: (
          <FocusScreen
            state={state}
            onOpenRules={() => setTab("rules")}
            onOpenTasks={() => setTab("you")}
          />
        ),
        rules: <RulesScreen state={state} jumpTo={jump} />,
        you: (
          <YouScreen
            state={state}
            onOpenRules={(section) => {
              setJump((previous) => ({ section, nonce: previous.nonce + 1 }));
              setTab("rules");
            }}
          />
        ),
      }}
    />
  );
}

/**
 * The panel's frame: header, status line, the three screens and the tab bar.
 * The tab buttons sit in a tablist and each screen is the tabpanel one of them
 * controls, so `main` stays a plain landmark. Kept free of storage so a test
 * can render it.
 */
function PanelChrome({
  tab,
  onTabChange,
  header,
  strip,
  panels,
}: {
  tab: PanelTab;
  onTabChange: (tab: PanelTab) => void;
  header: ReactNode;
  strip: ReactNode;
  panels: Record<PanelTab, ReactNode>;
}) {
  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number): void {
    const last = TABS.length - 1;
    const next =
      event.key === "ArrowRight"
        ? index === last ? 0 : index + 1
        : event.key === "ArrowLeft"
          ? index === 0 ? last : index - 1
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? last
              : null;
    if (next === null) return;
    event.preventDefault();
    const target = TABS[next];
    if (!target) return;
    onTabChange(target.value);
    document.getElementById(`panel-${target.value}-tab`)?.focus();
  }

  return (
    <div className="fg-panel">
      <h1 className="fg-sr-only">FocusGate</h1>
      {header}
      {strip}
      <main className="fg-panel__main" tabIndex={0}>
        <div className="fg-stack">
          {TABS.map((item) => (
            <div
              key={item.value}
              id={`panel-${item.value}-panel`}
              role="tabpanel"
              aria-labelledby={`panel-${item.value}-tab`}
              hidden={tab !== item.value}
            >
              {panels[item.value]}
            </div>
          ))}
        </div>
      </main>
      <nav className="fg-tabbar" aria-label="Panel">
        <div role="tablist" aria-label="Panel sections" className="fg-tabbar__list">
          {TABS.map((item, index) => (
            <button
              key={item.value}
              type="button"
              role="tab"
              id={`panel-${item.value}-tab`}
              aria-selected={tab === item.value}
              aria-controls={`panel-${item.value}-panel`}
              tabIndex={tab === item.value ? 0 : -1}
              className="fg-tabbar__btn"
              onClick={() => onTabChange(item.value)}
              onKeyDown={(event) => onKeyDown(event, index)}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}

export { PanelPage, PanelChrome };
