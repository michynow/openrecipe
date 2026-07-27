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

/** http(s) only — no javascript: or data: URLs reaching an href. */
const nullableHttpUrl = z.preprocess(
  absentToNull,
  z.union([
    z.null(),
    z
      .string()
      .trim()
      .url(v.urlInvalid)
      .refine(
        (value) => /^https?:$/.test(new URL(value).protocol),
        v.urlInvalid,
      ),
  ]),
);

/** A stand-in for an Ingredient Line's item. Worker-generated, stored, not fetched. */
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
