import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  BlockedReasonBody,
  blockedCountLabel,
} from "../../src/ui/blocked/BlockedPage.tsx";
import { DEFAULT_BLOCK_MESSAGE, createDefaultState } from "../../src/shared/defaults.ts";

const until = new Date(2026, 10, 3, 17, 0).getTime();
const reason = { kind: "standalone", until } as never;
const now = until - 60_000;

function render(opts: { why?: string; message?: string; blocks?: number }): string {
  const settings = createDefaultState().settings;
  settings.why = opts.why ?? "";
  settings.blockPage = {
    ...settings.blockPage,
    message: opts.message ?? DEFAULT_BLOCK_MESSAGE,
    showQuotes: false,
  };
  return renderToStaticMarkup(
    <BlockedReasonBody
      reason={reason}
      target="https://example.com/x"
      now={now}
      settings={settings}
      blocksToday={opts.blocks ?? 0}
      dateKey="2026-11-03"
    />,
  );
}

describe("block page: your reason", () => {
  it("exports the stock message unchanged", () => {
    expect(DEFAULT_BLOCK_MESSAGE).toBe("Stay focused. You've got this.");
    expect(createDefaultState().settings.blockPage.message).toBe(DEFAULT_BLOCK_MESSAGE);
  });

  it("shows the reason in quotes with its label", () => {
    const html = render({ why: "Finish the thesis" });
    expect(html).toContain("Your reason");
    expect(html).toContain("“Finish the thesis”");
  });

  it("shows no reason block when the reason is empty", () => {
    const html = render({});
    expect(html).not.toContain("Your reason");
  });

  it("hides the stock message but still gives a detail line", () => {
    const html = render({});
    expect(html).not.toContain("Stay focused. You&#x27;ve got this.");
    expect(html).not.toContain("Stay focused. You've got this.");
    expect(html).toContain("This page is blocked by your current FocusGate rules.");
  });

  it("shows a message the person wrote themselves", () => {
    const html = render({ message: "Back to work." });
    expect(html).toContain("Back to work.");
    expect(html).not.toContain("This page is blocked by your current FocusGate rules.");
  });

  it("shows both a custom message and the reason", () => {
    const html = render({ message: "Back to work.", why: "Be present" });
    expect(html).toContain("Back to work.");
    expect(html).toContain("“Be present”");
  });
});

describe("block page: layout", () => {
  const html = render({ why: "Be present", blocks: 3 });

  it("has no eyebrow above the headline", () => {
    expect(html).not.toContain("fg-block-eyebrow");
  });

  it("reads reason first: headline, address, end time, countdown, your reason, count", () => {
    const order = [
      "Blocked by Block now",
      "https://example.com/x",
      "Ends ",
      "fg-block-countdown",
      "Your reason",
      "3 pages blocked today",
    ].map((needle) => html.indexOf(needle));
    expect(order.every((index) => index >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it("puts the headline, address and end time in one amber-barred group", () => {
    const head = html.slice(html.indexOf("fg-block-head"), html.indexOf("fg-block-countdown"));
    expect(head).toContain("Blocked by Block now");
    expect(head).toContain("https://example.com/x");
    expect(head).toContain("Ends ");
  });

  it("is left-aligned in a 480px column", () => {
    const css = readFileSync(new URL("../../src/ui/styles.css", import.meta.url), "utf8");
    const at = css.lastIndexOf(".fg-block-inner {");
    const body = css.slice(css.indexOf("{", at), css.indexOf("}", at));
    expect(body).toContain("text-align: left");
    expect(body).toContain("max-width: 480px");
    const head = css.slice(css.lastIndexOf(".fg-block-head {"));
    expect(head.slice(0, head.indexOf("}"))).toContain("border-left: 3px solid var(--warning)");
  });
});

describe("block page: count wording", () => {
  it("uses the right plural", () => {
    expect(blockedCountLabel(0)).toBe("0 pages blocked today");
    expect(blockedCountLabel(1)).toBe("1 page blocked today");
    expect(blockedCountLabel(2)).toBe("2 pages blocked today");
  });

  it("renders the label in the body", () => {
    expect(render({ blocks: 1 })).toContain("1 page blocked today");
    expect(render({ blocks: 2 })).toContain("2 pages blocked today");
  });
});
