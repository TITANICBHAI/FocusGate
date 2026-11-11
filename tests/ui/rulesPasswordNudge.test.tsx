import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { RulesScreen } from "../../src/ui/panel/views/RulesScreen.tsx";
import { ToastProvider } from "../../src/ui/components/feedback.tsx";
import { createDefaultState } from "../../src/shared/defaults.ts";
import { tabFromHash } from "../../src/ui/lib/dashboardTabs.ts";
import type { AppState } from "../../src/shared/types.ts";

const render = (state: AppState, density: "narrow" | "wide" = "narrow") =>
  renderToStaticMarkup(
    <ToastProvider>
      <RulesScreen state={state} density={density} />
    </ToastProvider>,
  );

describe("Rules screen: nudge toward a password", () => {
  it("shows above the sections when rules exist and no password is set", () => {
    const state = createDefaultState();
    state.alwaysBlockedSites = ["youtube.com"];
    const html = render(state);
    expect(html).toContain("No password yet.");
    expect(html.indexOf("No password yet.")).toBeLessThan(html.indexOf("Rule sections"));
  });

  it("is not there with no rules, or when a password is set", () => {
    expect(render(createDefaultState())).not.toContain("No password yet.");
    const state = createDefaultState();
    state.alwaysBlockedSites = ["youtube.com"];
    state.password = { algo: "pbkdf2-sha256", iter: 1_000, salt: "00", hash: "11" };
    expect(render(state)).not.toContain("No password yet.");
  });
});

describe("dashboard tab from the address", () => {
  it("knows the five tabs, with or without the hash sign", () => {
    for (const tab of ["overview", "rules", "reports", "settings", "data"]) {
      expect(tabFromHash(tab)).toBe(tab);
      expect(tabFromHash(`#${tab}`)).toBe(tab);
    }
  });

  it("ignores anything else", () => {
    expect(tabFromHash("")).toBeNull();
    expect(tabFromHash("#")).toBeNull();
    expect(tabFromHash("#nonsense")).toBeNull();
  });
});
