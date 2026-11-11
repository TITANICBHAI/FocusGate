import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { StrictPasswordSheet } from "../../src/ui/components/StrictPasswordSheet.tsx";
import { generatedPasswordDraft } from "../../src/ui/lib/passwordDraft.ts";
import type { PasswordDraft } from "../../src/ui/lib/passwordDraft.ts";

const GENERATED = "kT7mXp2RhN4cWv9QbJ6sY3dFg";

function render(
  props: { open?: boolean; hasPassword?: boolean; initialMode?: "keep" | "new"; initialDraft?: PasswordDraft } = {},
): string {
  const { open = true, hasPassword = false, ...rest } = props;
  return renderToStaticMarkup(
    <StrictPasswordSheet
      open={open}
      hasPassword={hasPassword}
      onCancel={() => undefined}
      onDone={() => undefined}
      {...rest}
    />,
  );
}

function primaryButtons(html: string): number {
  return (html.match(/class="fg-btn fg-btn--primary/g) ?? []).length;
}

describe("Strict sheet: nothing shown when closed", () => {
  it("renders nothing", () => {
    expect(render({ open: false })).toBe("");
    expect(render({ open: false, hasPassword: true })).toBe("");
  });
});

describe("Strict sheet: no password saved yet", () => {
  const html = render();

  it("is a dialog that says what a password changes about stopping early", () => {
    expect(html).toContain('role="dialog"');
    expect(html).toContain("Protect this session with a password");
    expect(html).toContain("Stopping early needs the password if you set one.");
    expect(html).toContain("Without one it needs the phrase “I GIVE UP” and a 15-second wait.");
  });

  it("lets you type a password twice or generate one", () => {
    expect(html).toContain("Confirm password");
    expect(html).toContain("Generate a password");
  });

  it("has one main button, off until a password is chosen, and a plain way to skip", () => {
    expect(primaryButtons(html)).toBe(1);
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Set password and start/);
    expect(html).toMatch(/<button(?![^>]*disabled)[^>]*>Start without a password/);
    expect(html).toContain("Cancel");
  });

  it("does not offer to use a saved password, or ask for the current one", () => {
    expect(html).not.toContain("Use my password");
    expect(html).not.toContain("Current password");
  });

  it("shows a generated password, to be written down, and a main button that says so", () => {
    const generated = render({ initialDraft: generatedPasswordDraft(GENERATED) });
    expect(generated).toContain(GENERATED);
    expect(generated).toContain("Copy password");
    expect(generated).toContain("Write it down");
    expect(generated).toMatch(/<button(?![^>]*disabled)[^>]*>I have saved it, start/);
    expect(generated).not.toContain("Hide password");
    expect(primaryButtons(generated)).toBe(1);
  });
});

describe("Strict sheet: a password is already saved", () => {
  const html = render({ hasPassword: true });

  it("asks whether to use it", () => {
    expect(html).toContain("Use your password for this session?");
    expect(html).toContain("Stopping early will need your password.");
    expect(html).toContain("Use the one you set before, or set a new one.");
  });

  it("offers one click to use it, and a way to set a new one", () => {
    expect(primaryButtons(html)).toBe(1);
    expect(html).toMatch(/<button(?![^>]*disabled)[^>]*>Use my password and start/);
    expect(html).toContain("Set a new password");
    expect(html).toContain("Cancel");
  });

  it("shows no typing fields until a new password is asked for, and no way to skip", () => {
    expect(html).not.toContain("Confirm password");
    expect(html).not.toContain("Generate a password");
    expect(html).not.toContain("Current password");
    expect(html).not.toContain("Start without a password");
  });

  it("with a new password asked for: needs the current password and the new one, and can go back", () => {
    const next = render({ hasPassword: true, initialMode: "new" });
    expect(next).toContain("Current password");
    expect(next).toContain("New password");
    expect(next).toContain("Confirm password");
    expect(next).toContain("Generate a password");
    expect(next).toMatch(/<button[^>]*disabled=""[^>]*>Change password and start/);
    expect(next).toContain("Use my password instead");
    expect(next).not.toContain("Start without a password");
    expect(primaryButtons(next)).toBe(1);
  });

  it("with a generated new password: shows it, and the main button says it was saved", () => {
    const next = render({
      hasPassword: true,
      initialMode: "new",
      initialDraft: generatedPasswordDraft(GENERATED),
    });
    expect(next).toContain(GENERATED);
    expect(next).toContain("Current password");
    expect(next).toContain("I have saved it, change password and start");
  });
});

describe("Strict sheet: wording", () => {
  it("says password, never PIN, in words or labels", () => {
    for (const html of [
      render(),
      render({ hasPassword: true }),
      render({ hasPassword: true, initialMode: "new" }),
    ]) {
      const words = [...html.matchAll(/>([^<]+)</g), ...html.matchAll(/aria-label="([^"]*)"/g)]
        .map((match) => match[1])
        .join(" | ");
      expect(words).not.toMatch(/\bPINs?\b/);
    }
  });
});
