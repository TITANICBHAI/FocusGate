import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (path: string) =>
  readFileSync(new URL(path, import.meta.url), "utf8");

const focusView = source("../../src/ui/popup/FocusView.tsx");
const rulesView = source("../../src/ui/popup/RulesView.tsx");
const settingsView = source("../../src/ui/popup/SettingsView.tsx");
const dashboard = source("../../src/ui/dashboard/DashboardPage.tsx");
const onboarding = source("../../src/ui/onboarding/OnboardingPage.tsx");
const userFacingCopy = [
  focusView,
  rulesView,
  settingsView,
  dashboard,
  onboarding,
].join("\n");

describe("staged UI copy", () => {
  it("avoids internal staging and implementation terminology", () => {
    expect(userFacingCopy).not.toMatch(
      /staged UI|staged screen|staged background runtime|background runtime cutover|staged block page|security and data work|not available in this preview/i,
    );
    expect(userFacingCopy).not.toMatch(
      /\b(completely|instantly|cannot|guaranteed)\b/i,
    );
  });

  it("keeps unavailable actions honest and links their visible explanation", () => {
    expect(focusView).toContain("Standalone blocking is not available yet.");
    expect(focusView).toContain(
      'aria-describedby="standalone-block-controls-help"',
    );
    expect(focusView).toContain('id="standalone-block-controls-help"');
    expect(dashboard).toContain(
      'aria-describedby="backup-controls-help"',
    );
    expect(dashboard).toContain('id="backup-controls-help"');
    expect(dashboard).toContain("Backup export and restore are not available yet.");
    expect(settingsView).toContain(
      "Sound playback is not available on the block page yet.",
    );
    expect(onboarding).toContain('return "Check unavailable"');
  });

  it("keeps store and extension descriptions consistent until presets ship", () => {
    const description =
      "Block distracting websites and keywords with a focus timer, schedules and daily limits. Your data stays in your browser.";
    const manifest = JSON.parse(
      source("../../public/manifest.json"),
    ) as { description: string };
    const metadata = JSON.parse(
      source("../../metadata.json"),
    ) as { description: string };
    const storeListing = source("../../STORE_LISTING.md");

    expect(manifest.description).toBe(description);
    expect(metadata.description).toBe(description);
    expect(storeListing).toContain(`**Short description:** ${description}`);
  });
});
