import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createDefaultState } from "../../src/shared/defaults.ts";
import { ToastProvider } from "../../src/ui/components/feedback.tsx";
import { DashboardSettings } from "../../src/ui/dashboard/DashboardSettings.tsx";

describe("the chime toggle in Settings", () => {
  const html = renderToStaticMarkup(
    <ToastProvider>
      <DashboardSettings state={createDefaultState()} />
    </ToastProvider>,
  );

  it("is there, in plain words, switched on", () => {
    expect(html).toContain("Soft chime when a session ends");
  });

  it("is shown once, not as a second copy among the system notifications", () => {
    const labels = html.match(/<span[^>]*>Soft chime when a session ends<\/span>/g) ?? [];
    expect(labels).toHaveLength(1);
    expect(html).not.toMatch(/Chime<\/span>/);
  });

  it("does not ask for notification permission, because a chime is not a notification", () => {
    const source = readFileSync(new URL("../../src/ui/dashboard/DashboardSettings.tsx", import.meta.url), "utf8");
    const block = /label="Soft chime when a session ends"[\s\S]*?"Chime setting saved\."/.exec(source)?.[0] ?? "";
    expect(block).toContain("chime");
    expect(block).not.toContain("requestNotificationPermission");
  });
});
