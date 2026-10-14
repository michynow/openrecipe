import { z } from "zod";

// Explicit .ts extension: `node --test` strips types but does no extension
// resolution, so anything reachable from a test must be imported this way.
import { copy } from "./copy.ts";

/**
 * The single definition of a valid Recipe. PRD §12.
 *
 * Used by three callers with different trust levels:
 *   - the editor form, as a convenience
 *   - the Server Action, unconditionally — it never trusts the client's word
 *   - the Worker, to constrain the model's structured output
 *
 * Imports nothing Next-specific and nothing from the DOM, so the Worker (a plain
 * Node script on a laptop) can use it. See ADR-0002.
 */

const v = copy.validation;

/**
 * Empty form fields arrive as "". That means absent, not zero and not "".
 * Mapping to null before parsing keeps `z.coerce.number()` from turning an
 * untouched field into 0.
 */
const absentToNull = (raw: unknown) =>
  raw === "" || raw === undefined ? null : raw;

const nullableInt = (min: number, max: number, error: string) =>
  z.preprocess(
    absentToNull,
    z.union([z.null(), z.coerce.number().int().min(min, error).max(max, error)]),
  );

const nullableText = (max: number) =>
  z.preprocess(
    absentToNull,
    z.union([z.null(), z.string().trim().min(1).max(max)]),
  );

/**
 * http(s) only — no javascript: or data: URLs reaching an href.
 *
 * One check that parses, rather than `.url()` followed by a refinement reading
 * `new URL(value).protocol`. Zod 4 keeps running later checks after an earlier
 * one fails, so that shape called `new URL()` on strings already known not to be
 * URLs and threw TypeError out of the parse — crashing the Server Action instead
 * of returning "Podaj poprawny link".
 */
export const httpUrlSchema = z
  .string()
  .trim()
  .refine((value) => {
    try {
      const { protocol } = new URL(value);
      return protocol === "http:" || protocol === "https:";
    } catch {
      return false;
    }
  }, v.urlInvalid);

const nullableHttpUrl = z.preprocess(
  absentToNull,
  z.union([z.null(), httpUrlSchema]),
);

/** A stand-in for an Ingredient Line's item. Worker-generated, stored, not fetched. */
/** Whether a value is an http(s) URL — the one check for "may this be opened as a link". */
export const isHttpUrl = (value: unknown): value is string => httpUrlSchema.safeParse(value).success;

export const substituteSchema = z.object({
  item: z.string().trim().min(1).max(80),
  note: nullableText(200),
});

export const ingredientLineSchema = z.object({
  /** null means "to taste" — a real state, not missing data. Never negative. */
  quantity: z.preprocess(
    absentToNull,
    z.union([z.null(), z.coerce.number().min(0, v.quantityPositive).max(100_000)]),
  ),
  unit: nullableText(20),
  item: z.string().trim().min(1, v.itemRequired).max(80, v.itemRequired),
  note: nullableText(200),
  substitutes: z.array(substituteSchema).max(5).default([]),
});

const shortLine = z.string().trim().min(1).max(300, v.lineTooLong);

export const MAX_TAGS = 5;

export const recipeSchema = z.object({
  title: z.string().trim().min(1, v.titleRequired).max(120, v.titleRequired),

  servings: z.coerce
    .number({ error: v.servingsRequired })
    .int(v.servingsRange)
    .min(1, v.servingsRange)
    .max(99, v.servingsRange),

  totalMinutes: nullableInt(1, 10_080, v.totalMinutesRange),
  kcalPerServing: nullableInt(0, 10_000, v.kcalRange),

  sourceUrl: nullableHttpUrl,
  imageUrl: nullableHttpUrl,

  ingredientLines: z
    .array(ingredientLineSchema)
    .min(1, v.ingredientsRequired),

  steps: z.array(shortLine).min(1, v.stepsRequired),
  tips: z.array(shortLine).default([]),

  /**
   * Tag slugs, English, at most 5 in any mix of Facets. That each slug exists is
   * enforced by the foreign key rather than duplicated here — a Zod schema has no
   * way to know what the tag table currently holds, and the Master can add rows
   * at runtime (OR-50).
   */
  tagSlugs: z
    .array(z.string().trim().min(1))
    .max(MAX_TAGS, v.tagsTooMany)
    .refine((slugs) => new Set(slugs).size === slugs.length, v.tagsDuplicate)
    .default([]),
});

export type RecipeInput = z.input<typeof recipeSchema>;
export type Recipe = z.output<typeof recipeSchema>;
export type IngredientLine = z.output<typeof ingredientLineSchema>;
export type Substitute = z.output<typeof substituteSchema>;

/** Image rules from PRD §12, as data — no DOM types, so the Worker can reuse them. */
export const IMAGE_RULES = {
  maxBytes: 5 * 1024 * 1024,
  mimeTypes: ["image/jpeg", "image/png", "image/webp"],
} as const;

/**
 * What the bytes actually are, from their magic numbers, or null for anything
 * that is not one of IMAGE_RULES' types. A declared Content-Type is the
 * client's word; this is the file's.
 */
export function sniffImageType(bytes: Uint8Array): (typeof IMAGE_RULES.mimeTypes)[number] | null {
  const at = (i: number, ...values: number[]) => values.every((v, k) => bytes[i + k] === v);
  if (at(0, 0xff, 0xd8, 0xff)) return "image/jpeg";
  if (at(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "image/png";
  // "RIFF" <size> "WEBP"
  if (at(0, 0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x45, 0x42, 0x50)) return "image/webp";
  return null;
}

/** Returns a Polish error, or null when the image is acceptable. */
export function checkImage(file: {
  size: number;
  type: string;
}): string | null {
  if (!IMAGE_RULES.mimeTypes.includes(file.type as never)) {
    return v.imageWrongType;
  }
  if (file.size > IMAGE_RULES.maxBytes) return v.imageTooBig;
  return null;
}

/**
 * The concrete shape the editor holds in React state.
 *
 * `z.input<typeof recipeSchema>` is not usable for this: fields wrapped in
 * `z.preprocess` widen to `unknown`, which is right for a parser accepting form
 * strings but useless for typed component props. This type is what the UI works
 * with; `recipeSchema.parse` is still the only thing that decides validity.
 */
/**
 * A blank Recipe, as the editor holds it before anything is typed.
 *
 * Lives here rather than in the editor because a Server Component needs it too
 * (prefilling the Source URL from a failed import, OR-45), and a value exported
 * from a "use client" module does not survive that crossing — it arrives as a
 * client reference, and spreading it yields an object with no fields.
 */
export const emptyRecipe: RecipeFormValue = {
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

export type RecipeFormValue = {
  title: string;
  servings: number;
  totalMinutes: number | null;
  kcalPerServing: number | null;
  sourceUrl: string | null;
  imageUrl: string | null;
  ingredientLines: {
    quantity: number | null;
    unit: string | null;
    item: string;
    note: string | null;
    substitutes: { item: string; note: string | null }[];
  }[];
  steps: string[];
  tips: string[];
  tagSlugs: string[];
};

/** What `toFormValue` reads: the server's Recipe read shape, or its JSON on the phone. */
type FormSource = Pick<
  RecipeFormValue,
  "title" | "servings" | "totalMinutes" | "kcalPerServing" | "sourceUrl" | "imageUrl" | "steps" | "tips"
> & {
  ingredientLines: (RecipeFormValue["ingredientLines"][number] & { id?: string })[];
  tags: { slug: string }[];
};

/**
 * A Recipe as the editor holds it.
 *
 * Mapped explicitly rather than spread: the read shape carries author, dates and
 * generated ids that the form has no business editing. Substitutes ride along
 * untouched — they are Worker-generated (ADR-0002) and a hand edit must not drop
 * them.
 *
 * Shared: the web edit route, the re-import diff (OR-46) and the phone's editor.
 */
export function toFormValue(recipe: FormSource): RecipeFormValue {
  return {
    title: recipe.title,
    servings: recipe.servings,
    totalMinutes: recipe.totalMinutes,
    kcalPerServing: recipe.kcalPerServing,
    sourceUrl: recipe.sourceUrl,
    imageUrl: recipe.imageUrl,
    ingredientLines: recipe.ingredientLines.map((line) => ({
      quantity: line.quantity,
      unit: line.unit,
      item: line.item,
      note: line.note,
      substitutes: line.substitutes,
    })),
    steps: recipe.steps,
    tips: recipe.tips,
    tagSlugs: recipe.tags.map((tag) => tag.slug),
  };
}
