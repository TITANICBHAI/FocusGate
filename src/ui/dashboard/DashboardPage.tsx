import { useState } from "react";
import type { FormEvent } from "react";
import type { AppState, WeeklyReport } from "../../shared/types.ts";
import { Button, Card, EmptyState, Field } from "../components/primitives.tsx";
import { StorageGate } from "../components/StorageGate.tsx";
import { Tabs } from "../components/Tabs.tsx";
import type { TabOption } from "../components/Tabs.tsx";
import { GuardPromptHost } from "../components/GuardPromptHost.tsx";
import { Modal, ToastProvider, useToast } from "../components/feedback.tsx";
import { APP_STATE_KEYS } from "../hooks/storageStore.ts";
import { useAppState } from "../hooks/useStorage.ts";
import { applyBackup, BACKUP_MAX_BYTES, createBackupJson, parseBackupJson } from "../../shared/backup.ts";
import type { FocusGateBackup } from "../../shared/backup.ts";
import { guard } from "../../shared/gating.ts";
import { RESET_CONFIRMATION_PHRASE } from "../../shared/dataActions.ts";
import type { DataActionResult } from "../../background/dataActions.ts";
import { sendDataActionMessage } from "../lib/dataActions.ts";
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
  const showToast = useToast();
  const [backupJson, setBackupJson] = useState<string | null>(null);
  const [backupPreview, setBackupPreview] = useState<FocusGateBackup | null>(null);
  const [backupError, setBackupError] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetText, setResetText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<DataActionResult | null>(null);

  const resetDecision = guard("reset_data", {
    session: state.session,
    standalone: state.standalone,
    hasPassword: state.password !== null,
    now: Date.now(),
  });
  const resetLocked = resetDecision.result === "locked";
  const preview = backupPreview ? applyBackup(state, backupPreview).report : null;

  function exportBackup() {
    try {
      const json = createBackupJson(state);
      const url = URL.createObjectURL(
        new Blob([json], { type: "application/json" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = `focusgate-backup-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      showToast("Backup exported.", "success");
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : "FocusGate could not export this backup.",
        "error",
      );
    }
  }

  async function readBackup(file: File | undefined) {
    setBackupError("");
    setResult(null);
    setBackupJson(null);
    setBackupPreview(null);
    if (!file) return;
    if (file.size > BACKUP_MAX_BYTES) {
      setBackupError("Backup files must be 2 MB or smaller.");
      return;
    }
    try {
      const json = await file.text();
      const parsed = parseBackupJson(json);
      if (!parsed.ok) {
        setBackupError(parsed.error);
        return;
      }
      setBackupJson(json);
      setBackupPreview(parsed.backup);
    } catch {
      setBackupError("FocusGate could not read this file.");
    }
  }

  async function importBackup() {
    if (!backupJson) return;
    setBusy(true);
    const response = await sendDataActionMessage({
      type: "backup/import",
      json: backupJson,
    });
    setBusy(false);
    if (!response.ok) {
      showToast(response.message ?? "The backup could not be imported.", "error");
      return;
    }
    setResult(response);
    setImportOpen(false);
    showToast(
      response.mode === "merge" ? "Backup merged safely." : "Backup restored.",
      "success",
    );
    if (response.warning) showToast(response.warning, "error");
  }

  async function resetData(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const response = await sendDataActionMessage({
      type: "data/reset",
      confirm: resetText,
    });
    setBusy(false);
    if (!response.ok) {
      showToast(response.message ?? "Data could not be reset.", "error");
      return;
    }
    setResetOpen(false);
    setResetText("");
    setResult(null);
    setBackupJson(null);
    setBackupPreview(null);
    showToast("FocusGate data was reset.", "success");
    if (response.warning) showToast(response.warning, "error");
  }

  return (
    <section className="fg-page" aria-labelledby="backup-title">
      <div className="fg-page__heading">
        <div>
          <h1 id="backup-title">Backup and restore</h1>
          <p className="fg-muted">
            Export your settings and activity, or restore from a FocusGate backup.
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
            This migration safety copy is separate from your downloadable backup.
          </p>
        </Card>
      ) : (
        <Card title="Your browser data">
          <p className="fg-muted">
            Your data stays in browser storage. Backups never contain your
            password record, active session, standalone block, usage ledger, or
            enforcement health.
          </p>
        </Card>
      )}
      <div className="fg-wrap">
        <Button variant="secondary" onClick={exportBackup}>
          Export backup
        </Button>
        <input
          id="backup-file"
          type="file"
          accept=".json,application/json"
          aria-label="Choose a FocusGate backup file"
          onChange={(event) => void readBackup(event.currentTarget.files?.[0])}
        />
      </div>
      {backupError && <p className="fg-field__error" role="alert">{backupError}</p>}
      {backupPreview && preview && (
        <Card title="Backup preview">
          <p className="fg-muted">
            Exported {new Date(backupPreview.exportedAt).toLocaleString()}.
            This will {preview.mode === "merge" ? "merge safely with existing data" : "restore into an empty state"}.
          </p>
          <dl className="fg-stat-list">
            <div><dt>Sites</dt><dd>{backupPreview.data.sites.length + backupPreview.data.alwaysBlockedSites.length}</dd></div>
            <div><dt>Keywords</dt><dd>{backupPreview.data.keywords.length}</dd></div>
            <div><dt>Schedules</dt><dd>{backupPreview.data.schedules.length}</dd></div>
            <div><dt>Allowances</dt><dd>{Object.keys(backupPreview.data.allowances).length}</dd></div>
            <div><dt>Exceptions</dt><dd>{backupPreview.data.exceptions.length}</dd></div>
            <div><dt>Tasks</dt><dd>{backupPreview.data.tasks.length}</dd></div>
            <div><dt>Session records</dt><dd>{backupPreview.data.stats.sessionHistory.length}</dd></div>
          </dl>
          <p className="fg-muted">
            Import only adds or strengthens data in a working state. It never
            replaces existing data and is allowed during a lock.
          </p>
          <Button onClick={() => setImportOpen(true)}>Import backup</Button>
        </Card>
      )}
      {result?.ok && (
        <Card title={result.mode === "merge" ? "Backup merge results" : result.mode === "reset" ? "Data reset" : "Backup restore results"}>
          {result.added && result.added.length > 0 && (
            <>
              <h3>Added or restored</h3>
              <ul>{result.added.map((item) => <li key={item}>{item}</li>)}</ul>
            </>
          )}
          {result.skipped && result.skipped.length > 0 && (
            <>
              <h3>Skipped for safety</h3>
              <ul>{result.skipped.map((item) => <li key={item}>{item}</li>)}</ul>
            </>
          )}
          {(!result.skipped || result.skipped.length === 0) && (
            <p className="fg-muted">No imported data needed to be skipped.</p>
          )}
        </Card>
      )}
      <Card title="Reset all data">
        <p className="fg-muted">
          Reset removes your rules, tasks, settings, password, and saved activity.
          Export a backup first if you may need this data later.
        </p>
        <Button
          variant="danger"
          disabled={resetLocked}
          title={resetLocked ? resetDecision.reason : undefined}
          onClick={() => setResetOpen(true)}
        >
          Reset all data
        </Button>
        {resetLocked && (
          <p className="fg-muted" role="status">{resetDecision.reason}</p>
        )}
      </Card>
      <Modal
        open={importOpen}
        title="Import this backup?"
        description={
          preview?.mode === "merge"
            ? "Existing data will be kept. Only new or stricter settings will be added; exceptions and history are skipped."
            : "This backup will be restored into the empty state. Passwords and live runtime state are never imported."
        }
        onClose={() => setImportOpen(false)}
        actions={
          <>
            <Button variant="secondary" onClick={() => setImportOpen(false)}>
              Cancel
            </Button>
            <Button disabled={busy || !backupJson} onClick={() => void importBackup()}>
              {busy ? "Importing…" : "Import backup"}
            </Button>
          </>
        }
      >
        {preview && (
          <ul>
            {preview.added.map((item) => <li key={item}>{item}</li>)}
            {preview.skipped.map((item) => <li key={item}>{item}</li>)}
          </ul>
        )}
      </Modal>
      <Modal
        open={resetOpen}
        title="Reset all FocusGate data?"
        description="You won't be able to undo this unless you first export a backup. Reset is refused while a strict, commitment, or standalone block is active."
        onClose={() => {
          setResetOpen(false);
          setResetText("");
        }}
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setResetOpen(false);
                setResetText("");
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="reset-data-form"
              variant="danger"
              disabled={busy || resetText !== RESET_CONFIRMATION_PHRASE || resetLocked}
            >
              {busy ? "Resetting…" : "Confirm reset"}
            </Button>
          </>
        }
      >
        <form id="reset-data-form" className="fg-stack" onSubmit={resetData}>
          <Field
            id="reset-confirmation"
            label={`Type ${RESET_CONFIRMATION_PHRASE}`}
            helper="Your current password will also be required if one is set."
          >
            <input
              id="reset-confirmation"
              value={resetText}
              autoComplete="off"
              onChange={(event) => setResetText(event.target.value)}
            />
          </Field>
        </form>
      </Modal>
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
