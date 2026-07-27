"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { LineListEditor } from "@/components/line-list-editor";
import { copy } from "@/lib/copy";
import { firstErrorField, toFieldErrors, type FieldErrors } from "@/lib/form-errors";
import { recipeSchema, type RecipeInput } from "@/lib/recipe-schema";
import type { SaveResult } from "@/lib/recipes";

/**
 * The Recipe editor. One form over the Recipe shape.
 *
 * Deliberately NOT a "new recipe page": Phase 4 mounts this same component to
 * review an imported Draft, so it takes a value and a submit handler and knows
 * nothing about where either comes from.
 *
 * Ingredient Lines (OR-20), the Tag picker (OR-21) and image upload (OR-22) slot
 * in as children — this ticket covers the shell, the scalar fields, Steps, Tips,
 * validation and the unsaved-changes guard.
 */

export type RecipeEditorValue = RecipeInput;

/** Focus order, which is the form's order rather than Zod's report order. */
const FIELD_ORDER = [
  "title",
  "servings",
  "totalMinutes",
  "kcalPerServing",
  "sourceUrl",
  "ingredientLines",
  "steps",
  "tips",
  "tagSlugs",
] as const;

export const emptyRecipe: RecipeEditorValue = {
  title: "",
  servings: 4,
  totalMinutes: null,
  kcalPerServing: null,
  sourceUrl: null,
  imageUrl: null,
  ingredientLines: [],
  steps: [""],
  tips: [],
  tagSlugs: [],
};

export function RecipeEditor({
  initial,
  onSubmit,
  heading,
  children,
}: {
  initial?: RecipeEditorValue;
  /** Returns a SaveResult; the editor renders its errors rather than throwing. */
  onSubmit: (value: RecipeEditorValue) => Promise<SaveResult>;
  heading: string;
  /** Slot for Ingredient Lines, Tags and image — their own tickets. */
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const [value, setValue] = useState<RecipeEditorValue>(initial ?? emptyRecipe);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [pending, setPending] = useState(false);
  const [dirty, setDirty] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  /**
   * Warn before losing work. Only covers full page unloads — Next's client-side
   * navigation does not fire beforeunload, so the nav links also confirm below.
   */
  useEffect(() => {
    if (!dirty || pending) return;

    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, pending]);

  function set<K extends keyof RecipeEditorValue>(
    key: K,
    next: RecipeEditorValue[K],
  ) {
    setDirty(true);
    setValue((current) => ({ ...current, [key]: next }));
  }

  /** Validate one field on blur, without shouting about the fields still empty. */
  function validateField(field: string) {
    const result = recipeSchema.safeParse(value);
    if (result.success) {
      setErrors({});
      return;
    }
    const all = toFieldErrors(result.error);
    setErrors((current) => {
      const next = { ...current };
      if (all[field]) next[field] = all[field];
      else delete next[field];
      return next;
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return; // belt and braces; the button is disabled too

    const parsed = recipeSchema.safeParse(value);
    if (!parsed.success) {
      const fieldErrors = toFieldErrors(parsed.error);
      setErrors(fieldErrors);

      // Move focus to the first offending field so keyboard users are not left
      // hunting for what went wrong.
      const target = firstErrorField(fieldErrors, FIELD_ORDER);
      if (target) {
        const node = formRef.current?.querySelector<HTMLElement>(
          `[id="${CSS.escape(target)}"]`,
        );
        node?.focus();
        node?.scrollIntoView({ block: "center", behavior: "smooth" });
      }
      return;
    }

    setPending(true);
    const result = await onSubmit(parsed.data as RecipeEditorValue);

    if (!result.ok) {
      // Server rejection surfaces on the form, never as a thrown page.
      setErrors({ _form: result.errors.join(" ") });
      setPending(false);
      return;
    }

    // Clear the guard before navigating, or it fires on our own redirect.
    setDirty(false);
    router.push(`/recipes/${result.slug}`);
  }

  function cancel() {
    if (dirty && !window.confirm(copy.editor.unsavedChanges)) return;
    setDirty(false);
    router.back();
  }

  const numberOrNull = (raw: string) => (raw === "" ? null : Number(raw));

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      noValidate
      className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6"
    >
      <h1 className="font-display text-3xl uppercase tracking-tight">{heading}</h1>

      <Field
        id="title"
        label={copy.editor.title}
        error={errors.title}
        required
      >
        <input
          id="title"
          value={value.title}
          onChange={(event) => set("title", event.target.value)}
          onBlur={() => validateField("title")}
          aria-invalid={errors.title ? true : undefined}
          aria-describedby={errors.title ? "title-error" : undefined}
          className="rounded-input border border-line bg-surface px-3 py-2"
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field
          id="servings"
          label={copy.recipe.servings}
          error={errors.servings}
          required
        >
          <input
            id="servings"
            type="number"
            inputMode="numeric"
            min={1}
            max={99}
            value={value.servings as number}
            onChange={(event) => set("servings", Number(event.target.value))}
            onBlur={() => validateField("servings")}
            aria-invalid={errors.servings ? true : undefined}
            aria-describedby={errors.servings ? "servings-error" : undefined}
            className="rounded-input border border-line bg-surface px-3 py-2 font-mono"
          />
        </Field>

        <Field
          id="totalMinutes"
          label={copy.editor.totalMinutes}
          error={errors.totalMinutes}
          hint={copy.editor.optional}
        >
          <input
            id="totalMinutes"
            type="number"
            inputMode="numeric"
            value={(value.totalMinutes as number | null) ?? ""}
            onChange={(event) =>
              set("totalMinutes", numberOrNull(event.target.value))
            }
            onBlur={() => validateField("totalMinutes")}
            aria-invalid={errors.totalMinutes ? true : undefined}
            className="rounded-input border border-line bg-surface px-3 py-2 font-mono"
          />
        </Field>

        <Field
          id="kcalPerServing"
          label={copy.editor.kcal}
          error={errors.kcalPerServing}
          hint={copy.editor.optional}
        >
          <input
            id="kcalPerServing"
            type="number"
            inputMode="numeric"
            value={(value.kcalPerServing as number | null) ?? ""}
            onChange={(event) =>
              set("kcalPerServing", numberOrNull(event.target.value))
            }
            onBlur={() => validateField("kcalPerServing")}
            aria-invalid={errors.kcalPerServing ? true : undefined}
            className="rounded-input border border-line bg-surface px-3 py-2 font-mono"
          />
        </Field>
      </div>

      {/* Ingredient Lines, Tag picker and image upload mount here. */}
      {children}

      <LineListEditor
        id="steps"
        label={copy.recipe.steps}
        values={value.steps as string[]}
        onChange={(next) => set("steps", next)}
        addLabel={copy.editor.addStep}
        placeholder={copy.editor.stepPlaceholder}
        numbered
        error={errors.steps}
      />

      <LineListEditor
        id="tips"
        label={copy.recipe.tips}
        values={value.tips as string[]}
        onChange={(next) => set("tips", next)}
        addLabel={copy.editor.addTip}
        placeholder={copy.editor.tipPlaceholder}
        error={errors.tips}
      />

      <Field
        id="sourceUrl"
        label={copy.editor.sourceUrl}
        error={errors.sourceUrl}
        hint={copy.editor.optional}
      >
        <input
          id="sourceUrl"
          type="url"
          value={(value.sourceUrl as string | null) ?? ""}
          onChange={(event) => set("sourceUrl", event.target.value || null)}
          onBlur={() => validateField("sourceUrl")}
          aria-invalid={errors.sourceUrl ? true : undefined}
          aria-describedby={errors.sourceUrl ? "sourceUrl-error" : undefined}
          className="rounded-input border border-line bg-surface px-3 py-2"
        />
      </Field>

      {/* Whole-form failure: a server rejection, or a summary after blocked submit. */}
      {(errors._form || Object.keys(errors).length > 0) && (
        <p id="form-error" role="alert" className="text-sm text-accent2">
          {errors._form ?? copy.editor.fixErrors}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-input bg-accent px-4 py-2.5 font-medium text-accent-ink transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {pending ? copy.editor.saving : copy.editor.save}
        </button>
        <button
          type="button"
          onClick={cancel}
          disabled={pending}
          className="rounded-input border border-line px-4 py-2.5 text-muted transition-colors hover:text-text disabled:opacity-50"
        >
          {copy.editor.cancel}
        </button>
      </div>
    </form>
  );
}

function Field({
  id,
  label,
  error,
  hint,
  required,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm text-muted">
        {label}
        {hint && !required && (
          <span className="ml-1 text-xs opacity-60">({hint})</span>
        )}
      </label>
      {children}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-sm text-accent2">
          {error}
        </p>
      )}
    </div>
  );
}
