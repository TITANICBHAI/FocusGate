import { Component } from "react";
import type { ReactNode } from "react";

/**
 * Last-resort boundary for every FocusGate page (panel, dashboard, blocked
 * page, onboarding). A render error shows a short message and a Reload
 * button instead of a blank page. Copy is pinned in overhaul/DESIGN.md §9.3.
 */
export class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error("[FocusGate]", error);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <main className="fg-full-page">
        <div className="fg-full-page__inner">
          <h1 className="fg-block-headline">FocusGate hit a problem</h1>
          <p className="fg-muted">
            This screen crashed. Your rules and data were not changed.
          </p>
          <button
            type="button"
            className="fg-btn fg-btn--primary"
            onClick={() => location.reload()}
          >
            Reload
          </button>
          <details className="fg-muted">
            <summary>Technical details</summary>
            <p>{error.message}</p>
          </details>
        </div>
      </main>
    );
  }
}
