/**
 * Which session's done card has rung the chime and which has been dismissed.
 * One of each is kept, because only the latest session ever has a card. It is
 * a preference of this browser only and never leaves the machine. Reading and
 * writing never throw, because a browser can block storage.
 */

const KEY = "focusgate.done-card";

export interface DoneSeenStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface DoneSeen {
  chimed?: string;
  dismissed?: string;
}

/** What was seen this visit, for a browser that will not store it. */
let memory: DoneSeen = {};

export function resetDoneSeenMemory(): void {
  memory = {};
}

function browserStore(): DoneSeenStore | undefined {
  try {
    return typeof localStorage === "undefined" ? undefined : localStorage;
  } catch {
    return undefined;
  }
}

function load(store: DoneSeenStore | undefined | null): DoneSeen | null {
  if (!store) return null;
  let raw: string | null;
  try {
    raw = store.getItem(KEY);
  } catch {
    return null;
  }
  const seen: DoneSeen = {};
  if (!raw) return seen;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === "object" && parsed !== null) {
      const { chimed, dismissed } = parsed as Record<string, unknown>;
      if (typeof chimed === "string") seen.chimed = chimed;
      if (typeof dismissed === "string") seen.dismissed = dismissed;
    }
  } catch {
    // Damaged value: start again from nothing seen.
  }
  return seen;
}

export function readDoneSeen(store: DoneSeenStore | undefined | null = browserStore()): DoneSeen {
  return load(store) ?? { ...memory };
}

function write(change: DoneSeen, store: DoneSeenStore | undefined | null): DoneSeen {
  const next = { ...readDoneSeen(store), ...change };
  memory = { ...next };
  try {
    store?.setItem(KEY, JSON.stringify(next));
  } catch {
    // The copy kept above still holds for this visit.
  }
  return next;
}

export function markDoneChimed(id: string, store: DoneSeenStore | undefined | null = browserStore()): DoneSeen {
  return write({ chimed: id }, store);
}

export function markDoneDismissed(id: string, store: DoneSeenStore | undefined | null = browserStore()): DoneSeen {
  return write({ dismissed: id }, store);
}
