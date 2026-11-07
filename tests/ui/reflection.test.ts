import { describe, expect, it } from "vitest";
import { applyReflection } from "../../src/ui/panel/views/YouScreen.tsx";

const KEY = "2026-11-05";

describe("applyReflection", () => {
  it("creates today's entry with the mood and note", () => {
    const next = applyReflection({}, KEY, { mood: 4, note: "Good day" });
    expect(next[KEY]).toMatchObject({ dateKey: KEY, mood: 4, note: "Good day", focusMs: 0 });
  });

  it("keeps other days and today's stats when it changes the mood", () => {
    const latest = {
      "2026-11-04": { dateKey: "2026-11-04", focusMs: 1, sessionsCompleted: 0, sessionsAbandoned: 0, blocks: 0, blocksByDomain: {}, tasksCompleted: 0 },
      [KEY]: { dateKey: KEY, focusMs: 5, sessionsCompleted: 1, sessionsAbandoned: 0, blocks: 2, blocksByDomain: {}, tasksCompleted: 0, note: "keep" },
    };
    const next = applyReflection(latest, KEY, { mood: 2 });
    expect(next["2026-11-04"]).toEqual(latest["2026-11-04"]);
    expect(next[KEY]).toMatchObject({ focusMs: 5, blocks: 2, mood: 2, note: "keep" });
  });

  it("drops an empty note", () => {
    const next = applyReflection({}, KEY, { note: "" });
    expect(next[KEY]?.note).toBeUndefined();
  });

  it("clears the mood and note when 'Clear today's reflection' sends null for both", () => {
    const latest = applyReflection({}, KEY, { mood: 3, note: "x" });
    const next = applyReflection(latest, KEY, { mood: null, note: null });
    expect(next[KEY]?.mood).toBeUndefined();
    expect(next[KEY]?.note).toBeUndefined();
  });
});
