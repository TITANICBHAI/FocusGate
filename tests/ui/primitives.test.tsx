import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  Chip,
  Field,
  IconButton,
  InfoButton,
  InfoNote,
  PasswordField,
  ProgressRing,
  Segmented,
  Toggle,
} from "../../src/ui/components/primitives.tsx";
import { Modal } from "../../src/ui/components/feedback.tsx";

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

  it("names the show-or-hide button for the password it hides, or for another secret when told to", () => {
    const render = (secretName?: string) =>
      renderToStaticMarkup(
        <PasswordField
          id="password"
          label="Password"
          value=""
          onChange={() => undefined}
          {...(secretName ? { secretName } : {})}
        />,
      );

    expect(render()).toContain('aria-label="Hide password"');
    expect(render()).not.toMatch(/aria-label="[^"]*\bPIN\b/);
    expect(render("recovery phrase")).toContain('aria-label="Hide recovery phrase"');
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
    const descriptionId = markup.match(
      /<span class="fg-field__helper" id="([^"]+)"/,
    )?.[1];

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

  it("puts an action beside a segmented control's label only when one is given", () => {
    const options = [
      { value: "a", label: "A" },
      { value: "b", label: "B" },
    ];
    const plain = renderToStaticMarkup(
      <Segmented label="Pick" options={options} value="a" onChange={() => undefined} />,
    );
    expect(plain).not.toContain("fg-info-row");
    const withAction = renderToStaticMarkup(
      <Segmented
        label="Pick"
        options={options}
        value="a"
        onChange={() => undefined}
        labelAction={<button type="button">More</button>}
      />,
    );
    expect(withAction).toMatch(/fg-info-row[^>]*>[\s\S]*Pick[\s\S]*More[\s\S]*fg-seg/);
    expect(withAction).toContain('role="group" aria-label="Pick"');
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
});

describe("info button and note", () => {
  const closed = { open: false, id: "tip", toggle: () => undefined };
  const open = { open: true, id: "tip", toggle: () => undefined };

  it("gives the button a name, its state and the note it controls", () => {
    const markup = renderToStaticMarkup(<InfoButton label="What does this mean?" info={closed} />);
    expect(markup).toContain('aria-label="What does this mean?"');
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).toContain('aria-controls="tip"');
    expect(renderToStaticMarkup(<InfoButton label="x" info={open} />)).toContain(
      'aria-expanded="true"',
    );
  });

  it("shows the note only while it is open, as a real element and not a tooltip", () => {
    expect(renderToStaticMarkup(<InfoNote info={closed}>Hello</InfoNote>)).toBe("");
    const markup = renderToStaticMarkup(<InfoNote info={open}>Hello</InfoNote>);
    expect(markup).toContain('id="tip"');
    expect(markup).toContain('role="note"');
    expect(markup).toContain("Hello");
    expect(markup).not.toContain("title=");
  });

  it("adds a dismiss button only when the note can be dismissed", () => {
    const plain = renderToStaticMarkup(<InfoNote info={open}>Hello</InfoNote>);
    expect(plain).not.toContain("Dismiss");
    const dismissible = renderToStaticMarkup(
      <InfoNote info={open} onDismiss={() => undefined} dismissLabel="Hide this hint">
        Hello
      </InfoNote>,
    );
    expect(dismissible).toContain('aria-label="Hide this hint"');
  });
});

describe("Chip tones", () => {
  it("styles the live and lock tones the panel screens ask for", () => {
    expect(renderToStaticMarkup(<Chip tone="live">On</Chip>)).toContain(
      "fg-chip fg-chip--live",
    );
    expect(renderToStaticMarkup(<Chip tone="lock">Strict</Chip>)).toContain(
      "fg-chip fg-chip--lock",
    );
  });

  it("keeps the accent, warning, danger and neutral tones unchanged", () => {
    expect(renderToStaticMarkup(<Chip tone="accent">A</Chip>)).toContain("fg-chip--live");
    expect(renderToStaticMarkup(<Chip tone="warning">W</Chip>)).toContain("fg-chip--lock");
    expect(renderToStaticMarkup(<Chip tone="danger">D</Chip>)).toContain("fg-chip--danger");
    expect(renderToStaticMarkup(<Chip>N</Chip>)).toContain('class="fg-chip"');
  });
});
