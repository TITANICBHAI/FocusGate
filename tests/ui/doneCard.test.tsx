import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { DoneCard } from "../../src/shared/celebration.ts";
import { DoneCardView } from "../../src/ui/components/DoneCard.tsx";

const read = (path: string): string => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

const completed: DoneCard = {
  recordId: "s:1",
  endedAt: 1,
  kind: "completed",
  headline: "25 min, done",
  line: "35 min from today’s goal.",
  achievements: [],
  breakTip: null,
  goal: { before: 0, after: 25 / 60, reached: false },
};
const render = (card: DoneCard) => renderToStaticMarkup(<DoneCardView card={card} onDismiss={() => undefined} />);

describe("the done card", () => {
  it("shows the real minutes and one true line", () => {
    const html = render(completed);
    expect(html).toContain("25 min, done");
    expect(html).toContain("35 min from today’s goal.");
  });

  it("can be dismissed with a named button", () => {
    expect(render(completed)).toContain('aria-label="Dismiss"');
  });

  it("shows the goal ring at its final fill, with the percentage said in words", () => {
    const html = render(completed);
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="Daily goal: 42%"');
    expect(html).toContain("fg-goal-ring__value");
    expect(html).toContain("--ring-from");
  });

  it("does not show the Daily goal reached pill, or its dots, before the goal is reached", () => {
    const html = render(completed);
    expect(html).not.toContain("Daily goal reached");
    expect(html).not.toContain("fg-goal-dots");
  });

  it("shows the mint pill with dots when this session reached the goal", () => {
    const html = render({ ...completed, line: "That’s your 60 min goal for today.", goal: { before: 0.6, after: 1, reached: true } });
    expect(html).toContain("Daily goal reached");
    expect(html).toContain("fg-goal-pill");
    expect(html.match(/fg-goal-dots__dot/g)?.length).toBeGreaterThanOrEqual(5);
    expect(html).toMatch(/fg-goal-dots"[^>]*aria-hidden="true"/);
    expect(html).toContain('aria-label="Daily goal: 100%"');
  });

  it("lists achievements unlocked by this session", () => {
    const html = render({ ...completed, achievements: ["Iron Session", "Quiet Win"] });
    expect(html).toContain("Unlocked: Iron Session, Quiet Win");
  });

  it("shows the break tip when there is one, and not otherwise", () => {
    expect(render({ ...completed, breakTip: "Break time: 5 min. Look away from the screen for a bit." })).toContain("Break time: 5 min.");
    expect(render(completed)).not.toContain("Break time");
  });

  it("is plain for a session stopped early: no ring, no pill, no dots, no achievements", () => {
    const html = render({
      recordId: "s:2",
      endedAt: 2,
      kind: "stopped",
      headline: "You focused for 12 minutes.",
      line: "Pick it up whenever you’re ready.",
      achievements: [],
      breakTip: null,
      goal: null,
    });
    expect(html).toContain("You focused for 12 minutes.");
    expect(html).toContain("Pick it up whenever you’re ready.");
    for (const absent of ["fg-goal-ring", "Daily goal", "fg-goal-dots", "Unlocked", "Break time"]) {
      expect(html).not.toContain(absent);
    }
  });

  it("uses no banned word", () => {
    const html = render({ ...completed, goal: { before: 0, after: 1, reached: true } });
    expect(html).not.toMatch(/completely|instantly|cannot|guaranteed/i);
  });
});

describe("the goal moment’s motion", () => {
  const css = read("src/ui/styles.css");
  const motion = css.slice(css.indexOf("/* done card"));

  it("is written in CSS only: a keyframe fill for the ring and a keyframe rise for the dots", () => {
    expect(motion).toContain("@keyframes fg-ring-fill");
    expect(motion).toContain("@keyframes fg-goal-rise");
  });

  it("moves only when the person has not asked for less motion", () => {
    const reduced = motion.indexOf("prefers-reduced-motion: no-preference");
    expect(reduced).toBeGreaterThan(-1);
    const animated = motion.slice(reduced);
    expect(animated).toMatch(/\.fg-goal-ring__value\s*\{[^}]*animation:/);
    expect(animated).toMatch(/\.fg-goal-dots__dot\s*\{[^}]*animation:/);
    const before = motion.slice(0, reduced);
    expect(before).not.toMatch(/animation:\s*fg-/);
  });

  it("keeps the dots invisible unless they are animated, so reduced motion shows none", () => {
    expect(motion).toMatch(/\.fg-goal-dots__dot\s*\{[^}]*opacity:\s*0/);
  });

  it("runs the dots once", () => {
    expect(motion).not.toMatch(/animation:[^;]*infinite/);
  });
});

describe("where the card appears and what rings the chime", () => {
  const focus = read("src/ui/panel/views/FocusScreen.tsx");

  it("is at the top of the Focus tab, ahead of the timer", () => {
    expect(focus).toContain("<DoneCardView");
    expect(focus.indexOf("<DoneCardView")).toBeLessThan(focus.indexOf("<HeroTimer"));
  });

  it("rings the chime only for a finished session, through the setting", () => {
    expect(focus).toContain("playChime(");
    expect(focus).toContain("shouldChime(");
    expect(focus).toContain("state.settings.notifications.chime");
    expect(focus).toMatch(/card\.kind !== "completed"/);
  });

  it("remembers a dismissed card", () => {
    expect(focus).toContain("markDoneDismissed(");
  });
});
