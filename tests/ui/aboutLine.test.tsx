import { afterEach, describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AboutLine, appVersion } from "../../src/ui/dashboard/AboutLine.tsx";

afterEach(() => {
  delete (globalThis as { chrome?: unknown }).chrome;
});

describe("About line", () => {
  it("names the version and TBTechs, and says where data lives", () => {
    const html = renderToStaticMarkup(<AboutLine version="1.0.1" />);
    expect(html).toContain("FocusGate v1.0.1 by TBTechs");
    expect(html).toContain("Your data stays in browser storage.");
  });

  it("adds no links of its own", () => {
    expect(renderToStaticMarkup(<AboutLine version="1.0.1" />)).not.toContain("<a ");
  });

  it("reads the version from the manifest", () => {
    (globalThis as { chrome?: unknown }).chrome = {
      runtime: { getManifest: () => ({ version: "1.0.1" }) },
    };
    expect(appVersion()).toBe("1.0.1");
  });

  it("drops the version, not the line, when the manifest cannot be read", () => {
    expect(appVersion()).toBe("");
    expect(renderToStaticMarkup(<AboutLine version="" />)).toContain("FocusGate by TBTechs");
  });
});
