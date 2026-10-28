import { useState } from "react";
import type { AppState, WeeklyReport } from "../../shared/types.ts";
import { Button, Card, EmptyState } from "../components/primitives.tsx";
import { StorageGate } from "../components/StorageGate.tsx";
import { Tabs } from "../components/Tabs.tsx";
import type { TabOption } from "../components/Tabs.tsx";
import { GuardPromptHost } from "../components/GuardPromptHost.tsx";
import { ToastProvider } from "../components/feedback.tsx";
import { APP_STATE_KEYS } from "../hooks/storageStore.ts";
import { useAppState } from "../hooks/useStorage.ts";
import { RulesView } from "../popup/RulesView.tsx";
import { SettingsView } from "../popup/SettingsView.tsx";
import { StatsView } from "../popup/StatsView.tsx";
import { ThemeRoot } from "../theme.tsx";

type DashboardTab = "stats" | "reports" | "rules" | "settings" | "backup";

const DASHBOARD_TABS: readonly TabOption<DashboardTab>[] = [
  { value: "stats", label: "Stats" },
  { value: "reports", label: "Reports" },
  { value: "rules", label: "Rules" },
  { value: "settings", label: "Settings" },
  { value: "backup", label: "Backup" },
];

export function DashboardPage() {
  return (
    <StorageGate keys={APP_STATE_KEYS}>
      <ToastProvider>
        <ThemeRoot>
          <GuardPromptHost />
          <DashboardShell />
        </ThemeRoot>
      </ToastProvider>
    </StorageGate>
  );
}

function DashboardShell() {
  const state = useAppState();
  const [tab, setTab] = useState<DashboardTab>("stats");
  const [message, setMessage] = useState("");

  async function openPopup() {
    if (
      typeof chrome === "undefined" ||
      !chrome.runtime?.id ||
      !chrome.action?.openPopup
    ) {
      setMessage("Open FocusGate from your browser toolbar.");
      return;
    }
    try {
      await chrome.action.openPopup();
    } catch {
      setMessage("Open FocusGate from your browser toolbar.");
    }
  }

  return (
    <div className="fg-dashboard">
      <header className="fg-dashboard__header">
        <a className="fg-dashboard__brand" href="./dashboard.html" aria-label="FocusGate dashboard">
          <img src="/icon.png" alt="" width="34" height="34" />
          <span>
            <strong>FocusGate</strong>
            <span className="fg-muted">Dashboard</span>
          </span>
        </a>
        <div className="fg-dashboard__header-actions">
          <a
            className="fg-dashboard__setup"
            href="./onboarding.html"
            target="_blank"
            rel="noreferrer"
          >
            Run setup
          </a>
          <Button variant="secondary" onClick={() => void openPopup()}>
            Open popup
          </Button>
        </div>
      </header>
      {message && <p className="fg-muted" role="status">{message}</p>}
      <Tabs
        idPrefix="dashboard"
        label="Dashboard sections"
        options={DASHBOARD_TABS}
        value={tab}
        onChange={setTab}
        className="fg-dashboard__tabs"
      />
      <main
        className="fg-dashboard__main"
        id={`dashboard-${tab}-panel`}
        role="tabpanel"
        aria-labelledby={`dashboard-${tab}-tab`}
        tabIndex={0}
      >
        {tab === "stats" && <StatsView state={state} />}
        {tab === "reports" && <ReportsPanel state={state} />}
        {tab === "rules" && <RulesView state={state} />}
        {tab === "settings" && <SettingsView state={state} />}
        {tab === "backup" && <BackupPanel state={state} />}
      </main>
    </div>
  );
}

function ReportsPanel({ state }: { state: AppState }) {
  const reports = [...state.weeklyReports].reverse();
  return (
    <section className="fg-page" aria-labelledby="reports-title">
      <div className="fg-page__heading">
        <div>
          <h1 id="reports-title">Weekly reports</h1>
          <p className="fg-muted">Review saved summaries of your focus activity.</p>
        </div>
      </div>
      {reports.length === 0 ? (
        <EmptyState
          title="No weekly reports yet"
          description="A report will appear here after FocusGate records one."
        />
      ) : (
        <div className="fg-stack">
          {reports.map((report, index) => (
            <WeeklyReportCard
              key={`${stringField(report, "startDateKey") ?? "report"}-${index}`}
              report={report}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function WeeklyReportCard({ report }: { report: WeeklyReport }) {
  const start = stringField(report, "startDateKey");
  const end = stringField(report, "endDateKey");
  const focusText = stringField(report, "focusText");
  const topBlockedSites = Array.isArray(report.topBlockedSites)
    ? report.topBlockedSites.filter(
        (site): site is { domain: string; count: number } =>
          Boolean(
            site &&
              typeof site === "object" &&
              typeof (site as { domain?: unknown }).domain === "string" &&
              typeof (site as { count?: unknown }).count === "number",
          ),
      )
    : [];
  return (
    <Card title={start && end ? `${start} – ${end}` : "Weekly summary"}>
      <dl className="fg-stat-list">
        <div><dt>Focus time</dt><dd>{focusText ?? "Not recorded"}</dd></div>
        <div><dt>Sessions completed</dt><dd>{numberField(report, "sessionsCompleted")}</dd></div>
        <div><dt>Tasks completed</dt><dd>{numberField(report, "tasksCompleted")}</dd></div>
        <div><dt>Pages blocked</dt><dd>{numberField(report, "blockedAttempts")}</dd></div>
        <div><dt>Current streak</dt><dd>{numberField(report, "streak")} days</dd></div>
      </dl>
      {topBlockedSites.length > 0 && (
        <div className="fg-stack fg-report-sites">
          <h3>Most blocked sites</h3>
          <ul className="fg-list">
            {topBlockedSites.map((site) => (
              <li className="fg-list-item" key={site.domain}>
                <strong>{site.domain}</strong>
                <span className="fg-muted">{site.count} blocks</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

function BackupPanel({ state }: { state: AppState }) {
  return (
    <section className="fg-page" aria-labelledby="backup-title">
      <div className="fg-page__heading">
        <div>
          <h1 id="backup-title">Backup and restore</h1>
          <p className="fg-muted">
            Backup export and restore are not available yet.
          </p>
        </div>
      </div>
      {state.backup_v1 ? (
        <Card title="Migration safety copy">
          <p className="fg-muted">
            A legacy data copy is stored from{" "}
            {new Date(state.backup_v1.createdAt).toLocaleString()}.
          </p>
          <p className="fg-muted">
            This is a migration safety copy, not an export you can restore from this page.
          </p>
        </Card>
      ) : (
        <Card title="Your browser data">
          <p className="fg-muted">
            Your settings, tasks, and focus history are stored in browser storage.
            A downloadable backup is not available yet.
          </p>
        </Card>
      )}
      <div className="fg-wrap">
        <Button
          variant="secondary"
          disabled
          aria-describedby="backup-controls-help"
          title="Backup export is not available yet."
        >
          Export backup
        </Button>
        <Button
          variant="secondary"
          disabled
          aria-describedby="backup-controls-help"
          title="Backup restore is not available yet."
        >
          Restore backup
        </Button>
      </div>
      <p className="fg-muted" id="backup-controls-help">
        Backup export and restore are not available yet.
      </p>
    </section>
  );
}

function stringField(report: WeeklyReport, key: string): string | null {
  const value = report[key];
  return typeof value === "string" ? value : null;
}

function numberField(report: WeeklyReport, key: string): number {
  const value = report[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
