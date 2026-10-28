import { useEffect } from "react";
import type { ReactNode } from "react";
import { useAppState } from "./hooks/useStorage.ts";

export function ThemeRoot({ children }: { children: ReactNode }) {
  const state = useAppState();
  useEffect(() => {
    document.documentElement.dataset.theme = state.settings.theme;
    const scale = Number.isFinite(state.settings.fontScale)
      ? Math.min(1.2, Math.max(0.9, state.settings.fontScale))
      : 1;
    document.documentElement.style.fontSize = `${scale * 100}%`;
  }, [state.settings.theme, state.settings.fontScale]);
  return children;
}
