import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ScheduleSheet, TargetHelp } from "../../src/ui/panel/views/ScheduleSection.tsx";
import { ToastProvider } from "../../src/ui/components/feedback.tsx";
import { createDefaultState } from "../../src/shared/defaults.ts";
import { TARGET_CHOICES, emptyDraft } from "../../src/ui/lib/scheduleForm.ts";

function renderSheet(): string {
  return renderToStaticMarkup(
    <ToastProvider>
      <ScheduleSheet
        state={{ ...createDefaultState(), blockedSites: ["youtube.com", "reddit.com"] }}
        editingId={null}
        initial={emptyDraft()}
        lockedReason={null}
        onClose={() => undefined}
      />
    </ToastProvider>,
  );
}

describe("schedule form: days", () => {
  const html = renderSheet();

  it("has no weekday, weekend or every-day shortcut buttons", () => {
    for (const label of ["Weekdays", "Weekends", "Every day"]) {
      expect(html).not.toContain(`>${label}<`);
    }
  });

  it("keeps one toggle per day, Monday first, with its pressed state", () => {
    const labels = [...html.matchAll(/aria-pressed="(true|false)"[^>]*>(Mon|Tue|Wed|Thu|Fri|Sat|Sun)</g)];
    expect(labels.map((match) => match[2])).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
    expect(labels.map((match) => match[1])).toEqual([
      "true",
      "true",
      "true",
      "true",
      "true",
      "false",
      "false",
    ]);
  });

  it("still says in words which days are chosen", () => {
    expect(html).toContain("Weekdays · 9:00 AM – 5:00 PM");
  });
});

describe("schedule form: what should it block", () => {
  const html = renderSheet();

  it("names the group and offers an info button that starts closed", () => {
    expect(html).toContain('id="schedule-target-label"');
    expect(html).toContain('aria-labelledby="schedule-target-label"');
    expect(html).toContain('aria-label="What do these choices mean?"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain('role="note"');
  });

  it("keeps the three choices and the Focus list size", () => {
    expect(html).toContain("My Focus list");
    expect(html).toContain("Only these sites");
    expect(html).toContain("My Focus list and these sites");
    expect(html).toContain("(2 sites)");
  });

  it("explains every choice in plain words, including where the Focus list lives", () => {
    const help = renderToStaticMarkup(<TargetHelp />);
    for (const choice of TARGET_CHOICES) {
      expect(help).toContain(choice.label);
      expect(help).toContain(choice.help);
    }
    expect(help).toContain("Rules, then Sites");
    expect(help).toContain("not used");
  });
});
