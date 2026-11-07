import { describe, expect, it, vi } from "vitest";
import { adaptEvent } from "../../src/background/chrome.ts";

type Alarm = { name: string; scheduledTime: number };
function fakeEvent() {
  const listeners = new Set<(a: Alarm) => void>();
  return {
    addListener: (fn: (a: Alarm) => void) => listeners.add(fn),
    removeListener: (fn: (a: Alarm) => void) => listeners.delete(fn),
    fire: (a: Alarm) => listeners.forEach((fn) => fn(a)),
    size: () => listeners.size,
  };
}
describe("adaptEvent", () => {
  it("hands the listener the projected value, not the raw object", () => {
    const source = fakeEvent();
    const listener = vi.fn();
    adaptEvent(source, (alarm) => alarm.name).addListener(listener);
    source.fire({ name: "tick", scheduledTime: 1 });
    expect(listener).toHaveBeenCalledWith("tick");
  });
  it("removeListener detaches the exact wrapper it attached", () => {
    const source = fakeEvent();
    const listener = vi.fn();
    const adapted = adaptEvent(source, (alarm) => alarm.name);
    adapted.addListener(listener);
    adapted.removeListener(listener);
    expect(source.size()).toBe(0);
  });
});
