import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { BlockNow } from "../../src/ui/panel/views/BlockNow.tsx";
import { ToastProvider } from "../../src/ui/components/feedback.tsx";
import { createDefaultState } from "../../src/shared/defaults.ts";
import { DASHBOARD_TABS, tabFromHash } from "../../src/ui/lib/dashboardTabs.ts";
import type { AppState } from "../../src/shared/types.ts";

function render(
  state: AppState,
  props: { canStart?: boolean; layout?: "panel" | "page" } = {},
): string {
  return renderToStaticMarkup(
    <ToastProvider>
      <BlockNow state={state} {...props} />
    </ToastProvider>,
  );
}

function activeState(): AppState {
  const state = createDefaultState();
  state.blockedSites = ["youtube.com", "reddit.com"];
  state.standalone = {
    ...state.standalone,
    active: true,
    startsAt: Date.now() - 60_000,
    until: Date.now() + 3_600_000,
    sites: ["reddit.com"],
  };
  return state;
}

describe("Block now component", () => {
  it("keeps the sidebar card as a single Set up action with no extra copy", () => {
    const html = render(createDefaultState());
    expect(html).toContain("Timed block with no early stop");
    expect(html).toContain("Set up…");
    expect(html).not.toContain("It never uses your password");
  });

  it("says in the full-screen layout that it never uses the password and what stays locked", () => {
    const html = render(createDefaultState(), { layout: "page" });
    expect(html).toContain("It never uses your password");
    expect(html).toContain("Reset all data");
  });

  it("offers rule sites to add, leaving out ones already blocked, while running", () => {
    const html = render(activeState(), { layout: "page" });
    expect(html).toContain("Add from your rules");
    expect(html).toContain("youtube.com");
    expect(html).toContain("Until it ends");
    // reddit.com is already in the block, so it is not offered again as a button.
    expect(html).not.toMatch(/\+ reddit\.com/);
  });

  it("tells the full-screen page why it cannot start during a focus session", () => {
    const state = createDefaultState();
    expect(render(state, { layout: "page", canStart: false })).toContain(
      "A focus session is running",
    );
    expect(render(state, { layout: "panel", canStart: false })).not.toContain(
      "Block now",
    );
  });
});

describe("dashboard tabs", () => {
  it("puts Block now between Rules and Reports", () => {
    const names = DASHBOARD_TABS.map((tab) => tab.label);
    expect(names.indexOf("Block now")).toBe(names.indexOf("Rules") + 1);
    expect(names.indexOf("Reports")).toBe(names.indexOf("Block now") + 1);
    expect(tabFromHash("#blocknow")).toBe("blocknow");
  });
});
