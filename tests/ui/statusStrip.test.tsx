import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { StatusStrip, pillFor } from "../../src/ui/components/StatusStrip.tsx";
import { AppHeader } from "../../src/ui/components/primitives.tsx";
import { describeNow } from "../../src/ui/lib/statusSummary.ts";
import { createDefaultState } from "../../src/shared/defaults.ts";
import type { AppState } from "../../src/shared/types.ts";

const L = "en-US";
const NOW = new Date(2026, 10, 3, 11, 0).getTime();
const at = (hour: number, minute = 0) => new Date(2026, 10, 3, hour, minute).getTime();

function stateWith(overrides: Partial<AppState> = {}): AppState {
  return { ...createDefaultState(), ...overrides };
}

function working(lockLevel: "none" | "strict" | "commitment"): AppState["session"] {
  return {
    ...createDefaultState().session,
    status: "work",
    sessionId: "s",
    phaseStartedAt: NOW - 60_000,
    phaseEndsAt: at(12, 48),
    phasePlannedMs: at(12, 48) - NOW,
    plannedWorkMs: at(12, 48) - NOW,
    lockLevel,
  };
}

const render = (state: AppState) =>
  renderToStaticMarkup(<StatusStrip summary={describeNow(state, NOW, L)} />);

describe("StatusStrip", () => {
  it("is a live status region with the headline and detail", () => {
    const html = render(stateWith({ blockedSites: ["example.com"], session: working("none") }));
    expect(html).toContain('role="status"');
    expect(html).toContain("Focus session is on.");
    expect(html).toContain("Ends 12:48 PM. Blocking 1 site. You can edit rules and stop any time.");
    expect(html).toContain("fg-nowline--focus");
  });

  it("marks each tone", () => {
    expect(render(stateWith())).toContain("fg-nowline--idle");
    expect(render(stateWith({ blockedSites: ["example.com"], session: working("strict") }))).toContain(
      "fg-nowline--locked",
    );
    expect(
      render(
        stateWith({
          session: { ...working("none"), status: "shortBreak", phaseEndsAt: at(12, 53) },
        }),
      ),
    ).toContain("fg-nowline--break");
  });

  it("shows a quiet call to action, never a primary button", () => {
    const html = render(stateWith());
    expect(html).toContain("Add sites");
    expect(html).not.toContain("fg-btn--primary");
  });

  it("lists extra lines such as a reached daily limit", () => {
    const state = stateWith({
      allowances: { "example.com": { mode: "time_budget", limitMin: 1, duringBlocks: false } },
      usage: {
        "example.com": {
          dateKey: "2026-11-03",
          usedMs: 60_000,
          opens: 0,
          windowStartMs: 0,
          lastActiveAt: NOW,
        },
      },
    });
    expect(render(state)).toContain("example.com reached its daily limit.");
  });
});

describe("header pill", () => {
  const pill = (state: AppState) => pillFor(describeNow(state, NOW, L), state, NOW);

  it("labels each state in words", () => {
    expect(pill(stateWith())).toEqual({ label: "Not blocking", tone: "idle" });
    expect(pill(stateWith({ blockedSites: ["example.com"], session: working("none") }))).toEqual({
      label: "Blocking",
      tone: "focus",
    });
    expect(pill(stateWith({ blockedSites: ["example.com"], session: working("strict") }))).toEqual({
      label: "Blocking",
      tone: "locked",
    });
    expect(
      pill(stateWith({ session: { ...working("none"), status: "shortBreak", phaseEndsAt: at(12, 53) } })),
    ).toEqual({ label: "Break", tone: "break" });
  });

  it("says Blocking while only the Always list is blocking", () => {
    expect(pill(stateWith({ alwaysBlockedSites: ["example.com"] }))).toEqual({
      label: "Blocking",
      tone: "idle",
    });
  });

  it("renders as visible text in the header, with a lock mark only when locked", () => {
    const html = renderToStaticMarkup(
      <AppHeader pill={{ label: "Blocking", tone: "locked" }} onOpenSettings={() => undefined} />,
    );
    expect(html).toContain(">Blocking<");
    expect(html).toContain("fg-pill__lock");
    expect(html).not.toContain("fg-status-dot");

    const idle = renderToStaticMarkup(
      <AppHeader pill={{ label: "Not blocking", tone: "idle" }} onOpenSettings={() => undefined} />,
    );
    expect(idle).toContain(">Not blocking<");
    expect(idle).not.toContain("fg-pill__lock");
  });
});
