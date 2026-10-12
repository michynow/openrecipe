"use client";

import { useRef, useState } from "react";

import { IngredientSprite } from "@/components/pixel-sprite";
import { GripButton, RowButton } from "@/components/section-card";
import { reorder, useSortable } from "@/components/use-sortable";
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
 * Rows reorder by dragging the grip, or with the arrow keys on it — drag-only
 * reordering is unusable without a mouse, and this is the most-used form in
 * the app. Every row shows a pixel sprite for its item (lib/ingredient-sprites).
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
  const { list, dragging, handleProps } = useSortable((from, to) =>
    onChange(reorder(values, from, to)),
  );

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
      {/* Column captions from sm up; below that each field carries its own. */}
      <div
        aria-hidden
        className="hidden items-end gap-2 text-sm font-extrabold uppercase tracking-wide sm:flex"
      >
        <span className="w-11 shrink-0" />
        <span className="w-11 shrink-0" />
        <span className="w-24 shrink-0">{copy.editor.quantity}</span>
        <span className="w-28 shrink-0">{copy.editor.unit}</span>
        <span className="min-w-32 flex-1">{copy.editor.item}</span>
        <span className="min-w-28 flex-1">{copy.editor.note}</span>
        <span className="w-11 shrink-0" />
      </div>

      <ol ref={list} className="flex flex-col">
        {values.map((line, index) => {
          const itemError = errors[`ingredientLines.${index}.item`];
          const quantityError = errors[`ingredientLines.${index}.quantity`];

          return (
            <li
              key={index}
              /* Rules between rows: eight ingredients otherwise read as one block. */
              className={`flex flex-col gap-1 border-t-2 border-line/15 py-2 first:border-t-0 first:pt-0 ${
                dragging === index ? "rounded-input bg-fill" : ""
              }`}
            >
              <div className="flex flex-wrap items-end gap-2 sm:flex-nowrap">
                <GripButton
                  label={`${copy.editor.reorder}: ${line.item || index + 1}`}
                  active={dragging === index}
                  {...handleProps(index, values.length)}
                />

                {/* Updates as you type the item — a quiet "yes, I know what that is". */}
                <span className="flex size-11 shrink-0 items-center justify-center rounded-input border border-line bg-[var(--px-w)]">
                  <IngredientSprite item={line.item} className="size-8" />
                </span>

                <Labelled caption={copy.editor.quantity} className="w-24">
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
                    className="w-full rounded-input border border-line bg-bg px-2 py-2 font-mono"
                  />
                </Labelled>

                <Labelled caption={copy.editor.unit} className="w-28">
                  <input
                    aria-label={`${copy.editor.unit} ${index + 1}`}
                    value={line.unit ?? ""}
                    placeholder={copy.editor.unitPlaceholder}
                    onChange={(event) =>
                      update(index, { unit: event.target.value || null })
                    }
                    className="w-full rounded-input border border-line bg-bg px-2 py-2"
                  />
                </Labelled>

                <Labelled caption={copy.editor.item} className="min-w-32 flex-1">
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
                    className="w-full rounded-input border border-line bg-bg px-3 py-2 font-bold"
                  />
                </Labelled>

                <Labelled caption={copy.editor.note} className="min-w-28 flex-1">
                  <input
                    aria-label={`${copy.editor.note} ${index + 1}`}
                    value={line.note ?? ""}
                    placeholder={copy.editor.notePlaceholder}
                    onChange={(event) =>
                      update(index, { note: event.target.value || null })
                    }
                    className="w-full rounded-input border border-line bg-bg px-3 py-2"
                  />
                </Labelled>

                <RowButton
                  icon="remove"
                  label={`${copy.common.delete}: ${line.item || index + 1}`}
                  onClick={() => remove(index)}
                  destructive
                />
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
          className="rounded-input border border-line px-3 py-1.5 text-sm font-bold text-text"
        >
          {copy.editor.addIngredient}
        </button>
        <button
          type="button"
          onClick={() => setPasteOpen((open) => !open)}
          className="rounded-input border border-line px-3 py-1.5 text-sm font-bold text-text"
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

/**
 * A field with its caption visible on a phone, where the column headings are
 * hidden, and screen-reader-only from sm up, where the headings say it.
 */
function Labelled({
  caption,
  className,
  children,
}: {
  caption: string;
  className: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`flex shrink-0 flex-col gap-0.5 ${className}`}>
      <span aria-hidden className="text-sm font-extrabold uppercase tracking-wide sm:sr-only">
        {caption}
      </span>
      {children}
    </div>
  );
}
