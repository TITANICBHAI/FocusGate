import { useEffect, useState } from "react";

/**
 * A text box that saves when the person leaves it (or presses Enter in the
 * one-line version). It shows the saved value until they type.
 */
export function InlineText({
  id,
  label,
  value,
  placeholder,
  maxLength,
  multiline = false,
  className = "",
  onCommit,
}: {
  id: string;
  label: string;
  value: string;
  placeholder: string;
  maxLength: number;
  multiline?: boolean;
  className?: string;
  onCommit(next: string): void;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);

  const commit = (): void => {
    if (draft.trim() !== value) onCommit(draft);
  };

  if (multiline) {
    return (
      <textarea
        id={id}
        className={`fg-textarea ${className}`.trim()}
        aria-label={label}
        rows={2}
        value={draft}
        maxLength={maxLength}
        placeholder={placeholder}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
      />
    );
  }
  return (
    <input
      id={id}
      className={`fg-input fg-inline ${className}`.trim()}
      aria-label={label}
      type="text"
      value={draft}
      maxLength={maxLength}
      placeholder={placeholder}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
      }}
    />
  );
}
