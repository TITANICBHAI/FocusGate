import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Field, PasswordField, Toggle } from "../../src/ui/components/primitives.tsx";

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
});
