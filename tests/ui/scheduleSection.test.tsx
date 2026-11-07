import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ScheduleSection } from "../../src/ui/panel/views/ScheduleSection.tsx";
import { ToastProvider } from "../../src/ui/components/feedback.tsx";
import { createDefaultState } from "../../src/shared/defaults.ts";
import type { AppState, Schedule } from "../../src/shared/types.ts";

function render(state: AppState, lockedReason: string | null = null): string {
  return renderToStaticMarkup(
    <ToastProvider>
      <ScheduleSection state={state} lockedReason={lockedReason} />
    </ToastProvider>,
  );
}

function schedule(overrides: Partial<Schedule> = {}): Schedule {
  return {
    id: "s1",
    name: "Study hours",
    enabled: true,
    days: [1, 2, 3, 4, 5],
    start: "09:00",
    end: "17:00",
    sites: [],
    keywords: [],
    useGlobalLists: true,
    ...overrides,
  };
}

function withSchedules(schedules: Schedule[], blockedSites: string[] = []): AppState {
  return { ...createDefaultState(), schedules, blockedSites };
}

describe("ScheduleSection with no schedules", () => {
  const html = render(withSchedules([]));

  it("describes what schedules do", () => {
    expect(html).toContain(
      "Block sites on a weekly timetable. Schedules start and stop on their own, so you don&#x27;t need to start a session.",
    );
  });

  it("offers templates instead of an empty list", () => {
    expect(html).toContain("Block sites on a timetable");
    for (const name of ["Work hours", "Study", "Sleep", "Start from scratch"]) {
      expect(html).toContain(name);
    }
    expect(html).not.toContain("fg-strip");
  });
});

describe("ScheduleSection with schedules", () => {
  const html = render(withSchedules([schedule()], ["youtube.com", "reddit.com"]));

  it("shows a status line and the week strip", () => {
    expect(/On now: Study hours|Next: Study hours/.test(html)).toBe(true);
    expect(html).toContain("fg-strip");
  });

  it("describes each schedule in plain words", () => {
    expect(html).toContain("Weekdays");
    expect(html).toContain("9:00 AM – 5:00 PM");
    expect(html).toContain("Blocks your Focus list (2 sites)");
  });

  it("uses a switch without visible label text, and an Edit button", () => {
    expect(html).toContain('role="switch"');
    expect(html).toContain('aria-label="Enable Study hours"');
    expect(html).not.toContain(">Enable Study hours<");
    expect(html).toContain('aria-label="Edit Study hours"');
    expect(html).not.toContain("Delete schedule Study hours");
  });

  it("does not warn when there is something to block", () => {
    expect(html).not.toContain("This schedule blocks nothing yet.");
  });
});

describe("ScheduleSection warnings", () => {
  it("warns when a schedule blocks nothing and offers a fix", () => {
    const html = render(withSchedules([schedule()], []));
    expect(html).toContain("This schedule blocks nothing yet.");
    expect(html).toContain(">Fix<");
    expect(html).toContain("Blocks nothing yet. Your Focus list is empty.");
  });

  it("disables turning off a running schedule while locked", () => {
    const html = render(withSchedules([schedule()], ["a.com"]), "Locked until 5:00 PM by your strict session.");
    expect(html).toMatch(/role="switch"[^>]*disabled/);
  });
});
