import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createDefaultState } from "../../src/shared/defaults.ts";
import { ToastProvider } from "../../src/ui/components/feedback.tsx";
import { DashboardSettings } from "../../src/ui/dashboard/DashboardSettings.tsx";
import {
  clearHiddenHints,
  readHiddenHints,
  setHintHidden,
  subscribeHiddenHints,
} from "../../src/ui/lib/hiddenHints.ts";

class FakeStore {
  data = new Map<string, string>();
  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
}

const read = (path: string): string => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

describe("showing hidden messages again", () => {
  it("clears every hidden hint, in the store and for this visit", () => {
    const store = new FakeStore();
    setHintHidden("status-idle", true, store);
    setHintHidden("lock-note", true, store);
    expect(readHiddenHints(store).size).toBe(2);
    expect(clearHiddenHints(store).size).toBe(0);
    expect(readHiddenHints(store).size).toBe(0);
  });

  it("is fine when nothing was hidden, and when the browser will not store", () => {
    expect(clearHiddenHints(new FakeStore()).size).toBe(0);
    const broken = {
      getItem(): string | null {
        throw new Error("blocked");
      },
      setItem(): void {
        throw new Error("blocked");
      },
    };
    setHintHidden("status-idle", true, broken);
    expect(clearHiddenHints(broken).size).toBe(0);
    expect(readHiddenHints(broken).size).toBe(0);
  });

  it("tells every listener on this page when a hint is hidden, shown or cleared", () => {
    const store = new FakeStore();
    let calls = 0;
    const stop = subscribeHiddenHints(() => {
      calls += 1;
    });
    setHintHidden("a", true, store);
    setHintHidden("a", false, store);
    clearHiddenHints(store);
    expect(calls).toBe(3);
    stop();
    setHintHidden("b", true, store);
    expect(calls).toBe(3);
  });

  it("is picked up by every screen that hides a hint, and by other open pages", () => {
    const hook = read("src/ui/hooks/useHiddenHints.ts");
    expect(hook).toContain("subscribeHiddenHints");
    expect(read("src/ui/lib/hiddenHints.ts")).toContain('"storage"');
  });
});

describe("the Settings button", () => {
  const html = renderToStaticMarkup(
    <ToastProvider>
      <DashboardSettings state={createDefaultState()} />
    </ToastProvider>,
  );

  it("is there, with what it does in plain words", () => {
    expect(html).toContain("Hidden messages");
    expect(html).toContain("Show hidden messages");
    expect(html).toContain("Bring back the tips and notes you hid with an X or Not now.");
  });
});
