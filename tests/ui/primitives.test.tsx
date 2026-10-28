import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  Field,
  IconButton,
  PasswordField,
  ProgressRing,
  Segmented,
  Toggle,
} from "../../src/ui/components/primitives.tsx";
import { Modal } from "../../src/ui/components/feedback.tsx";
import { Tabs } from "../../src/ui/components/Tabs.tsx";

describe("accessible UI primitives", () => {
  it("connects nested field controls to helper and error text", () => {
    const markup = renderToStaticMarkup(
      <Field id="site" label="Site" helper="Use a domain." error="Enter a valid site.">
        <div>
          <input id="site" aria-describedby="existing-description" />
        </div>
      </Field>,
    );

    expect(markup).toContain(
      'aria-describedby="existing-description site-helper site-error"',
    );
    expect(markup).toContain('aria-errormessage="site-error"');
    expect(markup).toContain('aria-invalid="true"');
    expect(markup).toContain('id="site-helper"');
    expect(markup).toContain('id="site-error"');
  });

  it("connects the password field to its rendered helper text", () => {
    const markup = renderToStaticMarkup(
      <PasswordField
        id="password"
        label="Password"
        value=""
        onChange={() => undefined}
      />,
    );

    expect(markup).toContain('aria-describedby="password-helper"');
    expect(markup).toContain('id="password-helper"');
  });

  it("connects a toggle's description to its switch", () => {
    const markup = renderToStaticMarkup(
      <Toggle
        label="Enable filter"
        description="Hides matching content."
        checked={false}
        onCheckedChange={() => undefined}
      />,
    );
    const descriptionId = markup.match(/<span class="fg-muted" id="([^"]+)"/)?.[1];

    expect(descriptionId).toBeDefined();
    expect(markup).toContain(`aria-describedby="${descriptionId}"`);
  });

  it("gives icon-only controls and progress visuals accessible names", () => {
    const markup = renderToStaticMarkup(
      <>
        <IconButton label="Remove rule">
          <span aria-hidden="true">×</span>
        </IconButton>
        <ProgressRing progress={0.4} label="Session progress">
          <span>10 minutes</span>
        </ProgressRing>
      </>,
    );

    expect(markup).toContain('aria-label="Remove rule"');
    expect(markup).toContain('role="img" aria-label="Session progress: 40%"');
  });

  it("exposes segmented controls as a named group with pressed state", () => {
    const markup = renderToStaticMarkup(
      <Segmented
        label="Focus mode"
        options={[
          { value: "focus", label: "Focus" },
          { value: "always", label: "Always" },
        ]}
        value="focus"
        onChange={() => undefined}
      />,
    );

    expect(markup).toContain('role="group" aria-label="Focus mode"');
    expect(markup).toMatch(/aria-pressed="true"[^>]*>Focus<\/button>/);
    expect(markup).toMatch(/aria-pressed="false"[^>]*>Always<\/button>/);
  });

  it("renders a named modal dialog with an accessible close control", () => {
    const markup = renderToStaticMarkup(
      <Modal
        open
        title="Confirm change"
        description="Review this change before continuing."
        onClose={() => undefined}
      >
        <button type="button">Continue</button>
      </Modal>,
    );

    expect(markup).toContain('role="dialog"');
    expect(markup).toContain('aria-modal="true"');
    expect(markup).toContain('aria-labelledby="');
    expect(markup).toContain('aria-describedby="');
    expect(markup).toContain('aria-label="Close dialog"');
    expect(markup).toContain("Confirm change");
  });

  it("exposes tab selection and panel relationships in the markup", () => {
    const markup = renderToStaticMarkup(
      <Tabs
        idPrefix="settings"
        label="Settings sections"
        options={[
          { value: "timer", label: "Timer" },
          { value: "data", label: "Data" },
        ]}
        value="timer"
        onChange={() => undefined}
      />,
    );

    expect(markup).toContain('role="tablist" aria-label="Settings sections"');
    expect(markup).toContain('id="settings-timer-tab"');
    expect(markup).toContain('aria-controls="settings-timer-panel"');
    expect(markup).toContain('aria-selected="true" tabindex="0"');
    expect(markup).toContain('id="settings-data-tab"');
    expect(markup).toContain('aria-selected="false" tabindex="-1"');
  });
});
