import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PasswordPicker } from "../../src/ui/components/PasswordPicker.tsx";
import { emptyPasswordDraft, generatedPasswordDraft } from "../../src/ui/lib/passwordDraft.ts";

const GENERATED = "kT7mXp2RhN4cWv9QbJ6sY3dFg";

function render(draft = emptyPasswordDraft(), extra: { passwordLabel?: string; disabled?: boolean } = {}) {
  return renderToStaticMarkup(
    <PasswordPicker idPrefix="test-password" draft={draft} onChange={() => undefined} {...extra} />,
  );
}

describe("Password picker: typing your own", () => {
  const html = render();

  it("has a password field and a confirmation field, each with a show-or-hide button named for a password", () => {
    expect(html).toContain('id="test-password-new"');
    expect(html).toContain('id="test-password-confirm"');
    expect(html).toContain(">Password<");
    expect(html).toContain(">Confirm password<");
    expect(html.match(/aria-label="Hide password"/g) ?? []).toHaveLength(2);
    // Words on screen and in labels say password, never PIN.
    expect(html).not.toMatch(/\bPINs?\b/);
  });

  it("tells you what is allowed", () => {
    expect(html).toContain("Use 8–28 characters, or generate one.");
  });

  it("offers to generate one, and nothing about copying yet", () => {
    expect(html).toContain("Generate a password");
    expect(html).not.toContain("Copy password");
    expect(html).not.toContain("fg-password-reveal");
  });

  it("says under the second field whether it matches the first", () => {
    expect(html).toContain("Type it again to confirm.");
    expect(render({ password: "correct-horse", confirmation: "correct", generated: false })).toContain(
      "The passwords do not match.",
    );
    const matching = render({ password: "correct-horse", confirmation: "correct-horse", generated: false });
    expect(matching).toContain("The passwords match.");
    expect(matching).not.toContain("The passwords do not match.");
  });

  it("can name the field for a change, and can be switched off", () => {
    expect(render(emptyPasswordDraft(), { passwordLabel: "New password" })).toContain(">New password<");
    const off = render(emptyPasswordDraft(), { disabled: true });
    expect(off).toMatch(/<button[^>]*disabled=""[^>]*>Generate a password/);
  });
});

describe("Password picker: a generated password", () => {
  const html = render(generatedPasswordDraft(GENERATED));

  it("shows the password in plain sight, with a way to copy it", () => {
    expect(html).toContain("fg-password-reveal");
    expect(html).toContain(GENERATED);
    expect(html).toContain("Copy password");
    expect(html).toContain('role="status"');
  });

  it("says to write it down, because only a scrambled copy is kept", () => {
    expect(html).toContain("Write it down");
    expect(html).toContain("scrambled copy");
  });

  it("hides the typing fields, and lets you go back to choosing your own", () => {
    expect(html).not.toContain("test-password-new");
    expect(html).not.toContain("Hide password");
    expect(html).toContain("Choose my own instead");
  });
});
