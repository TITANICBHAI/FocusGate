import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { shouldSweep } from "../../src/ui/components/StatusStrip.tsx";

const css = readFileSync(new URL("../../src/ui/styles.css", import.meta.url), "utf8");

describe("shouldSweep: when the gate closes", () => {
  it("sweeps when blocking starts after idle or a break", () => {
    expect(shouldSweep("idle", "focus")).toBe(true);
    expect(shouldSweep("idle", "locked")).toBe(true);
    expect(shouldSweep("idle", "schedule")).toBe(true);
    expect(shouldSweep("break", "focus")).toBe(true);
  });

  it("sweeps when a standing rule starts blocking, and not when it joins a session", () => {
    expect(shouldSweep("idle", "standing")).toBe(true);
    expect(shouldSweep("break", "standing")).toBe(true);
    expect(shouldSweep("standing", "focus")).toBe(false);
    expect(shouldSweep("standing", "locked")).toBe(false);
    expect(shouldSweep("standing", "idle")).toBe(false);
    expect(shouldSweep("standing", "standing")).toBe(false);
  });

  it("does not sweep on first render, or when nothing starts", () => {
    expect(shouldSweep(undefined, "focus")).toBe(false);
    expect(shouldSweep("idle", "idle")).toBe(false);
    expect(shouldSweep("focus", "focus")).toBe(false);
    expect(shouldSweep("focus", "locked")).toBe(false);
    expect(shouldSweep("focus", "idle")).toBe(false);
    expect(shouldSweep("idle", "break")).toBe(false);
  });
});

describe("the one animation", () => {
  it("is a 280ms sweep, inside the no-preference media query", () => {
    expect(css).toContain("@keyframes fg-gate-close");
    const media = css.indexOf("@media (prefers-reduced-motion: no-preference)");
    expect(media).toBeGreaterThan(-1);
    const block = css.slice(media, css.indexOf("\n}\n", media));
    expect(block).toContain("fg-gate-close 280ms");
  });

  it("is the only keyframe that moves something into place", () => {
    // Sheets, toasts and scrims are overlays; sections must not slide or fade in.
    expect(css).not.toMatch(/\.fg-(view|section|stack|panel__main)[^{]*\{[^}]*animation:/);
  });
});
