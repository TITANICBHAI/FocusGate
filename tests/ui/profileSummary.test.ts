import { describe, expect, it } from "vitest";
import { createDefaultState } from "../../src/shared/defaults.ts";
import {
  badgeInitial,
  protectionRows,
  rowAccessibleName,
} from "../../src/ui/lib/profileSummary.ts";

const NOW = new Date(2026, 10, 4, 10, 0).getTime(); // Wed 4 Nov 2026, local

describe("badgeInitial", () => {
  it("uses the first letter, upper-cased", () => {
    expect(badgeInitial("asha")).toBe("A");
    expect(badgeInitial("  élan ")).toBe("É");
  });
  it("is null when there is no name", () => {
    expect(badgeInitial("")).toBeNull();
    expect(badgeInitial("   ")).toBeNull();
  });
  it("keeps a whole character, not half of a pair", () => {
    expect(badgeInitial("𝒜b")).toBe("𝒜");
  });
});

describe("protectionRows", () => {
  it("lists the rows in the pinned order and names", () => {
    const rows = protectionRows(createDefaultState(), NOW);
    expect(rows.map((row) => row.label)).toEqual([
      "Focus list",
      "Always list",
      "Keywords",
      "Schedules",
      "Daily limits",
      "Password",
    ]);
  });

  it("shows None for empty lists and Not set for no password", () => {
    const rows = protectionRows(createDefaultState(), NOW);
    const byLabel = Object.fromEntries(rows.map((row) => [row.label, row.value]));
    expect(byLabel["Focus list"]).toBe("None");
    expect(byLabel["Always list"]).toBe("None");
    expect(byLabel["Keywords"]).toBe("None");
    expect(byLabel["Daily limits"]).toBe("None");
    expect(byLabel["Schedules"]).toBe("No schedules yet.");
    expect(byLabel["Password"]).toBe("Not set");
  });

  it("counts sites with the right plural", () => {
    const state = createDefaultState();
    state.blockedSites = ["a.com"];
    state.alwaysBlockedSites = ["b.com", "c.com"];
    const byLabel = Object.fromEntries(
      protectionRows(state, NOW).map((row) => [row.label, row.value]),
    );
    expect(byLabel["Focus list"]).toBe("1 site");
    expect(byLabel["Always list"]).toBe("2 sites");
  });

  it("shows Set when a password exists", () => {
    const state = createDefaultState();
    state.password = { algo: "pbkdf2-sha256", iter: 1, salt: "s", hash: "h" };
    const row = protectionRows(state, NOW).find((item) => item.label === "Password");
    expect(row?.value).toBe("Set");
  });

  it("points each rule row at its Rules section; Password has none", () => {
    const sections = Object.fromEntries(
      protectionRows(createDefaultState(), NOW).map((row) => [row.label, row.section]),
    );
    expect(sections).toEqual({
      "Focus list": "sites",
      "Always list": "sites",
      Keywords: "keywords",
      Schedules: "schedule",
      "Daily limits": "limits",
      Password: null,
    });
  });

  it("builds an accessible name that includes the value", () => {
    const state = createDefaultState();
    state.blockedSites = ["a.com", "b.com"];
    const row = protectionRows(state, NOW)[0]!;
    expect(rowAccessibleName(row)).toBe("Focus list, 2 sites. Open in Rules.");
    const password = protectionRows(state, NOW).find((item) => item.label === "Password")!;
    expect(rowAccessibleName(password)).toBe("Password, Not set.");
  });
});
