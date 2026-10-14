import type { ZodError } from "zod";

/**
 * Zod issues, keyed by the field they belong to.
 *
 * Paths are joined with dots so nested fields address cleanly:
 * `ingredientLines.0.item`. The editor uses those same keys as input ids, which
 * is what lets it move focus to the first offending field.
 */
export type FieldErrors = Record<string, string>;

export function toFieldErrors(error: ZodError): FieldErrors {
  const errors: FieldErrors = {};

  for (const issue of error.issues) {
    const key = issue.path.length === 0 ? "_form" : issue.path.join(".");
    // First issue per field wins. Showing three complaints about one input is
    // noise; the reader fixes the first and the rest usually go with it.
    errors[key] ??= issue.message;
  }

  return errors;
}

/**
 * The field to focus after a failed submit, in the order the form presents them
 * rather than the order Zod happened to report them.
 */
export function firstErrorField(
  errors: FieldErrors,
  order: readonly string[],
): string | null {
  for (const field of order) {
    if (errors[field]) return field;
    // Prefix match catches array fields: "ingredientLines" matches
    // "ingredientLines.0.item".
    const nested = Object.keys(errors).find((key) =>
      key.startsWith(`${field}.`),
    );
    if (nested) return nested;
  }
  return Object.keys(errors)[0] ?? null;
}
