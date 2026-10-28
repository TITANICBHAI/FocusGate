import { useRef } from "react";
import type { ReactNode } from "react";

export interface TabOption<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
}

export function Tabs<T extends string>({
  idPrefix,
  label,
  options,
  value,
  onChange,
  compact = false,
  className = "",
}: {
  idPrefix: string;
  label: string;
  options: readonly TabOption<T>[];
  value: T;
  onChange(value: T): void;
  compact?: boolean;
  className?: string;
}) {
  const refs = useRef(new Map<T, HTMLButtonElement>());
  const moveFocus = (current: T, direction: 1 | -1) => {
    const enabled = options.filter((option) => !option.disabled);
    const index = enabled.findIndex((option) => option.value === current);
    const next = enabled[(index + direction + enabled.length) % enabled.length];
    if (!next) return;
    onChange(next.value);
    refs.current.get(next.value)?.focus();
  };

  return (
    <div
      className={`fg-tabs ${compact ? "fg-tabs--compact" : ""} ${className}`.trim()}
      role="tablist"
      aria-label={label}
    >
      {options.map((option) => (
        <button
          key={option.value}
          ref={(node) => {
            if (node) refs.current.set(option.value, node);
            else refs.current.delete(option.value);
          }}
          type="button"
          role="tab"
          id={`${idPrefix}-${option.value}-tab`}
          aria-controls={`${idPrefix}-${option.value}-panel`}
          aria-selected={value === option.value}
          tabIndex={value === option.value ? 0 : -1}
          disabled={option.disabled}
          onClick={() => onChange(option.value)}
          onKeyDown={(event) => {
            if (event.key === "ArrowRight" || event.key === "ArrowDown") {
              event.preventDefault();
              moveFocus(option.value, 1);
            } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
              event.preventDefault();
              moveFocus(option.value, -1);
            } else if (event.key === "Home") {
              event.preventDefault();
              const first = options.find((item) => !item.disabled);
              if (first) {
                onChange(first.value);
                refs.current.get(first.value)?.focus();
              }
            } else if (event.key === "End") {
              event.preventDefault();
              const last = [...options].reverse().find((item) => !item.disabled);
              if (last) {
                onChange(last.value);
                refs.current.get(last.value)?.focus();
              }
            }
          }}
        >
          {option.icon}
          {option.label}
        </button>
      ))}
    </div>
  );
}
