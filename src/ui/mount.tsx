import { createRoot } from "react-dom/client";
import type { ReactNode } from "react";
import { ready } from "../shared/storage.ts";

export function mountUiPage(page: ReactNode) {
  const container = document.getElementById("root");
  if (!container) throw new Error("FocusGate page is missing its root element.");
  const root = createRoot(container);

  if (
    typeof chrome === "undefined" ||
    !chrome.runtime?.id ||
    import.meta.env.DEV
  ) {
    root.render(page);
    return root;
  }

  root.render(
    <main className="storage-gate-skeleton" aria-busy="true" aria-label="Starting FocusGate">
      <span className="skeleton skeleton-title" />
      <span className="skeleton skeleton-card" />
    </main>,
  );
  void ready()
    .then(() => root.render(page))
    .catch((error: unknown) => {
      const message =
        error instanceof Error
          ? error.message
          : "FocusGate could not prepare your data.";
      root.render(
        <main className="storage-gate-error" role="alert">
          <h1>FocusGate could not start</h1>
          <p>{message}</p>
        </main>,
      );
    });
  return root;
}
