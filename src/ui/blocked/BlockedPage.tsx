import { useEffect, useState } from "react";
import { explainBlock } from "../../shared/plan.ts";
import { quoteForLocalDate } from "../../shared/blockPage.ts";
import { localDateKey } from "../../shared/time.ts";
import { Button, Card, Chip } from "../components/primitives.tsx";
import { StorageGate } from "../components/StorageGate.tsx";
import { APP_STATE_KEYS } from "../hooks/storageStore.ts";
import { useAppState } from "../hooks/useStorage.ts";
import { parseBlockTarget } from "../lib/blockTarget.ts";
import { ThemeRoot } from "../theme.tsx";

function formatClock(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatRemaining(milliseconds: number): string {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1_000));
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(
    seconds % 60,
  ).padStart(2, "0")}`;
}

function reasonTitle(
  reason: NonNullable<ReturnType<typeof explainBlock>>,
): string {
  switch (reason.kind) {
    case "session":
      return "Focus session";
    case "standalone":
      return "Standalone block";
    case "schedule":
      return `Schedule: ${reason.name}`;
    case "allowance":
      return "Daily limit reached";
    case "always":
      return "Always blocked";
    case "allowOnly":
      return "Not on the allowed list";
    case "keyword":
      return `Keyword “${reason.keyword}” matched this ${reason.where === "query" ? "search" : "page"}`;
  }
}

function BlockedScreen() {
  const state = useAppState();
  const [now, setNow] = useState(() => Date.now());
  const [actionMessage, setActionMessage] = useState("");
  const target = parseBlockTarget(window.location.hash);
  const reason = target ? explainBlock(target, state, now) : null;
  const ended = Boolean(target && reason === null);
  const targetHost = target ? new URL(target).hostname : null;
  const dateKey = localDateKey(new Date(now));
  const blocksToday =
    state.dayStats[dateKey]?.blocks ??
    state.recentBlocks.filter((record) => localDateKey(new Date(record.at)) === dateKey)
      .length;

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!reason || !state.settings.blockPage.sound) return;
    let audio: AudioContext | undefined;
    let oscillator: OscillatorNode | undefined;
    let closeTimer: number | undefined;
    try {
      audio = new AudioContext();
      oscillator = audio.createOscillator();
      const gain = audio.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = 440;
      gain.gain.setValueAtTime(0.06, audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.18);
      oscillator.connect(gain);
      gain.connect(audio.destination);
      oscillator.start();
      oscillator.stop(audio.currentTime + 0.18);
      void audio.resume().catch(() => undefined);
      closeTimer = window.setTimeout(() => void audio?.close().catch(() => undefined), 350);
    } catch {
      void audio?.close().catch(() => undefined);
    }
    return () => {
      if (closeTimer !== undefined) window.clearTimeout(closeTimer);
      try {
        oscillator?.stop();
      } catch {
        // The oscillator may already have stopped.
      }
      void audio?.close().catch(() => undefined);
    };
  }, [reason?.kind, state.settings.blockPage.sound, target]);

  async function closeCurrentTab() {
    if (typeof chrome === "undefined" || !chrome.runtime?.id || !chrome.tabs) {
      setActionMessage("Open this page from FocusGate to close its tab.");
      return;
    }
    try {
      const current = await chrome.tabs.getCurrent();
      if (current?.id === undefined) {
        setActionMessage("FocusGate could not identify this tab.");
        return;
      }
      await chrome.tabs.remove(current.id);
    } catch {
      setActionMessage("FocusGate could not close this tab. You can close it in your browser.");
    }
  }

  async function openNewTab(url?: string) {
    if (typeof chrome === "undefined" || !chrome.runtime?.id || !chrome.tabs) {
      setActionMessage("Open this page from FocusGate to use browser tab actions.");
      return;
    }
    try {
      await chrome.tabs.create(url ? { url } : {});
      setActionMessage(url ? `Opened ${targetHost ?? "the page"} in a new tab.` : "New tab opened.");
    } catch {
      setActionMessage("FocusGate could not open a new tab.");
    }
  }

  const customMessage = state.settings.blockPage.message.trim();
  const defaultMessage = "You are supposed to be focusing right now.";
  const quote = state.settings.blockPage.showQuotes
    ? quoteForLocalDate(state.settings.blockPage.quotes, dateKey)
    : undefined;

  return (
    <main className="fg-full-page fg-block-page">
      <div className="fg-block-page__content">
        <header className="fg-block-page__header">
          <img src="/icon.png" alt="" width="40" height="40" />
          <div>
            <p className="fg-eyebrow">FocusGate</p>
            <h1>{ended ? "Block ended" : reason ? reasonTitle(reason) : "Page unavailable"}</h1>
          </div>
        </header>

        {reason ? (
          <Card className="fg-block-page__card">
            <p className="fg-block-page__message">
              {customMessage && customMessage !== defaultMessage
                ? customMessage
                : "This page is blocked by your current FocusGate rules."}
            </p>
            {(reason.kind === "session" || reason.kind === "standalone") && (
              <p className="fg-block-page__countdown" aria-live="off">
                {formatRemaining(reason.until - now)} remaining
                <span className="fg-muted"> · ends {formatClock(reason.until)}</span>
              </p>
            )}
            {reason.kind === "schedule" && (
              <p className="fg-muted">This schedule ends at {formatClock(reason.until)}.</p>
            )}
            {reason.kind === "allowance" && (
              <p className="fg-muted">
                Your allowance resets at {formatClock(reason.resetsAt)}.
              </p>
            )}
            {reason.kind === "keyword" && (
              <p className="fg-muted">
                Matching {reason.where === "query" ? "search terms" : "page address"}:{" "}
                <strong>{reason.keyword}</strong>
              </p>
            )}
            {target && (
              <p className="fg-block-page__target">
                <span className="fg-muted">Address</span>
                <code>{target}</code>
              </p>
            )}
            {quote && <blockquote>{quote}</blockquote>}
            <Chip tone="neutral">{blocksToday} pages blocked today</Chip>
          </Card>
        ) : ended ? (
          <Card className="fg-block-page__card">
            <p className="fg-block-page__message">
              {targetHost
                ? `${targetHost} is no longer blocked by the current rules.`
                : "This page is no longer blocked by the current rules."}
            </p>
            {target && <code className="fg-block-page__target">{target}</code>}
            <div className="fg-wrap">
              <Button onClick={() => void openNewTab(target ?? undefined)}>
                Open {targetHost ?? "page"}
              </Button>
              <Button variant="secondary" onClick={() => void openNewTab()}>
                Open new tab
              </Button>
            </div>
          </Card>
        ) : (
          <Card className="fg-block-page__card">
            <p className="fg-block-page__message">
              The address in this block-page link is missing or is not an HTTP or HTTPS page.
            </p>
          </Card>
        )}

        {reason && (
          <div className="fg-block-page__actions">
            <Button variant="secondary" onClick={() => void closeCurrentTab()}>
              Close tab
            </Button>
            <Button variant="quiet" onClick={() => void openNewTab()}>
              Open new tab
            </Button>
          </div>
        )}
        {actionMessage && <p className="fg-muted" role="status">{actionMessage}</p>}
      </div>
    </main>
  );
}

export function BlockedPage() {
  return (
    <StorageGate keys={APP_STATE_KEYS}>
      <ThemeRoot>
        <BlockedScreen />
      </ThemeRoot>
    </StorageGate>
  );
}
