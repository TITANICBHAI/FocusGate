import { describe, expect, it } from "vitest";
import { buildDnrRules } from "../../src/shared/dnr.ts";
import type { BlockPlan } from "../../src/shared/plan.ts";

const basePlan = (overrides: Partial<BlockPlan> = {}): BlockPlan => ({
  blocked: new Map([["example.com", { kind: "session", until: 10_000 }]]),
  allowOnly: null,
  keywords: [],
  hideWords: [],
  exceptions: [],
  nextBoundaryAt: 10_000,
  ...overrides,
});

describe("DNR rule builder", () => {
  it("builds one stable redirect rule with the original URL in its fragment", () => {
    const { rules } = buildDnrRules(basePlan(), "chrome-extension://id/blocked.html");
    expect(rules).toHaveLength(1);
    expect(rules[0]).toMatchObject({
      id: 1,
      priority: 1,
      action: {
        type: "redirect",
        redirect: {
          regexSubstitution: "chrome-extension://id/blocked.html#\\1",
        },
      },
      condition: {
        requestDomains: ["example.com"],
        regexFilter: "^(https?://.+)$",
        resourceTypes: ["main_frame"],
      },
    });
  });

  it("adds an allow-only redirect only when its allowlist is non-empty", () => {
    expect(buildDnrRules(basePlan({ allowOnly: [] }), "blocked").rules).toHaveLength(1);
    expect(
      buildDnrRules(
        basePlan({ allowOnly: ["allowed.example"] }),
        "blocked",
      ).rules[1],
    ).toMatchObject({
      id: 2,
      condition: { excludedRequestDomains: ["allowed.example"] },
    });
  });

  it("uses escaped exception rules with stable IDs and higher priority", () => {
    const { rules } = buildDnrRules(
      basePlan({ exceptions: ["example.com/a+b?q=x.y"] }),
      "blocked",
    );
    expect(rules[1]).toMatchObject({
      id: 100,
      priority: 2,
      action: { type: "allow" },
      condition: {
        regexFilter: "^https?://(www\\.)?example\\.com/a\\+b\\?q=x\\.y([/?&#]|$)",
      },
    });
  });

  it("normalizes IDN exceptions, skips invalid entries, and caps rules at 200", () => {
    const exceptions = [
      "https://www.BÜCHER.example/ü/",
      "not a valid host",
      ...Array.from({ length: 200 }, (_, index) => `site${index}.example`),
    ];
    const { rules, skipped } = buildDnrRules(
      basePlan({
        blocked: new Map([["xn--bcher-kva.example", { kind: "always" }]]),
        exceptions,
      }),
      "blocked",
    );
    expect(rules.filter((rule) => rule.id >= 100)).toHaveLength(199);
    expect(rules.find((rule) => rule.id === 100)?.condition.regexFilter).toBe(
      "^https?://(www\\.)?xn--bcher-kva\\.example/%C3%BC([/?&#]|$)",
    );
    expect(skipped).toContainEqual({
      entry: "not a valid host",
      reason: "invalid-entry",
    });
    expect(skipped).toContainEqual({
      entry: "site199.example",
      reason: "rule-limit",
    });
  });
});
