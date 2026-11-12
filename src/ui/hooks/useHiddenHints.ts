import { useEffect, useState } from "react";
import { readHiddenHints, setHintHidden, subscribeHiddenHints } from "../lib/hiddenHints.ts";

/** Which hints are hidden, and a way to hide or show one. Survives a reload. */
export function useHiddenHints(): {
  isHidden(id: string): boolean;
  setHidden(id: string, hidden: boolean): void;
} {
  const [hidden, setHiddenIds] = useState<ReadonlySet<string>>(() => readHiddenHints());
  // Follow changes made elsewhere: another screen on this page, or another open page.
  useEffect(() => subscribeHiddenHints(() => setHiddenIds(readHiddenHints())), []);
  return {
    isHidden: (id) => hidden.has(id),
    setHidden: (id, value) => setHiddenIds(setHintHidden(id, value)),
  };
}
