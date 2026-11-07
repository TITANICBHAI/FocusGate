import { Eye, EyeOff, Settings2 } from "lucide-react";
import {
  Children,
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactElement,
  ReactNode,
} from "react";

/* =====================================================================
   Shared UI primitives (design.md §4.2)
   All class names come from the foundation block in styles.css.
   ===================================================================== */

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "quiet"
  | "danger"
  | "danger-quiet";
export type ButtonSize = "default" | "dense" | "jumbo";

function buttonClasses(
  variant: ButtonVariant,
  size: ButtonSize,
  wide: boolean,
  icon: boolean,
): string {
  const classes = ["fg-btn", `fg-btn--${variant}`];
  if (size === "dense") classes.push("fg-btn--dense");
  if (size === "jumbo") classes.push("fg-btn--jumbo");
  if (wide) classes.push("fg-btn--wide");
  if (icon) classes.push("fg-btn--icon");
  return classes.join(" ");
}

export function Button({
  variant = "secondary",
  size = "default",
  wide = false,
  icon = false,
  className = "",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  wide?: boolean;
  icon?: boolean;
}) {
  return (
    <button
      type={type}
      className={`${buttonClasses(variant, size, wide, icon)} ${className}`.trim()}
      {...props}
    />
  );
}

export function IconButton({
  label,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`fg-btn fg-btn--quiet fg-btn--icon fg-btn--dense ${className}`.trim()}
      {...props}
    />
  );
}

export function Card({
  title,
  description,
  actions,
  className = "",
  children,
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`fg-card ${className}`.trim()}>
      {(title || description || actions) && (
        <div className="fg-wrap" style={{ justifyContent: "space-between" }}>
          <div className="fg-stack" style={{ gap: 2 }}>
            {title && <h3 className="fg-card__title">{title}</h3>}
            {description && <p className="fg-card__desc">{description}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="fg-section-label">{children}</p>;
}

export function Field({
  id,
  label,
  helper,
  error,
  children,
  className = "",
}: {
  id: string;
  label: string;
  helper?: string;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  const helperId = `${id}-helper`;
  const errorId = `${id}-error`;
  const descriptionIds = [helper ? helperId : "", error ? errorId : ""].filter(
    Boolean,
  );
  const describedChildren = connectFieldControls(
    children,
    descriptionIds,
    error ? errorId : undefined,
  );
  return (
    <div
      className={`fg-field ${error ? "has-error" : ""} ${className}`.trim()}
    >
      <label className="fg-field__label" htmlFor={id}>
        {label}
      </label>
      {describedChildren}
      {helper && (
        <p className="fg-field__helper" id={helperId}>
          {helper}
        </p>
      )}
      {error && (
        <p className="fg-field__error" id={errorId}>
          {error}
        </p>
      )}
    </div>
  );
}

function connectFieldControls(
  children: ReactNode,
  descriptionIds: string[],
  errorId?: string,
): ReactNode {
  return Children.map(children, (child) => {
    if (!isValidElement(child)) return child;
    const props = child.props as {
      children?: ReactNode;
      "aria-describedby"?: string;
      "aria-errormessage"?: string;
      "aria-invalid"?: boolean;
    };
    if (
      typeof child.type === "string" &&
      ["input", "select", "textarea"].includes(child.type)
    ) {
      const describedBy = [
        ...new Set([
          ...(props["aria-describedby"]?.split(/\s+/).filter(Boolean) ?? []),
          ...descriptionIds,
        ]),
      ].join(" ");
      return cloneElement(child as ReactElement<Record<string, unknown>>, {
        "aria-describedby": describedBy || undefined,
        "aria-errormessage": errorId ?? props["aria-errormessage"],
        "aria-invalid": errorId ? true : props["aria-invalid"],
      });
    }
    if (!props.children) return child;
    return cloneElement(child as ReactElement<{ children?: ReactNode }>, {
      children: connectFieldControls(props.children, descriptionIds, errorId),
    });
  });
}

export function Toggle({
  label,
  description,
  checked,
  onCheckedChange,
  disabled = false,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange(checked: boolean): void;
  disabled?: boolean;
}) {
  const descriptionId = useId();
  return (
    <div className={`fg-toggle ${disabled ? "is-disabled" : ""}`}>
      <div className="fg-toggle__copy">
        <span className="fg-toggle__label fg-field__label">{label}</span>
        {description && (
          <span className="fg-field__helper" id={descriptionId}>
            {description}
          </span>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-pressed={checked}
        aria-label={label}
        aria-describedby={description ? descriptionId : undefined}
        disabled={disabled}
        className="fg-toggle__track"
        onClick={() => onCheckedChange(!checked)}
      />
    </div>
  );
}

export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <div className="fg-field">
      <span className="fg-field__label" id={`${label}-seg-label`}>
        {label}
      </span>
      <div
        className="fg-seg"
        role="group"
        aria-label={label}
        aria-labelledby={`${label}-seg-label`}
      >
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={value === option.value}
            aria-selected={value === option.value}
            disabled={disabled}
            className="fg-seg__btn"
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Chip({
  children,
  tone = "neutral",
  onRemove,
  removeLabel,
}: {
  children: ReactNode;
  tone?: "neutral" | "accent" | "warning" | "danger" | "live" | "lock";
  onRemove?: () => void;
  removeLabel?: string;
}) {
  const toneClass =
    tone === "accent" || tone === "live"
      ? "fg-chip--live"
      : tone === "warning" || tone === "lock"
        ? "fg-chip--lock"
        : tone === "danger"
          ? "fg-chip--danger"
          : "";
  return (
    <span className={`fg-chip ${toneClass}`.trim()}>
      {children}
      {onRemove && (
        <button
          type="button"
          className="fg-chip__btn"
          aria-label={removeLabel ?? "Remove"}
          onClick={onRemove}
        >
          ×
        </button>
      )}
    </span>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="fg-empty">
      {icon}
      <span className="fg-empty__title">{title}</span>
      <span className="fg-empty__desc">{description}</span>
      {action}
    </div>
  );
}

export function ListRow({
  swatch,
  icon,
  title,
  sub,
  chips,
  status,
  actions,
}: {
  swatch?: ReactNode;
  icon?: ReactNode;
  title: ReactNode;
  sub?: ReactNode;
  chips?: ReactNode;
  status?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="fg-row">
      {(swatch || icon) && (
        <div className="fg-row__swatch" aria-hidden="true">
          {icon ?? swatch}
        </div>
      )}
      <div className="fg-row__copy">
        <span className="fg-row__title">{title}</span>
        {sub && <span className="fg-row__sub">{sub}</span>}
        {chips && <div className="fg-row__chips">{chips}</div>}
      </div>
      {status}
      {actions && <div className="fg-row__actions">{actions}</div>}
    </div>
  );
}

export function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
}) {
  return (
    <div className="fg-stat">
      <span className="fg-stat__label">{label}</span>
      <span className="fg-stat__value">{value}</span>
      {sub && <span className="fg-stat__sub">{sub}</span>}
    </div>
  );
}

export function Progress({
  value,
  tone = "accent",
}: {
  value: number;
  tone?: "accent" | "break" | "warn";
}) {
  const safe = Math.max(0, Math.min(1, value));
  const toneClass =
    tone === "break"
      ? "fg-progress--break"
      : tone === "warn"
        ? "fg-progress--warn"
        : "";
  return (
    <div
      className={`fg-progress ${toneClass}`.trim()}
      role="progressbar"
      aria-valuenow={Math.round(safe * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <span style={{ width: `${Math.round(safe * 100)}%` }} />
    </div>
  );
}

export function AppHeader({
  status = "idle",
  onOpenSettings,
}: {
  status?: "idle" | "focus" | "break" | "block";
  onOpenSettings(): void;
}) {
  return (
    <header className="fg-header">
      <span className="fg-wordmark">
        <img src="/icon.png" alt="" />
        FocusGate
      </span>
      <div className="fg-header__actions">
        <span
          className={`fg-status-dot fg-status-dot--${status}`}
          role="img"
          aria-label={
            status === "idle" ? "Idle" : `${status} in progress`
          }
        />
        <IconButton label="Open settings" onClick={onOpenSettings}>
          <Settings2 aria-hidden="true" />
        </IconButton>
      </div>
    </header>
  );
}

function formatClock(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

export function HeroTimer({
  label,
  seconds,
  meta,
  progress,
  tone = "accent",
  editable = false,
  onEditStart,
  chip,
}: {
  label: string;
  seconds: number;
  meta?: ReactNode;
  progress?: number;
  tone?: "accent" | "break" | "warn";
  editable?: boolean;
  onEditStart?: () => void;
  chip?: ReactNode;
}) {
  const toneClass =
    tone === "break"
      ? "fg-hero--break"
      : tone === "warn"
        ? "fg-hero--warn"
        : "";
  const timeNode = (
    <div
      className={`fg-hero__time ${editable ? "fg-hero__time--clickable" : ""}`.trim()}
      onClick={editable ? onEditStart : undefined}
      onKeyDown={
        editable
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onEditStart?.();
              }
            }
          : undefined
      }
      role={editable ? "button" : undefined}
      tabIndex={editable ? 0 : undefined}
      aria-label={editable ? "Edit session length" : undefined}
    >
      {formatClock(seconds)}
    </div>
  );
  return (
    <div className={`fg-hero ${toneClass}`.trim()}>
      <div className="fg-hero__label">
        {label}
        {chip}
      </div>
      {timeNode}
      {meta && <div className="fg-hero__meta">{meta}</div>}
      {progress !== undefined && (
        <div className="fg-hero__progress">
          <Progress value={progress} tone={tone} />
        </div>
      )}
    </div>
  );
}

export function Sheet({
  open,
  title,
  onClose,
  children,
  footer,
}: {
  open: boolean;
  title: string;
  onClose(): void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement;
    panelRef.current?.focus();
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
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
    <>
      <div className="fg-scrim" onClick={onClose} aria-hidden="true" />
      <div
        className="fg-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={panelRef}
      >
        <div className="fg-sheet__grip" aria-hidden="true" />
        <h2 className="fg-card__title">{title}</h2>
        <div className="fg-stack">{children}</div>
        {footer && (
          <div className="fg-wrap fg-sheet__footer">
            {footer}
          </div>
        )}
      </div>
    </>
  );
}

export function ProgressRing({
  progress,
  size = 220,
  stroke = 8,
  label,
  children,
}: {
  progress: number;
  size?: number;
  stroke?: number;
  label: string;
  children: ReactNode;
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const safeProgress = Math.max(0, Math.min(1, progress));
  return (
    <div
      className="fg-progress-ring"
      role="img"
      aria-label={`${label}: ${Math.round(safeProgress * 100)}%`}
      style={{ width: size, height: size }}
    >
      <svg aria-hidden="true" viewBox={`0 0 ${size} ${size}`}>
        <circle
          className="fg-progress-ring__track"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
        />
        <circle
          className="fg-progress-ring__value"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - safeProgress)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="fg-progress-ring__content">{children}</div>
    </div>
  );
}

export function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete = "current-password",
  placeholder,
  helper = "Used to verify this action.",
  blockPaste = false,
  maxLength,
  autoFocus = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange(value: string): void;
  autoComplete?: InputHTMLAttributes<HTMLInputElement>["autoComplete"];
  placeholder?: string;
  helper?: string;
  blockPaste?: boolean;
  maxLength?: number;
  autoFocus?: boolean;
}) {
  const [visible, setVisible] = useState(true);
  return (
    <Field id={id} label={label} helper={helper}>
      <div className="fg-password-input">
        <input
          id={id}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          value={value}
          placeholder={placeholder}
          maxLength={maxLength}
          autoFocus={autoFocus}
          onPaste={blockPaste ? preventPasswordPaste : undefined}
          onChange={(event) => onChange(event.target.value)}
        />
        <IconButton
          label={visible ? "Hide password" : "Show password"}
          onClick={() => setVisible((shown) => !shown)}
        >
          {visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
        </IconButton>
      </div>
    </Field>
  );
}

export function preventPasswordPaste(event: {
  preventDefault(): void;
}): void {
  event.preventDefault();
}
