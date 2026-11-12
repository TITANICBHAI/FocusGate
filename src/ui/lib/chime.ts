/**
 * The soft chime for the end of a session: three sine notes, rising, each
 * fading out. It is made with Web Audio, so there is no sound file to ship.
 * It can only play where a page is open (a background worker has no audio),
 * and a browser may keep audio paused until the person has touched the page.
 */

/** Frequencies in hertz and when each note starts, in seconds. C, E, G above middle C. */
export const CHIME_NOTES: ReadonlyArray<{ freq: number; at: number }> = [
  { freq: 523.25, at: 0 },
  { freq: 659.25, at: 0.16 },
  { freq: 783.99, at: 0.32 },
];

/** The loudest a note gets. Web Audio gain 1 is full scale; this is well under it. */
export const CHIME_PEAK_GAIN = 0.05;

const ATTACK_SECONDS = 0.03;
const NOTE_SECONDS = 0.9;

interface ChimeParam {
  setValueAtTime(value: number, at: number): unknown;
  linearRampToValueAtTime(value: number, at: number): unknown;
  exponentialRampToValueAtTime(value: number, at: number): unknown;
}

interface ChimeOscillator {
  type: string;
  frequency: { value: number };
  connect(destination: unknown): unknown;
  start(at: number): void;
  stop(at: number): void;
}

interface ChimeGain {
  gain: ChimeParam;
  connect(destination: unknown): unknown;
}

/** The part of an AudioContext the chime uses. */
export interface ChimeContext {
  currentTime: number;
  destination: unknown;
  state?: string;
  createOscillator(): ChimeOscillator;
  createGain(): ChimeGain;
  resume(): Promise<void>;
  close(): Promise<void>;
}

function browserContext(): ChimeContext {
  return new AudioContext() as unknown as ChimeContext;
}

/** Plays the chime once. Returns false, quietly, when audio is not available. */
export function playChime(
  create: () => ChimeContext = browserContext,
  later: (run: () => void, ms: number) => unknown = (run, ms) => setTimeout(run, ms),
): boolean {
  let context: ChimeContext | undefined;
  try {
    context = create();
    const start = context.currentTime;
    if (context.state === "suspended") void context.resume().catch(() => undefined);
    for (const note of CHIME_NOTES) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const at = start + note.at;
      oscillator.type = "sine";
      oscillator.frequency.value = note.freq;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.linearRampToValueAtTime(CHIME_PEAK_GAIN, at + ATTACK_SECONDS);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + NOTE_SECONDS);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(at);
      oscillator.stop(at + NOTE_SECONDS + 0.05);
    }
    const last = CHIME_NOTES[CHIME_NOTES.length - 1]?.at ?? 0;
    const open = context;
    later(() => void open.close().catch(() => undefined), (last + NOTE_SECONDS + 0.3) * 1000);
    return true;
  } catch {
    void context?.close().catch(() => undefined);
    return false;
  }
}
