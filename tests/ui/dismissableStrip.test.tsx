import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createDefaultState } from "../../src/shared/defaults.ts";
import type { AppState } from "../../src/shared/types.ts";
import { StatusStrip } from "../../src/ui/components/StatusStrip.tsx";
import { AppHeader } from "../../src/ui/components/primitives.tsx";
import { setHintHidden } from "../../src/ui/lib/hiddenHints.ts";
import { describeNow } from "../../src/ui/lib/statusSummary.ts";

const NOW = new Date(2026, 10, 11, 11, 0).getTime();
const read = (path: string): string => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

function working(): AppState {
  const base = createDefaultState();
  return {
    ...base,
    blockedSites: ["example.com"],
    session: {
      ...base.session,
      status: "work",
      sessionId: "s",
      phaseStartedAt: NOW - 60_000,
      phaseEndsAt: NOW + 20 * 60_000,
      phasePlannedMs: 21 * 60_000,
      plannedWorkMs: 21 * 60_000,
      lockLevel: "none",
    },
  };
}

const render = (state: AppState) =>
  renderToStaticMarkup(<StatusStrip summary={describeNow(state, NOW, "en-US")} />);

afterEach(() => {
  setHintHidden("status-idle", false);
});

describe("the idle status card", () => {
  const sitesNoSchedule: AppState = { ...createDefaultState(), blockedSites: ["example.com"] };
  const sundayOnly: AppState = {
    ...sitesNoSchedule,
    schedules: [
      {
        id: "sch",
        name: "Sunday",
        enabled: true,
        days: [0],
        start: "09:00",
        end: "17:00",
        sites: [],
        keywords: [],
        useGlobalLists: true,
      },
    ],
  };

  it("has a button to hide “Nothing is blocking right now.”, named for a screen reader", () => {
    const html = render(sitesNoSchedule);
    expect(html).toContain("Nothing is blocking right now.");
    expect(html).toContain("Start a focus session, or add a schedule to block automatically.");
    expect(html).toContain('aria-label="Hide this message"');
  });

  it("has the button when a schedule exists but is not on", () => {
    const html = render(sundayOnly);
    expect(html).toContain("Nothing is blocking right now.");
    expect(html).toContain('aria-label="Hide this message"');
  });

  it("has the button on “Nothing is blocked yet.” too", () => {
    const html = render(createDefaultState());
    expect(html).toContain("Nothing is blocked yet.");
    expect(html).toContain('aria-label="Hide this message"');
  });

  it("shows nothing at all once it has been hidden", () => {
    setHintHidden("status-idle", true);
    expect(render(createDefaultState())).toBe("");
  });

  it("is not hideable while blocking is on, and stays visible then", () => {
    setHintHidden("status-idle", true);
    const html = render(working());
    expect(html).toContain("Focus session is on.");
    expect(html).not.toContain("Hide this message");
  });

  it("is used in the side panel and the full-screen dashboard alike", () => {
    expect(read("src/ui/panel/PanelPage.tsx")).toContain("<StatusStrip");
    expect(read("src/ui/dashboard/DashboardPage.tsx")).toContain("<StatusStrip");
  });

  it("leaves no empty gap in the panel when it is hidden", () => {
    expect(read("src/ui/styles.css")).toMatch(/\.fg-panel__strip:empty\s*\{\s*display:\s*none/);
  });
});

describe("the panel’s settings button", () => {
  const html = renderToStaticMarkup(<AppHeader pill={{ label: "Not blocking", tone: "idle" }} onOpenSettings={() => undefined} />);

  it("says it opens settings in full screen", () => {
    expect(html).toContain('aria-label="Open settings in full screen"');
    expect(html).not.toContain('aria-label="Open settings"');
  });

  it("draws the box-with-an-arrow icon, not the sliders icon", () => {
    const source = read("src/ui/components/primitives.tsx");
    expect(source).toContain("ExternalLink");
    expect(source).not.toContain("Settings2");
  });
});
