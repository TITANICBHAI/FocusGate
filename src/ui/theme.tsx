import { useEffect } from "react";
import type { ReactNode } from "react";
import { useAppState } from "./hooks/useStorage.ts";

export function ThemeRoot({ children }: { children: ReactNode }) {
  const state = useAppState();
  useEffect(() => {
    document.documentElement.dataset.theme = state.settings.theme;
  }, [state.settings.theme]);
  return children;
}
