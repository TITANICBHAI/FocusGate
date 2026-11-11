import { useState } from "react";
import { readHiddenHints, setHintHidden } from "../lib/hiddenHints.ts";

/** Which hints are hidden, and a way to hide or show one. Survives a reload. */
export function useHiddenHints(): {
  isHidden(id: string): boolean;
  setHidden(id: string, hidden: boolean): void;
} {
  const [hidden, setHiddenIds] = useState<ReadonlySet<string>>(() => readHiddenHints());
  return {
    isHidden: (id) => hidden.has(id),
    setHidden: (id, value) => setHiddenIds(setHintHidden(id, value)),
  };
}
