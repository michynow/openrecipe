"use client";

import { useRef } from "react";

import { GripButton, RowButton } from "@/components/section-card";
import { reorder, useSortable } from "@/components/use-sortable";
import { copy } from "@/lib/copy";

/**
 * An ordered list of text lines — Steps and Tips both.
 *
 * Each line is a textarea that grows with its content: a Step that runs to
 * three sentences used to scroll sideways inside a one-line input, which was
 * miserable to write and impossible to proofread. Rows reorder by dragging the
 * grip, or with the arrow keys on it.
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
  /** Focus the textarea we just created, rather than leaving focus on the button. */
  const focusNext = useRef<number | null>(null);
  const { list, dragging, handleProps } = useSortable((from, to) =>
    onChange(reorder(values, from, to)),
  );

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

  return (
    <>
      <ol ref={list} className="flex flex-col">
        {values.map((value, index) => (
          <li
            key={index}
            className={`flex items-start gap-2 border-t-2 border-line/15 py-2 first:border-t-0 first:pt-0 ${
              dragging === index ? "rounded-input bg-fill" : ""
            }`}
          >
            <GripButton
              label={`${copy.editor.reorder}: ${label} ${index + 1}`}
              active={dragging === index}
              {...handleProps(index, values.length)}
            />

            {/*
              Steps count, Tips do not. The em-dash keeps Tips in the same column
              as Steps' numerals, so the two lists read as different kinds of thing.
            */}
            <span
              aria-hidden
              className="mt-2.5 w-6 shrink-0 text-right font-mono text-base font-bold text-accent"
            >
              {numbered ? `${index + 1}.` : "—"}
            </span>

            <textarea
              id={index === 0 ? id : `${id}.${index}`}
              aria-label={`${label} ${index + 1}`}
              value={value}
              placeholder={placeholder}
              rows={2}
              onChange={(event) => update(index, event.target.value)}
              ref={(node) => {
                if (node && focusNext.current === index) {
                  node.focus();
                  focusNext.current = null;
                }
              }}
              className="field-sizing-content min-h-[4.5rem] min-w-0 flex-1 resize-y rounded-input border border-line bg-bg px-3 py-2 leading-relaxed"
            />

            <RowButton
              icon="remove"
              label={`${copy.common.delete}: ${label} ${index + 1}`}
              onClick={() => remove(index)}
              destructive
            />
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
        className="self-start rounded-input border border-line px-3 py-2 text-sm font-bold text-text"
      >
        {addLabel}
      </button>
    </>
  );
}
