import { describe, expect, it } from "vitest";
import { reasonMeta, reasonTitle } from "../../src/ui/blocked/BlockedPage.tsx";

const clock = (timestamp: number): string =>
  new Date(timestamp)
    .toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    .replace(/[  ]/g, " ");

describe("block page: schedule reason", () => {
  const until = new Date(2026, 10, 3, 17, 0).getTime();
  const reason = { kind: "schedule", name: "Study hours", until } as never;

  it("names the schedule in the headline", () => {
    expect(reasonTitle(reason)).toBe("Blocked by schedule: Study hours");
  });

  it("says when the schedule ends", () => {
    expect(reasonMeta(reason)).toBe(`Ends ${clock(until)}`);
  });

  it("keeps the other reasons as they were", () => {
    expect(reasonTitle({ kind: "session", until } as never)).toBe("Focus session");
    expect(reasonMeta({ kind: "session", until } as never)).toBe(`Ends ${clock(until)}`);
  });
});
