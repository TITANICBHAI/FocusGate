import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createDefaultState } from "../../src/shared/defaults.ts";
import type { AppState } from "../../src/shared/types.ts";
import { ToastProvider } from "../../src/ui/components/feedback.tsx";
import { PasswordReveal } from "../../src/ui/components/PasswordPicker.tsx";
import { setHintHidden } from "../../src/ui/lib/hiddenHints.ts";
import { SETUP_OFFER_HINT_ID, markSetupHandled } from "../../src/ui/lib/setupOffer.ts";
import { SetupDone } from "../../src/ui/onboarding/SetupDone.tsx";
import { FocusPanel } from "../../src/ui/panel/PanelPage.tsx";
import { SetupOfferCard } from "../../src/ui/panel/views/SetupOffer.tsx";
import { YouScreen } from "../../src/ui/panel/views/YouScreen.tsx";

const OPEN = "Open full-screen setup";
const GENERATED = "kT7mXp2RhN4cWv9QbJ6sY3dFg";

function renderPanel(state: AppState): string {
  return renderToStaticMarkup(
    <ToastProvider>
      <FocusPanel state={state} onOpenRules={() => undefined} onOpenTasks={() => undefined} />
    </ToastProvider>,
  );
}

describe("the setup offer card", () => {
  const card = (failed = false) =>
    renderToStaticMarkup(
      <SetupOfferCard onOpen={() => undefined} onDismiss={() => undefined} failed={failed} />,
    );

  it("asks to set up in full screen, says why, and offers a way out", () => {
    const html = card();
    expect(html).toContain("Set up FocusGate in full screen");
    expect(html).toContain("It takes about a minute.");
    expect(html).toContain(OPEN);
    expect(html).toContain("Not now");
    expect(html).toContain("You can run setup later from the You tab.");
  });

  it("is not a second primary button: Start stays the one on the Focus screen", () => {
    expect(card()).not.toContain("fg-btn--primary");
  });

  it("says when the setup page could not be opened, and only then", () => {
    expect(card()).not.toContain("could not be opened");
    expect(card(true)).toMatch(/role="status"[^>]*>Setup could not be opened\. Try again\./);
  });
});

/** What was dealt with is kept for the visit, so each test starts from "not dealt with". */
function forgetHandled(): void {
  setHintHidden(SETUP_OFFER_HINT_ID, false, null);
}

describe("the Focus tab in the panel", () => {
  it("offers setup first, above the Focus screen, to someone with nothing set up", () => {
    forgetHandled();
    const html = renderPanel(createDefaultState());
    expect(html).toContain(OPEN);
    expect(html.indexOf(OPEN)).toBeLessThan(html.indexOf("Session lock"));
  });

  it("does not offer it to someone who already has rules", () => {
    forgetHandled();
    const state = createDefaultState();
    state.blockedSites = ["reddit.com"];
    expect(renderPanel(state)).not.toContain(OPEN);
  });

  it("does not offer it again once it was dealt with", () => {
    forgetHandled();
    markSetupHandled(null);
    try {
      expect(renderPanel(createDefaultState())).not.toContain(OPEN);
    } finally {
      forgetHandled();
    }
    expect(renderPanel(createDefaultState())).toContain(OPEN);
  });
});

describe("the You tab", () => {
  it("keeps a Run setup row, so Not now is never a dead end", () => {
    const html = renderToStaticMarkup(
      <ToastProvider>
        <YouScreen state={createDefaultState()} onOpenRules={() => undefined} />
      </ToastProvider>,
    );
    expect(html).toContain("Run setup");
    expect(html).toContain("Pick sites to block, set a password and check browser access");
    expect(html).toContain("Open full dashboard");
  });
});

describe("the last screen of setup", () => {
  const done = (props: Partial<Parameters<typeof SetupDone>[0]> = {}) =>
    renderToStaticMarkup(
      <SetupDone
        siteCount={5}
        dailyGoalMin={60}
        generatedPassword={null}
        message=""
        onOpenPanel={() => undefined}
        {...props}
      />,
    );

  it("says what was saved", () => {
    const html = done();
    expect(html).toContain("Your setup is saved");
    expect(html).toContain("5 sites were added to your Focus list.");
    expect(html).toContain("Your daily goal is 60 minutes.");
    expect(html).toContain("Open FocusGate in the side panel");
  });

  it("says one site, not 1 sites", () => {
    expect(done({ siteCount: 1 })).toContain("1 site was added to your Focus list.");
    expect(done({ siteCount: 1 })).not.toContain("1 sites");
  });

  it("shows no password when none was generated", () => {
    expect(done()).not.toContain("Your password");
  });

  it("shows a generated password once more, so it can still be written down", () => {
    const html = done({ generatedPassword: GENERATED });
    expect(html).toContain("Your password");
    expect(html).toContain(GENERATED);
    expect(html).toContain("scrambled copy");
  });

  it("shows a message from opening the panel", () => {
    expect(done({ message: "Setup is saved." })).toMatch(/role="status"[^>]*>Setup is saved\./);
  });

  it("is what the setup page shows at its last step, and it marks setup as dealt with", () => {
    const source = readFileSync("src/ui/onboarding/OnboardingPage.tsx", "utf8");
    expect(source).toContain("<SetupDone");
    expect(source).toContain("wantsPassword && passwordDraft.generated");
    expect(source.indexOf("setStep(4)")).toBeLessThan(source.indexOf("markSetupHandled()"));
  });
});

describe("showing a password", () => {
  it("shows it in plain sight and, to a screen reader, one character at a time with capitals named", () => {
    const html = renderToStaticMarkup(<PasswordReveal label="Your password" password="kT7mXp" />);
    expect(html).toContain("Your password");
    expect(html).toMatch(/aria-hidden="true">kT7mXp</);
    expect(html).toContain("k, capital T, 7, m, capital X, p");
  });

  it("is sized and wrapped so a 28 character password fits a narrow panel", () => {
    const css = readFileSync("src/ui/styles.css", "utf8");
    const rule = css.match(/\.fg-password-reveal__value\s*\{([^}]*)\}/)?.[1] ?? "";
    expect(rule).not.toBe("");
    const size = Number(rule.match(/font-size:\s*(\d+(?:\.\d+)?)px/)?.[1]);
    expect(size).toBeGreaterThanOrEqual(16);
    expect(size).toBeLessThanOrEqual(20);
    expect(rule).toMatch(/overflow-wrap:\s*anywhere|word-break:\s*break-all/);
    expect(rule).toMatch(/font-family:\s*var\(--font-mono\)/);
  });
});
