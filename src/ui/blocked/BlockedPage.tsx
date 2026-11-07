import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { explainBlock } from "../../shared/plan.ts";
import { quoteForLocalDate } from "../../shared/blockPage.ts";
import { DEFAULT_BLOCK_MESSAGE } from "../../shared/defaults.ts";
import type { AppState } from "../../shared/types.ts";
import { localDateKey } from "../../shared/time.ts";
import { Button } from "../components/primitives.tsx";
import { StorageGate } from "../components/StorageGate.tsx";
import { APP_STATE_KEYS } from "../hooks/storageStore.ts";
import { formatClockTime } from "../../shared/clockFormat.ts";
import { useAppState } from "../hooks/useStorage.ts";
import { parseBlockTarget } from "../lib/blockTarget.ts";
import { ThemeRoot } from "../theme.tsx";

const formatClock = formatClockTime;

function formatRemaining(milliseconds: number): string {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1_000));
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(
    seconds % 60,
  ).padStart(2, "0")}`;
}

export function reasonTitle(
  reason: NonNullable<ReturnType<typeof explainBlock>>,
): string {
  switch (reason.kind) {
    case "session":
      return "Blocked by focus session";
    case "standalone":
      return "Blocked by Block now";
    case "schedule":
      return `Blocked by schedule: ${reason.name}`;
    case "allowance":
      return "Blocked by daily limit";
    case "always":
      return "Blocked by your Always list";
    case "allowOnly":
      return "Blocked: not on your allowed list";
    case "keyword":
      return `Blocked by keyword “${reason.keyword}”`;
  }
}

export function reasonMeta(
  reason: NonNullable<ReturnType<typeof explainBlock>>,
): string | null {
  switch (reason.kind) {
    case "session":
    case "standalone":
      return `Ends ${formatClock(reason.until)}`;
    case "schedule":
      return `Ends ${formatClock(reason.until)}`;
    case "allowance":
      return `Your allowance resets at ${formatClock(reason.resetsAt)}.`;
    case "keyword":
      return `Matching ${
        reason.where === "query" ? "search terms" : "page address"
      }: ${reason.keyword}`;
    default:
      return null;
  }
}

/** "1 page blocked today", "2 pages blocked today". */
export function blockedCountLabel(count: number): string {
  return `${count} ${count === 1 ? "page" : "pages"} blocked today`;
}

/** The reason section of the block page: headline, countdown, detail, the person's reason. */
export function BlockedReasonBody({
  reason,
  target,
  now,
  settings,
  blocksToday,
  dateKey,
  actions,
}: {
  actions?: ReactNode;
  reason: NonNullable<ReturnType<typeof explainBlock>>;
  target: string | null;
  now: number;
  settings: AppState["settings"];
  blocksToday: number;
  dateKey: string;
}) {
  // Only a message the person wrote is shown; the stock one is not repeated.
  const customMessage = settings.blockPage.message.trim();
  const detail =
    customMessage && customMessage !== DEFAULT_BLOCK_MESSAGE
      ? customMessage
      : "This page is blocked by your current FocusGate rules.";
  const quote = settings.blockPage.showQuotes
    ? quoteForLocalDate(settings.blockPage.quotes, dateKey)
    : undefined;
  return (
    <section aria-labelledby="blocked-reason">
      <div className="fg-block-head">
        <h1 id="blocked-reason" className="fg-block-headline">
          {reasonTitle(reason)}
        </h1>
        {target && <p className="fg-block-url">{target}</p>}
        {reasonMeta(reason) && <p className="fg-block-meta">{reasonMeta(reason)}</p>}
      </div>
      {(reason.kind === "session" || reason.kind === "standalone") && (
        <p className="fg-block-countdown" aria-live="off">
          {formatRemaining(reason.until - now)}
        </p>
      )}
      <p className="fg-block-context">{detail}</p>
      {settings.why && (
        <p className="fg-block-why">
          <span className="fg-block-why__label">Your reason</span>
          <span className="fg-block-why__text">“{settings.why}”</span>
        </p>
      )}
      {quote && <p className="fg-block-quote">“{quote}”</p>}
      {actions}
      <p className="fg-block-count-label">{blockedCountLabel(blocksToday)}</p>
    </section>
  );
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

  return (
    <main className="fg-full-page">
      <div className="fg-full-page__inner fg-block-inner">
        <div className="fg-block-brand">
          <img src="/icon.png" alt="" width="20" height="20" />
          <span>FocusGate</span>
        </div>

        {reason ? (
          <BlockedReasonBody
            reason={reason}
            target={target}
            now={now}
            settings={state.settings}
            blocksToday={blocksToday}
            dateKey={dateKey}
            actions={
              <div className="fg-block-btnrow">
                <Button variant="primary" onClick={() => void closeCurrentTab()}>
                  Close tab
                </Button>
                <Button variant="quiet" onClick={() => void openNewTab()}>
                  Open new tab
                </Button>
              </div>
            }
          />
        ) : ended ? (
          <section aria-labelledby="blocked-ended">
            <h1 id="blocked-ended" className="fg-block-headline">
              {targetHost ?? "This page"} is no longer blocked
            </h1>
            {target && <p className="fg-block-url">{target}</p>}
            <div className="fg-block-btnrow">
              <Button variant="primary" onClick={() => void openNewTab(target ?? undefined)}>
                Open {targetHost ?? "page"}
              </Button>
              <Button variant="quiet" onClick={() => void openNewTab()}>
                Open new tab
              </Button>
            </div>
          </section>
        ) : (
          <section aria-labelledby="blocked-invalid">
            <h1 id="blocked-invalid" className="fg-block-headline">
              Page unavailable
            </h1>
            <p className="fg-block-context">
              The address in this block-page link is missing or is not an HTTP or HTTPS page.
            </p>
          </section>
        )}

        {actionMessage && <p className="fg-block-status" role="status">{actionMessage}</p>}
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
