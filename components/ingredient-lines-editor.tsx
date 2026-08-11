"use client";

import { useRef, useState } from "react";

import { RowButton } from "@/components/section-card";
import { copy } from "@/lib/copy";
import type { FieldErrors } from "@/lib/form-errors";
import { parseIngredientBlock } from "@/lib/parse-ingredient";
import type { RecipeFormValue } from "@/lib/recipe-schema";

type Line = RecipeFormValue["ingredientLines"][number];

const blankLine: Line = {
  quantity: null,
  unit: null,
  item: "",
  note: null,
  substitutes: [],
};

/**
 * The ingredients list.
 *
 * Two ways in: type row by row, or paste a block and let it split. The split is a
 * convenience and lands in editable inputs, so a wrong guess costs one keystroke —
 * see lib/parse-ingredient.ts for why it is deliberately naive.
 *
 * Reorder works by keyboard as well as by button. Drag-only reordering is unusable
 * without a mouse, and this is the most-used form in the app.
 */
export function IngredientLinesEditor({
  values,
  onChange,
  errors,
}: {
  values: Line[];
  onChange: (next: Line[]) => void;
  errors: FieldErrors;
}) {
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const focusRow = useRef<number | null>(null);

  function update(index: number, patch: Partial<Line>) {
    onChange(values.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  function add() {
    focusRow.current = values.length;
    onChange([...values, { ...blankLine }]);
  }

  function remove(index: number) {
    // Focus the row that slides into this position, or the previous one at the end.
    focusRow.current = Math.min(index, values.length - 2);
    onChange(values.filter((_, i) => i !== index));
  }

  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= values.length) return;
    const next = [...values];
    [next[index], next[target]] = [next[target], next[index]];
    focusRow.current = target;
    onChange(next);
  }

  function applyPaste() {
    const parsed = parseIngredientBlock(pasteText).map((line) => ({
      ...line,
      substitutes: [],
    }));
    if (parsed.length === 0) return;

    // Drop a single empty starter row rather than leaving a blank line above.
    const existing = values.filter((line) => line.item.trim() !== "");
    onChange([...existing, ...parsed]);
    setPasteText("");
    setPasteOpen(false);
  }

  /** A number input's value, or null for blank — blank means "do smaku". */
  const numberOrNull = (raw: string) => (raw === "" ? null : Number(raw));

  return (
    <>
      <ol className="flex flex-col">
        {values.map((line, index) => {
          const itemError = errors[`ingredientLines.${index}.item`];
          const quantityError = errors[`ingredientLines.${index}.quantity`];

          return (
            <li
              key={index}
              /* Hairlines between rows: eight ingredients otherwise read as one block. */
              className="flex flex-col gap-1 border-t border-line/60 py-2 first:border-t-0 first:pt-0"
            >
              <div className="flex flex-wrap items-start gap-2 sm:flex-nowrap">
                {/* Same numbering language as Steps, which ingredients lacked. */}
                <span
                  aria-hidden
                  className="mt-3 w-5 shrink-0 text-right font-mono text-xs text-muted"
                >
                  {index + 1}
                </span>

                <input
                  id={`ingredientLines.${index}.quantity`}
                  aria-label={`${copy.editor.quantity} ${index + 1}`}
                  inputMode="decimal"
                  value={line.quantity === null ? "" : String(line.quantity)}
                  placeholder={copy.editor.quantityPlaceholder}
                  onChange={(event) =>
                    update(index, { quantity: numberOrNull(event.target.value) })
                  }
                  aria-invalid={quantityError ? true : undefined}
                  className="w-20 rounded-input border border-line bg-bg px-2 py-2 font-mono"
                />

                <input
                  aria-label={`${copy.editor.unit} ${index + 1}`}
                  value={line.unit ?? ""}
                  placeholder={copy.editor.unitPlaceholder}
                  onChange={(event) =>
                    update(index, { unit: event.target.value || null })
                  }
                  className="w-24 rounded-input border border-line bg-bg px-2 py-2"
                />

                <input
                  id={`ingredientLines.${index}.item`}
                  aria-label={`${copy.editor.item} ${index + 1}`}
                  value={line.item}
                  placeholder={copy.editor.itemPlaceholder}
                  onChange={(event) => update(index, { item: event.target.value })}
                  ref={(node) => {
                    if (node && focusRow.current === index) {
                      node.focus();
                      focusRow.current = null;
                    }
                  }}
                  aria-invalid={itemError ? true : undefined}
                  className="min-w-32 flex-1 rounded-input border border-line bg-bg px-3 py-2"
                />

                <input
                  aria-label={`${copy.editor.note} ${index + 1}`}
                  value={line.note ?? ""}
                  placeholder={copy.editor.notePlaceholder}
                  onChange={(event) =>
                    update(index, { note: event.target.value || null })
                  }
                  className="min-w-28 flex-1 rounded-input border border-line bg-bg px-3 py-2"
                />

                <span className="flex shrink-0 items-center">
                  <RowButton
                    icon="up"
                    label={`${copy.editor.moveUp}: ${index + 1}`}
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                  />
                  <RowButton
                    icon="down"
                    label={`${copy.editor.moveDown}: ${index + 1}`}
                    onClick={() => move(index, 1)}
                    disabled={index === values.length - 1}
                  />
                  <RowButton
                    icon="remove"
                    label={`${copy.common.delete}: ${index + 1}`}
                    onClick={() => remove(index)}
                    destructive
                  />
                </span>
              </div>

              {(itemError || quantityError) && (
                <p role="alert" className="text-sm text-accent2">
                  {itemError ?? quantityError}
                </p>
              )}
            </li>
          );
        })}
      </ol>

      {errors.ingredientLines && (
        <p role="alert" className="text-sm text-accent2">
          {errors.ingredientLines}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={add}
          className="rounded-input border border-line px-3 py-1.5 text-sm text-muted transition-colors hover:text-text"
        >
          {copy.editor.addIngredient}
        </button>
        <button
          type="button"
          onClick={() => setPasteOpen((open) => !open)}
          className="rounded-input border border-line px-3 py-1.5 text-sm text-muted transition-colors hover:text-text"
        >
          {copy.editor.pasteBlock}
        </button>
      </div>

      {pasteOpen && (
        <div className="flex flex-col gap-2 rounded-card border border-line bg-bg p-3">
          <label htmlFor="paste-ingredients" className="text-sm text-muted">
            {copy.editor.pasteHint}
          </label>
          <textarea
            id="paste-ingredients"
            rows={6}
            value={pasteText}
            onChange={(event) => setPasteText(event.target.value)}
            className="rounded-input border border-line bg-surface px-3 py-2 font-mono text-sm"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={applyPaste}
              className="rounded-input bg-accent px-3 py-1.5 text-sm font-medium text-accent-ink"
            >
              {copy.editor.pasteApply}
            </button>
            <button
              type="button"
              onClick={() => {
                setPasteOpen(false);
                setPasteText("");
              }}
              className="rounded-input border border-line px-3 py-1.5 text-sm text-muted"
            >
              {copy.editor.cancel}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
