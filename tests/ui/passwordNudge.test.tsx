import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createDefaultState } from "../../src/shared/defaults.ts";
import type { AppState } from "../../src/shared/types.ts";
import { PasswordNudge } from "../../src/ui/panel/views/PasswordNudge.tsx";
import {
  PASSWORD_NUDGE_HINT_ID,
  protectedRuleCount,
  wantsPasswordNudge,
} from "../../src/ui/lib/passwordNudge.ts";

function stateWith(configure: (state: AppState) => void = () => undefined): AppState {
  const state = createDefaultState();
  configure(state);
  return state;
}

const withRules = (state: AppState) => {
  state.blockedSites = ["reddit.com"];
  state.alwaysBlockedSites = ["youtube.com"];
};

describe("which rules a password would protect", () => {
  it("counts the Focus list, Always list, keywords, schedules and limits", () => {
    expect(protectedRuleCount(createDefaultState())).toBe(0);
    expect(
      protectedRuleCount(
        stateWith((state) => {
          state.blockedSites = ["a.com", "b.com"];
          state.alwaysBlockedSites = ["c.com"];
          state.keywords = [{ text: "news", mode: "block", when: "always" }];
          state.allowances = {
            "d.com": { mode: "count", maxOpens: 3, duringBlocks: false },
          };
        }),
      ),
    ).toBe(5);
  });
});

describe("when to nudge toward a password", () => {
  it("nudges when rules exist, no password is set and the hint was not hidden", () => {
    expect(wantsPasswordNudge(stateWith(withRules), false)).toBe(true);
  });

  it("stays quiet with no rules, with a password, or once hidden", () => {
    expect(wantsPasswordNudge(createDefaultState(), false)).toBe(false);
    expect(
      wantsPasswordNudge(
        stateWith((state) => {
          withRules(state);
          state.password = { algo: "pbkdf2-sha256", iter: 1_000, salt: "00", hash: "11" };
        }),
        false,
      ),
    ).toBe(false);
    expect(wantsPasswordNudge(stateWith(withRules), true)).toBe(false);
  });

  it("has a stable id to hide it by", () => {
    expect(PASSWORD_NUDGE_HINT_ID).toBe("rules-password");
  });
});

describe("the nudge on screen", () => {
  it("says what is unprotected and offers to set a password, and can be hidden", () => {
    const html = renderToStaticMarkup(<PasswordNudge state={stateWith(withRules)} density="narrow" />);
    expect(html).toContain("No password yet.");
    expect(html).toContain("Anyone using this browser can remove your sites, keywords, schedules and limits.");
    expect(html).toContain("With a password, removing or loosening them asks for it.");
    expect(html).toContain("Set a password");
    expect(html).toContain('aria-label="Hide this hint"');
    expect(html).toContain('role="note"');
  });

  it("renders nothing when there is nothing to protect or a password exists", () => {
    expect(renderToStaticMarkup(<PasswordNudge state={createDefaultState()} density="narrow" />)).toBe("");
    expect(
      renderToStaticMarkup(
        <PasswordNudge
          state={stateWith((state) => {
            withRules(state);
            state.password = { algo: "pbkdf2-sha256", iter: 1_000, salt: "00", hash: "11" };
          })}
          density="wide"
        />,
      ),
    ).toBe("");
  });
});
