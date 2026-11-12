import { beforeEach, describe, expect, it } from "vitest";
import { CHIME_FRESH_MS, shouldChime } from "../../src/shared/celebration.ts";
import {
  CHIME_NOTES,
  CHIME_PEAK_GAIN,
  playChime,
  type ChimeContext,
} from "../../src/ui/lib/chime.ts";
import {
  markDoneChimed,
  markDoneDismissed,
  readDoneSeen,
  resetDoneSeenMemory,
} from "../../src/ui/lib/doneSeen.ts";

class FakeStore {
  data = new Map<string, string>();
  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
}

describe("which done cards ring the chime", () => {
  const base = { enabled: true, recordId: "s:1", endedAt: 1_000_000, now: 1_005_000, chimedId: undefined };

  it("rings for a fresh card when the setting is on", () => {
    expect(shouldChime(base)).toBe(true);
  });

  it("stays quiet when the setting is off", () => {
    expect(shouldChime({ ...base, enabled: false })).toBe(false);
  });

  it("rings once per session: not again for the one it already rang for", () => {
    expect(shouldChime({ ...base, chimedId: "s:1" })).toBe(false);
    expect(shouldChime({ ...base, chimedId: "s:0" })).toBe(true);
  });

  it("stays quiet for a card found long after the session ended", () => {
    expect(shouldChime({ ...base, now: base.endedAt + CHIME_FRESH_MS + 1 })).toBe(false);
    expect(shouldChime({ ...base, now: base.endedAt + CHIME_FRESH_MS })).toBe(true);
  });
});

describe("remembering what the done card has already done", () => {
  beforeEach(() => resetDoneSeenMemory());

  it("starts with nothing chimed and nothing dismissed", () => {
    expect(readDoneSeen(new FakeStore())).toEqual({});
  });

  it("keeps the chimed and the dismissed session, one of each", () => {
    const store = new FakeStore();
    markDoneChimed("s:1", store);
    markDoneDismissed("s:1", store);
    expect(readDoneSeen(store)).toEqual({ chimed: "s:1", dismissed: "s:1" });
    markDoneChimed("s:2", store);
    expect(readDoneSeen(store)).toEqual({ chimed: "s:2", dismissed: "s:1" });
  });

  it("starts again from nothing when the stored value is damaged", () => {
    const store = new FakeStore();
    store.setItem("focusgate.done-card", "{not json");
    expect(readDoneSeen(store)).toEqual({});
    store.setItem("focusgate.done-card", JSON.stringify({ chimed: 5, dismissed: ["x"] }));
    expect(readDoneSeen(store)).toEqual({});
  });

  it("still remembers for this visit when the browser will not store anything", () => {
    const broken = {
      getItem(): string | null {
        throw new Error("blocked");
      },
      setItem(): void {
        throw new Error("blocked");
      },
    };
    markDoneChimed("s:9", broken);
    expect(readDoneSeen(broken)).toEqual({ chimed: "s:9" });
  });
});

interface Call {
  type: string;
  value: unknown;
}

function fakeAudio(options: { state?: string; throwOnCreate?: boolean } = {}) {
  const log: Call[] = [];
  const oscillators: Array<{ type: string; freq: number; start: number; stop: number }> = [];
  const peaks: number[] = [];
  const ctx: ChimeContext = {
    currentTime: 10,
    destination: { id: "out" },
    state: options.state ?? "running",
    createOscillator() {
      const osc = {
        type: "square",
        frequency: { value: 0 },
        connect: () => undefined,
        start(at: number) {
          oscillators.push({ type: osc.type, freq: osc.frequency.value, start: at, stop: -1 });
        },
        stop(at: number) {
          const last = oscillators[oscillators.length - 1];
          if (last) last.stop = at;
        },
      };
      return osc;
    },
    createGain() {
      return {
        connect: () => undefined,
        gain: {
          setValueAtTime: () => undefined,
          linearRampToValueAtTime(value: number) {
            peaks.push(value);
          },
          exponentialRampToValueAtTime: () => undefined,
        },
      };
    },
    async resume() {
      log.push({ type: "resume", value: true });
    },
    async close() {
      log.push({ type: "close", value: true });
    },
  };
  return {
    log,
    oscillators,
    peaks,
    factory: () => {
      if (options.throwOnCreate) throw new Error("no audio");
      return ctx;
    },
  };
}

/** A clock the test winds by hand: the chime asks it to close the context later. */
function handClock() {
  const pending: Array<{ run: () => void; ms: number }> = [];
  return {
    later: (run: () => void, ms: number) => {
      pending.push({ run, ms });
    },
    pending,
    wind(ms: number) {
      for (const item of pending.splice(0)) if (item.ms <= ms) item.run();
    },
  };
}

describe("the chime", () => {
  it("is a rising run of soft sine notes", () => {
    const audio = fakeAudio();
    expect(playChime(audio.factory)).toBe(true);
    expect(audio.oscillators).toHaveLength(CHIME_NOTES.length);
    expect(CHIME_NOTES.length).toBeGreaterThanOrEqual(3);
    const freqs = audio.oscillators.map((note) => note.freq);
    expect([...freqs].sort((a, b) => a - b)).toEqual(freqs);
    expect(audio.oscillators.every((note) => note.type === "sine")).toBe(true);
  });

  it("is quiet: no note peaks above a gentle level", () => {
    const audio = fakeAudio();
    playChime(audio.factory);
    expect(CHIME_PEAK_GAIN).toBeLessThanOrEqual(0.08);
    expect(audio.peaks.length).toBe(CHIME_NOTES.length);
    expect(audio.peaks.every((peak) => peak > 0 && peak <= CHIME_PEAK_GAIN)).toBe(true);
  });

  it("is over in about a second and a half, and closes the audio context afterwards", () => {
    const audio = fakeAudio();
    const clock = handClock();
    playChime(audio.factory, clock.later);
    const lastStop = Math.max(...audio.oscillators.map((note) => note.stop));
    expect(lastStop - 10).toBeLessThanOrEqual(1.6);
    expect(audio.log.some((call) => call.type === "close")).toBe(false);
    expect(clock.pending).toHaveLength(1);
    expect(clock.pending[0]?.ms).toBeGreaterThanOrEqual((lastStop - 10) * 1000);
    clock.wind(2_500);
    expect(audio.log.some((call) => call.type === "close")).toBe(true);
  });

  it("asks a suspended context to resume, as a browser may start it paused", () => {
    const audio = fakeAudio({ state: "suspended" });
    playChime(audio.factory);
    expect(audio.log.some((call) => call.type === "resume")).toBe(true);
  });

  it("does nothing and does not throw when the browser has no audio", () => {
    expect(playChime(fakeAudio({ throwOnCreate: true }).factory)).toBe(false);
  });
});
