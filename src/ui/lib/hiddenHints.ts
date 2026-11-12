/**
 * Which "i" hints a person has hidden. This is a preference of this browser
 * only: it is not part of the saved settings and never leaves the machine.
 * Reading and writing never throw, because a browser can block storage.
 */

const KEY = "focusgate.hidden-hints";

export interface HintStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** What was hidden this visit, for a browser that will not store it. */
let memory = new Set<string>();

const listeners = new Set<() => void>();

/**
 * Calls `listener` whenever a hint is hidden, shown or cleared, on this page or
 * (through the browser's storage event) on another open page of FocusGate.
 * Returns a function that stops listening.
 */
export function subscribeHiddenHints(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent): void => {
    if (event.key === null || event.key === KEY) listener();
  };
  if (typeof window !== "undefined") window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    if (typeof window !== "undefined") window.removeEventListener("storage", onStorage);
  };
}

function notify(): void {
  for (const listener of listeners) listener();
}

function browserStore(): HintStore | undefined {
  try {
    return typeof localStorage === "undefined" ? undefined : localStorage;
  } catch {
    return undefined;
  }
}

/**
 * The stored set, or null when the store cannot be read at all. A value that
 * can be read but is damaged counts as nothing hidden, not as unreadable.
 */
function load(store: HintStore | undefined | null): Set<string> | null {
  if (!store) return null;
  let raw: string | null;
  try {
    raw = store.getItem(KEY);
  } catch {
    return null;
  }
  const ids = new Set<string>();
  if (!raw) return ids;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      for (const id of parsed) {
        if (typeof id === "string") ids.add(id);
      }
    }
  } catch {
    // Damaged value: start again from nothing hidden.
  }
  return ids;
}

export function readHiddenHints(
  store: HintStore | undefined | null = browserStore(),
): Set<string> {
  return load(store) ?? new Set(memory);
}

/**
 * Hide or show one hint and return every hidden hint. It reads the store again
 * first, so a change made in another window is kept.
 */
export function setHintHidden(
  id: string,
  hidden: boolean,
  store: HintStore | undefined | null = browserStore(),
): Set<string> {
  const next = readHiddenHints(store);
  if (hidden) next.add(id);
  else next.delete(id);
  memory = new Set(next);
  try {
    store?.setItem(KEY, JSON.stringify([...next]));
  } catch {
    // The copy kept above still holds for this visit.
  }
  notify();
  return next;
}

/** Shows every hidden hint again. */
export function clearHiddenHints(store: HintStore | undefined | null = browserStore()): Set<string> {
  memory = new Set();
  try {
    store?.setItem(KEY, JSON.stringify([]));
  } catch {
    // Nothing is kept for this visit either, since memory was emptied above.
  }
  notify();
  return new Set();
}
