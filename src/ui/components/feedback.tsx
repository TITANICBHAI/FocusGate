import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { Button } from "./primitives.tsx";

type ToastTone = "success" | "error" | "info";
type Toast = { id: number; message: string; tone: ToastTone };
type ToastAction = (message: string, tone?: ToastTone) => void;

const ToastContext = createContext<ToastAction | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, number>());
  const showToast = useCallback<ToastAction>((message, tone = "info") => {
    const id = nextId.current++;
    setToasts((items) => [...items, { id, message, tone }]);
    timers.current.set(
      id,
      window.setTimeout(() => {
        setToasts((items) => items.filter((item) => item.id !== id));
        timers.current.delete(id);
      }, 4_500),
    );
  }, []);

  useEffect(
    () => () => timers.current.forEach((timer) => window.clearTimeout(timer)),
    [],
  );

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <div className="fg-toast-stack" aria-live="polite" aria-relevant="additions">
        {toasts.map((toast) => (
          <div
            className={`fg-toast fg-toast--${toast.tone}`}
            key={toast.id}
            role={toast.tone === "error" ? "alert" : "status"}
          >
            <span>{toast.message}</span>
            <button
              type="button"
              aria-label="Dismiss notification"
              onClick={() => {
                const timer = timers.current.get(toast.id);
                if (timer !== undefined) window.clearTimeout(timer);
                timers.current.delete(toast.id);
                setToasts((items) => items.filter((item) => item.id !== toast.id));
              }}
            >
              Dismiss
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastAction {
  const showToast = useContext(ToastContext);
  if (!showToast) throw new Error("useToast must be used within ToastProvider.");
  return showToast;
}

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function getFocusable(panel: HTMLElement | null): HTMLElement[] {
  return Array.from(panel?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []).filter(
    (element) => {
      if (element.tabIndex < 0 || element.closest("[hidden], [inert], [aria-hidden='true']")) {
        return false;
      }
      const style = window.getComputedStyle(element);
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        element.getClientRects().length > 0
      );
    },
  );
}

export function Modal({
  open,
  title,
  description,
  onClose,
  children,
  actions,
}: {
  open: boolean;
  title: string;
  description?: string;
  onClose(): void;
  children?: ReactNode;
  actions?: ReactNode;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement;
    const panel = panelRef.current;
    const focusables = () => getFocusable(panel);
    const initial = focusables().find((element) => element.hasAttribute("autofocus"));
    (initial ?? focusables()[0] ?? panel)?.focus();

    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) {
        event.preventDefault();
        panel?.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (active === panel || !panel?.contains(active)) {
        event.preventDefault();
        (event.shiftKey ? last : first)?.focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, [open]);

  if (!open) return null;
  return (
    <div
      className="fg-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="fg-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        ref={panelRef}
      >
        <header className="fg-modal__header">
          <div>
            <h2 id={titleId}>{title}</h2>
            {description && <p id={descriptionId}>{description}</p>}
          </div>
          <button
            type="button"
            className="fg-icon-button"
            aria-label="Close dialog"
            onClick={onClose}
          >
            <span aria-hidden="true">×</span>
          </button>
        </header>
        {children !== undefined && (
          <div className="fg-modal__body">{children}</div>
        )}
        {actions && <footer className="fg-modal__actions">{actions}</footer>}
      </section>
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm(): void;
  onCancel(): void;
}) {
  const onClose = useCallback(() => onCancel(), [onCancel]);
  return (
    <Modal
      open={open}
      title={title}
      description={message}
      onClose={onClose}
      actions={
        <>
          <Button variant="secondary" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant={danger ? "danger" : "primary"} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    />
  );
}
