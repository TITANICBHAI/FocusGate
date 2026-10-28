import { Eye, EyeOff } from "lucide-react";
import { useId, useState } from "react";
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
} from "react";

type ButtonVariant = "primary" | "secondary" | "quiet" | "danger";

export function Button({
  variant = "primary",
  className = "",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      type={type}
      className={`fg-button fg-button--${variant} ${className}`.trim()}
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
      className={`fg-icon-button ${className}`.trim()}
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
        <header className="fg-card__header">
          <div>
            {title && <h2 className="fg-card__title">{title}</h2>}
            {description && <p className="fg-muted">{description}</p>}
          </div>
          {actions}
        </header>
      )}
      {children}
    </section>
  );
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
  return (
    <div className={`fg-field ${className}`.trim()}>
      <label className="fg-field__label" htmlFor={id}>
        {label}
      </label>
      {children}
      {error ? (
        <p className="fg-field__error" id={errorId}>
          {error}
        </p>
      ) : helper ? (
        <p className="fg-field__helper" id={helperId}>
          {helper}
        </p>
      ) : null}
    </div>
  );
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
  return (
    <div className={`fg-toggle-row ${disabled ? "is-disabled" : ""}`}>
      <div className="fg-toggle-row__copy">
        <span className="fg-toggle-row__label">{label}</span>
        {description && <span className="fg-muted">{description}</span>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        className={`fg-switch ${checked ? "is-on" : ""}`}
        onClick={() => onCheckedChange(!checked)}
      >
        <span className="fg-switch__thumb" />
      </button>
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
  onChange(value: T): void;
  disabled?: boolean;
}) {
  return (
    <div className="fg-segmented-wrap">
      <span className="fg-field__label">{label}</span>
      <div className="fg-segmented" role="group" aria-label={label}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={value === option.value}
            disabled={disabled}
            className={value === option.value ? "is-selected" : ""}
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
}: {
  children: ReactNode;
  tone?: "neutral" | "accent" | "warning" | "danger";
}) {
  return <span className={`fg-chip fg-chip--${tone}`}>{children}</span>;
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="fg-empty-state">
      <h3>{title}</h3>
      <p className="fg-muted">{description}</p>
      {action}
    </div>
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
}: {
  id: string;
  label: string;
  value: string;
  onChange(value: string): void;
  autoComplete?: InputHTMLAttributes<HTMLInputElement>["autoComplete"];
  placeholder?: string;
}) {
  const [visible, setVisible] = useState(true);
  const describedBy = useId();
  return (
    <Field id={id} label={label} helper="Used to verify this action.">
      <div className="fg-password-input">
        <input
          id={id}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          aria-describedby={describedBy}
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
