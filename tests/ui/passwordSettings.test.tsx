import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  PasswordSettings,
  passwordFormDisabled,
} from "../../src/ui/popup/PasswordSettings.tsx";
import { preventPasswordPaste } from "../../src/ui/components/primitives.tsx";
import { createDefaultState } from "../../src/shared/defaults.ts";

describe("staged password settings", () => {
  it("shows setup fields, policy guidance, and secure generation", () => {
    const html = renderToStaticMarkup(
      <PasswordSettings state={createDefaultState()} />,
    );
    expect(html).toContain("Set password");
    expect(html).toContain("Confirm password");
    expect(html).toContain("Use 8–64 characters");
    expect(html).toContain("Generate (recommended)");
    expect(html).not.toContain("Current password");
  });

  it("shows current-password verification and removal for an existing password", () => {
    const state = createDefaultState();
    state.password = {
      algo: "pbkdf2-sha256",
      iter: 1_000,
      salt: "00",
      hash: "11",
    };
    const html = renderToStaticMarkup(<PasswordSettings state={state} />);
    expect(html).toContain("Current password");
    expect(html).toContain("Change password");
    expect(html).toContain("Remove password");
    expect(html).toContain("Paste is disabled for this verification field.");
  });

  it("prevents paste when the verification field requests typing friction", () => {
    const preventDefault = vi.fn();
    preventPasswordPaste({ preventDefault });
    expect(preventDefault).toHaveBeenCalledOnce();
  });

  it("enables password submission only for a matching 8–64 character value", () => {
    expect(passwordFormDisabled("short", "short", false, false)).toBe(true);
    expect(passwordFormDisabled("long enough", "different", false, false)).toBe(
      true,
    );
    expect(passwordFormDisabled("x".repeat(65), "x".repeat(65), false, false)).toBe(
      true,
    );
    expect(
      passwordFormDisabled("long enough", "long enough", false, false),
    ).toBe(false);
    expect(
      passwordFormDisabled("long enough", "long enough", false, true),
    ).toBe(true);
  });
});
