import { useCallback, useEffect, useState } from "react";
import { createDefaultState } from "../shared/defaults.ts";
import type { AppState, SessionState, Settings } from "../shared/types.ts";

export interface SessionReply {
  ok: boolean;
  code?: string;
  message?: string;
  waitMs?: number;
  session?: SessionState;
}

export interface StagedSessionState {
  ready: boolean;
  session: SessionState;
  settings: Settings;
  hasPassword: boolean;
  now: number;
  error: string | null;
  send(message: Record<string, unknown>): Promise<SessionReply>;
}

/**
 * v2-only storage reader for the staged timer page. It deliberately does not
 * call shared/storage.ready(), which would migrate keys used by the active v1 UI.
 */
export function useStagedSession(): StagedSessionState {
  const [defaults] = useState(() => createDefaultState());
  const [session, setSession] = useState<SessionState>(defaults.session);
  const [settings, setSettings] = useState<Settings>(defaults.settings);
  const [hasPassword, setHasPassword] = useState(false);
  const [ready, setReady] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const applyState = (stored: Partial<AppState>) => {
      if (!mounted) return;
      if (stored.session) setSession(stored.session);
      if (stored.settings) setSettings(stored.settings);
      setHasPassword(stored.password !== undefined && stored.password !== null);
      setReady(true);
    };

    if (typeof chrome === "undefined" || !chrome.storage?.local) {
      setError("Open this timer from the FocusGate extension.");
      setReady(true);
      return () => {
        mounted = false;
      };
    }

    void chrome.storage.local
      .get({
        session: defaults.session,
        settings: defaults.settings,
        password: defaults.password,
      })
      .then((stored) => applyState(stored as Partial<AppState>))
      .catch(() => {
        if (!mounted) return;
        setError("FocusGate could not read the session.");
        setReady(true);
      });

    const onChanged: Parameters<
      typeof chrome.storage.onChanged.addListener
    >[0] = (changes, areaName) => {
      if (areaName !== "local") return;
      if (changes.session) setSession(changes.session.newValue as SessionState);
      if (changes.settings) setSettings(changes.settings.newValue as Settings);
      if (changes.password) {
        setHasPassword(changes.password.newValue != null);
      }
    };
    chrome.storage.onChanged.addListener(onChanged);
    return () => {
      mounted = false;
      chrome.storage.onChanged.removeListener(onChanged);
    };
  }, [defaults]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  const send = useCallback(
    async (message: Record<string, unknown>): Promise<SessionReply> => {
      setError(null);
      if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) {
        const reply = {
          ok: false,
          code: "EXTENSION_UNAVAILABLE",
          message: "Open this timer from the FocusGate extension.",
        };
        setError(reply.message);
        return reply;
      }
      try {
        const reply = (await chrome.runtime.sendMessage(message)) as SessionReply;
        if (!reply.ok) setError(reply.message ?? "The session action failed.");
        return reply;
      } catch {
        const reply = {
          ok: false,
          code: "SESSION_ACTION_FAILED",
          message: "The session action could not be completed. Try again.",
        };
        setError(reply.message);
        return reply;
      }
    },
    [],
  );

  return { ready, session, settings, hasPassword, now, error, send };
}
