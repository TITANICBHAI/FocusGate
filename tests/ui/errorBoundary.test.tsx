import { isValidElement } from "react";
import type { ReactElement, ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ErrorBoundary } from "../../src/ui/components/ErrorBoundary.tsx";

/**
 * The repo's UI tests render static markup (there is no DOM), and a server
 * render does not run error boundaries. So the boundary is exercised through
 * its own lifecycle: getDerivedStateFromError puts it in the failed state,
 * render() returns the pinned crash screen, componentDidCatch logs.
 */

type ButtonProps = { children?: ReactNode; onClick?: () => void };

function failedBoundary(message: string): ErrorBoundary {
  const boundary = new ErrorBoundary({ children: <p>never shown</p> });
  boundary.state = ErrorBoundary.getDerivedStateFromError(new Error(message));
  return boundary;
}

function findButton(node: ReactNode): ReactElement<ButtonProps> | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const hit = findButton(child);
      if (hit) return hit;
    }
    return null;
  }
  if (!isValidElement<ButtonProps>(node)) return null;
  if (node.type === "button") return node;
  return findButton(node.props.children);
}

describe("ErrorBoundary", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("renders its children while nothing has failed", () => {
    const boundary = new ErrorBoundary({ children: <p>all good</p> });
    expect(renderToStaticMarkup(<>{boundary.render()}</>)).toBe("<p>all good</p>");
  });

  it("shows the pinned crash screen instead of a blank page after a render error", () => {
    const html = renderToStaticMarkup(
      <>{failedBoundary("bad state in rules").render()}</>,
    );
    expect(html).toContain("FocusGate hit a problem");
    expect(html).toContain(
      "This screen crashed. Your rules and data were not changed.",
    );
    expect(html).toMatch(/<button[^>]*>Reload<\/button>/);
    expect(html).toContain("<summary>Technical details</summary>");
    expect(html).toContain("bad state in rules");
    expect(html).not.toContain("never shown");
  });

  it("Reload reloads the page", () => {
    const reload = vi.fn();
    vi.stubGlobal("location", { reload });
    const button = findButton(failedBoundary("x").render());
    expect(button).not.toBeNull();
    button?.props.onClick?.();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("logs the crash with the FocusGate prefix", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const error = new Error("boom");
    new ErrorBoundary({ children: null }).componentDidCatch(error);
    expect(spy).toHaveBeenCalledWith("[FocusGate]", error);
  });
});
