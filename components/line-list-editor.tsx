"use client";

import { useRef } from "react";

import { copy } from "@/lib/copy";

/**
 * An ordered list of short single-line strings — Steps and Tips both.
 *
 * Reordering works by keyboard as well as by the buttons: drag-only reordering is
 * unusable without a mouse, and this form gets a lot of use.
 */
export function LineListEditor({
  id,
  label,
  values,
  onChange,
  addLabel,
  placeholder,
  numbered = false,
  error,
}: {
  id: string;
  label: string;
  values: string[];
  onChange: (next: string[]) => void;
  addLabel: string;
  placeholder?: string;
  numbered?: boolean;
  error?: string;
}) {
  /** Focus the input we just created, rather than leaving focus on the button. */
  const focusNext = useRef<number | null>(null);

  function update(index: number, value: string) {
    const next = [...values];
    next[index] = value;
    onChange(next);
  }

  function add() {
    focusNext.current = values.length;
    onChange([...values, ""]);
  }

  function remove(index: number) {
    onChange(values.filter((_, i) => i !== index));
  }

  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= values.length) return;
    const next = [...values];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
    // Keep focus with the line that moved, so repeated presses keep working.
    focusNext.current = target;
  }

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm text-muted">{label}</legend>

      <ol className="flex flex-col gap-2">
        {values.map((value, index) => (
          <li key={index} className="flex items-start gap-2">
            {numbered && (
              <span
                aria-hidden
                className="mt-2.5 w-5 shrink-0 text-right font-mono text-xs text-muted"
              >
                {index + 1}.
              </span>
            )}

            <input
              id={index === 0 ? id : `${id}.${index}`}
              aria-label={`${label} ${index + 1}`}
              value={value}
              placeholder={placeholder}
              onChange={(event) => update(index, event.target.value)}
              ref={(node) => {
                if (node && focusNext.current === index) {
                  node.focus();
                  focusNext.current = null;
                }
              }}
              className="min-w-0 flex-1 rounded-input border border-line bg-surface px-3 py-2"
            />

            <span className="flex shrink-0 items-center">
              <button
                type="button"
                onClick={() => move(index, -1)}
                disabled={index === 0}
                aria-label={`${copy.editor.moveUp}: ${label} ${index + 1}`}
                className="px-2 py-2 text-muted disabled:opacity-30"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => move(index, 1)}
                disabled={index === values.length - 1}
                aria-label={`${copy.editor.moveDown}: ${label} ${index + 1}`}
                className="px-2 py-2 text-muted disabled:opacity-30"
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => remove(index)}
                aria-label={`${copy.common.delete}: ${label} ${index + 1}`}
                className="px-2 py-2 text-accent2"
              >
                ×
              </button>
            </span>
          </li>
        ))}
      </ol>

      {error && (
        <p role="alert" className="text-sm text-accent2">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={add}
        className="self-start rounded-input border border-line px-3 py-1.5 text-sm text-muted transition-colors hover:text-text"
      >
        {addLabel}
      </button>
    </fieldset>
  );
}
