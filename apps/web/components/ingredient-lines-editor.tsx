"use client";

import { useRef, useState } from "react";

import { IngredientSprite } from "@/components/pixel-sprite";
import { GripButton, RowButton } from "@/components/section-card";
import { useSortable } from "@/components/use-sortable";
import { copy } from "@openrecipe/core/copy";
import type { FieldErrors } from "@openrecipe/core/form-errors";
import { parseIngredientBlock } from "@openrecipe/core/parse-ingredient";
import type { RecipeFormValue } from "@openrecipe/core/recipe-schema";
import {
  addSection,
  cleanSection,
  groupSections,
  moveLine,
  removeSection,
  renameSection,
  sectionNames,
  setLineSection,
} from "@openrecipe/core/sections";

type Line = RecipeFormValue["ingredientLines"][number];

const blankLine: Line = {
  quantity: null,
  unit: null,
  item: "",
  note: null,
  section: null,
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
  const [sectionOpen, setSectionOpen] = useState(false);
  const [sectionDraft, setSectionDraft] = useState("");
  const focusRow = useRef<number | null>(null);
  const { list, dragging, handleProps } = useSortable((from, to) =>
    onChange(moveLine(values, from, to)),
  );

  function update(index: number, patch: Partial<Line>) {
    onChange(values.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  function add() {
    focusRow.current = values.length;
    onChange([...values, { ...blankLine }]);
  }

  /** A blank line at the end of `name`'s group; focus lands on its item field. */
  function addToSection(name: string) {
    const next = addSection(values, name, blankLine);
    const clean = cleanSection(name);
    focusRow.current = next.findLastIndex((line) => line.section === clean);
    onChange(next);
  }

  function confirmSection() {
    const name = sectionDraft.trim();
    if (!name) return;
    addToSection(name);
    setSectionDraft("");
    setSectionOpen(false);
  }

  function remove(index: number) {
    // Focus the row that slides into this position, or the previous one at the end.
    focusRow.current = Math.min(index, values.length - 2);
    onChange(values.filter((_, i) => i !== index));
  }

  function applyPaste() {
    const parsed = parseIngredientBlock(pasteText).map((line) => ({
      ...line,
      section: null,
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
  const names = sectionNames(values);
  /** Index of the first line of each named group → that group's name. */
  const headings = new Map(
    groupSections(values).flatMap((group) =>
      group.section === null ? [] : [[group.items[0].index, group.section] as const],
    ),
  );

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
        <span className="grid flex-1 grid-cols-[5rem_6rem_minmax(0,1fr)_minmax(0,1fr)] gap-2">
          <span>{copy.editor.quantity}</span>
          <span>{copy.editor.unit}</span>
          <span>{copy.editor.item}</span>
          <span>{copy.editor.note}</span>
        </span>
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
              {headings.has(index) && (
                <SectionHeading
                  name={headings.get(index)!}
                  onRename={(next) => onChange(renameSection(values, headings.get(index)!, next))}
                  onRemove={() => onChange(removeSection(values, headings.get(index)!))}
                  onAdd={() => addToSection(headings.get(index)!)}
                />
              )}
              <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap sm:items-end">
                <GripButton
                  label={`${copy.editor.reorder}: ${line.item || index + 1}`}
                  active={dragging === index}
                  {...handleProps(index, values.length)}
                />

                {/* Updates as you type the item — a quiet "yes, I know what that is". */}
                <span className="flex size-11 shrink-0 items-center justify-center rounded-input border border-line bg-[var(--px-w)]">
                  <IngredientSprite item={line.item} className="size-8" />
                </span>

                {/*
                  On a phone the fields drop below the grip/sprite/delete bar into two
                  columns (item and note full width); from sm up they sit in the row.
                */}
                <div className="order-last grid min-w-0 basis-full grid-cols-2 gap-2 sm:order-none sm:flex-1 sm:basis-auto sm:grid-cols-[5rem_6rem_minmax(0,1fr)_minmax(0,1fr)]">
                  <Labelled caption={copy.editor.quantity}>
                    <input
                      id={`ingredientLines.${index}.quantity`}
                      aria-label={`${copy.editor.quantity} ${index + 1}`}
                      inputMode="decimal"
                      value={line.quantity === null ? "" : String(line.quantity)}
                      placeholder={copy.editor.quantityPlaceholder}
                      onChange={(event) =>
                        update(index, {
                          quantity: numberOrNull(event.target.value),
                        })
                      }
                      aria-invalid={quantityError ? true : undefined}
                      className="w-full rounded-input border border-line bg-bg px-2 py-2 font-mono"
                    />
                  </Labelled>

                  <Labelled caption={copy.editor.unit}>
                    <input
                      aria-label={`${copy.editor.unit} ${index + 1}`}
                      value={line.unit ?? ""}
                      placeholder={copy.editor.unitPlaceholder}
                      onChange={(event) => update(index, { unit: event.target.value || null })}
                      className="w-full rounded-input border border-line bg-bg px-2 py-2"
                    />
                  </Labelled>

                  <Labelled caption={copy.editor.item} className="col-span-2 sm:col-span-1">
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

                  <Labelled caption={copy.editor.note} className="col-span-2 sm:col-span-1">
                    <input
                      aria-label={`${copy.editor.note} ${index + 1}`}
                      value={line.note ?? ""}
                      placeholder={copy.editor.notePlaceholder}
                      onChange={(event) => update(index, { note: event.target.value || null })}
                      className="w-full rounded-input border border-line bg-bg px-3 py-2"
                    />
                  </Labelled>
                </div>

                <span className="ml-auto sm:ml-0">
                  <RowButton
                    icon="remove"
                    label={`${copy.common.delete}: ${line.item || index + 1}`}
                    onClick={() => remove(index)}
                    destructive
                  />
                </span>
              </div>

              <label className="flex items-center gap-2 pl-1 text-sm text-muted sm:pl-12">
                {copy.editor.moveToSection}
                <select
                  value={line.section ?? ""}
                  onChange={(event) =>
                    onChange(setLineSection(values, index, event.target.value || null))
                  }
                  className="min-w-0 rounded-input border border-line bg-bg px-2 py-1 text-text"
                >
                  <option value="">{copy.editor.noSection}</option>
                  {names.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>

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
          onClick={() => setSectionOpen((open) => !open)}
          className="rounded-input border border-line px-3 py-1.5 text-sm font-bold text-text"
        >
          {copy.editor.addSection}
        </button>
        <button
          type="button"
          onClick={() => setPasteOpen((open) => !open)}
          className="rounded-input border border-line px-3 py-1.5 text-sm font-bold text-text"
        >
          {copy.editor.pasteBlock}
        </button>
      </div>

      {names.length === 0 && !sectionOpen && (
        <p className="text-sm text-muted">{copy.editor.sectionsHint}</p>
      )}

      {sectionOpen && (
        <div className="flex gap-2">
          <input
            autoFocus
            aria-label={copy.editor.sectionName}
            value={sectionDraft}
            placeholder={copy.editor.sectionPlaceholder}
            onChange={(event) => setSectionDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault(); // inside the recipe form: Enter must not submit it
              confirmSection();
            }}
            className="min-w-0 flex-1 rounded-input border border-line bg-bg px-3 py-2 font-bold"
          />
          <button
            type="button"
            onClick={confirmSection}
            className="rounded-input bg-accent px-3 py-1.5 text-sm font-medium text-accent-ink"
          >
            {copy.editor.addSection}
          </button>
        </div>
      )}

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
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`flex min-w-0 flex-col gap-0.5 ${className ?? ""}`}>
      <span aria-hidden className="text-sm font-extrabold uppercase tracking-wide sm:sr-only">
        {caption}
      </span>
      {children}
    </div>
  );
}

/** The heading over a Section's first line: rename on blur/Enter, remove, add a line. */
function SectionHeading({
  name,
  onRename,
  onRemove,
  onAdd,
}: {
  name: string;
  onRename: (next: string) => void;
  onRemove: () => void;
  onAdd: () => void;
}) {
  return (
    <div className="mb-2 flex items-center gap-2 rounded-input bg-fill px-2 py-1">
      <input
        key={name}
        aria-label={copy.editor.sectionName}
        defaultValue={name}
        onBlur={(event) => {
          if (event.target.value !== name) onRename(event.target.value);
        }}
        onKeyDown={(event) => {
          if (event.key !== "Enter") return;
          event.preventDefault();
          event.currentTarget.blur();
        }}
        className="min-w-0 flex-1 rounded-input border border-line bg-bg px-2 py-1 font-display text-lg uppercase tracking-wide"
      />
      <button
        type="button"
        onClick={onAdd}
        className="shrink-0 rounded-input border border-line px-2 py-1 text-sm font-bold text-text"
      >
        + {copy.editor.addIngredient}
      </button>
      <span title={copy.editor.removeSectionHint}>
        <RowButton
          icon="remove"
          label={`${copy.editor.removeSection}: ${name}`}
          onClick={onRemove}
          destructive
        />
      </span>
    </div>
  );
}
