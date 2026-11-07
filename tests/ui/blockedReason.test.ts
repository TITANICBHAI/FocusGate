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

  it("starts every headline with Blocked by, in sentence case", () => {
    expect(reasonTitle({ kind: "session", until } as never)).toBe("Blocked by focus session");
    expect(reasonTitle({ kind: "standalone", until } as never)).toBe("Blocked by Block now");
    expect(reasonTitle({ kind: "always" } as never)).toBe("Blocked by your Always list");
    expect(reasonTitle({ kind: "allowance", resetsAt: until } as never)).toBe("Blocked by daily limit");
    expect(reasonTitle({ kind: "allowOnly" } as never)).toBe("Blocked: not on your allowed list");
    expect(
      reasonTitle({ kind: "keyword", keyword: "news", where: "query" } as never),
    ).toBe("Blocked by keyword “news”");
  });

  it("keeps the end time line", () => {
    expect(reasonMeta({ kind: "session", until } as never)).toBe(`Ends ${clock(until)}`);
  });
});
