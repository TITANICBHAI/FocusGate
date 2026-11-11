import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PasswordSettings } from "../../src/ui/settings/PasswordSettings.tsx";
import { preventPasswordPaste } from "../../src/ui/components/primitives.tsx";
import { createDefaultState } from "../../src/shared/defaults.ts";
import type { AppState } from "../../src/shared/types.ts";

function withPassword(): AppState {
  const state = createDefaultState();
  state.password = { algo: "pbkdf2-sha256", iter: 1_000, salt: "00", hash: "11" };
  return state;
}

/** The words a person reads: text between tags and the names of controls. */
function words(html: string): string {
  return [
    ...html.matchAll(/>([^<]+)</g),
    ...html.matchAll(/aria-label="([^"]*)"/g),
  ]
    .map((match) => match[1])
    .join(" | ");
}

describe("Password settings card", () => {
  it("with no password: shows the picker, a way to generate one and a Set password button", () => {
    const html = renderToStaticMarkup(<PasswordSettings state={createDefaultState()} />);
    expect(html).toContain("Set password");
    expect(html).toContain("Confirm password");
    expect(html).toContain("Use 8–28 characters");
    expect(html).toContain("Generate a password");
    expect(html).not.toContain("Current password");
    expect(html).not.toContain("Remove password");
  });

  it("with a password: asks for the current one and offers to change or remove it", () => {
    const html = renderToStaticMarkup(<PasswordSettings state={withPassword()} />);
    expect(html).toContain("Current password");
    expect(html).toContain("New password");
    expect(html).toContain("Change password");
    expect(html).toContain("Remove password");
    expect(html).toContain("Paste is disabled for this verification field.");
  });

  it("says the password adds friction without preventing removal of the extension", () => {
    const html = renderToStaticMarkup(<PasswordSettings state={createDefaultState()} />);
    expect(html).toContain("It does not prevent this extension from being disabled or removed.");
  });

  it("lists what needs the password, and says a lock beats it", () => {
    const html = renderToStaticMarkup(<PasswordSettings state={createDefaultState()} />);
    expect(html).toContain("Removing or loosening sites, keywords, schedules and limits");
    expect(html).toContain("Ending a Strict session early");
    expect(html).toContain("Changing or removing the password, and resetting your data");
    expect(html).toContain(
      "During a Strict or Commit session, or a Block now window, these stay locked even with the password.",
    );
  });

  it("says password, never PIN, wherever a person reads or hears it", () => {
    for (const state of [createDefaultState(), withPassword()]) {
      const text = words(renderToStaticMarkup(<PasswordSettings state={state} />));
      expect(text).not.toMatch(/\bPINs?\b/);
      expect(text).toContain("Password");
    }
  });

  it("is locked, with the time it unlocks, during a Strict session", () => {
    const state = withPassword();
    state.session = {
      ...state.session,
      status: "work",
      lockLevel: "strict",
      phaseEndsAt: Date.now() + 3_600_000,
    };
    const html = renderToStaticMarkup(<PasswordSettings state={state} />);
    expect(html).toContain("Password changes are locked until");
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Change password/);
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Remove password/);
  });

  it("prevents paste when the verification field requests typing friction", () => {
    const preventDefault = vi.fn();
    preventPasswordPaste({ preventDefault });
    expect(preventDefault).toHaveBeenCalledOnce();
  });
});
