"use client";

import { copy } from "@openrecipe/core/copy";
import { diffRecipes, isTaken, patchFor, type Difference } from "@openrecipe/core/import/diff";
import type { RecipeFormValue } from "@openrecipe/core/recipe-schema";

/**
 * The re-import diff (OR-46).
 *
 * The editor starts from what the Recipe says **today**, and each difference is
 * something you can pull in. That direction is the whole ticket: somebody fixed
 * a mistranslated ingredient six months ago, and a re-import must not quietly
 * undo it. Doing nothing keeps what you had.
 *
 * Unchanged fields are absent rather than greyed out — the panel is a list of
 * what to look at, not a table of everything.
 */
export function ReimportDiff({
  current,
  incoming,
  value,
  apply,
}: {
  current: RecipeFormValue;
  incoming: RecipeFormValue;
  /** The editor's live value, so an applied row can show it has been taken. */
  value: RecipeFormValue;
  apply: (patch: Partial<RecipeFormValue>) => void;
}) {
  const differences = diffRecipes(current, incoming);

  if (differences.length === 0) {
    return (
      <p className="rounded-card border border-line bg-surface p-3 text-sm text-muted">
        {copy.imports.noChanges}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-card border border-accent/40 bg-surface p-3">
      <p className="text-sm">{copy.imports.diffHint}</p>

      <ul className="flex flex-col gap-1.5">
        {differences.map((difference) => (
          <Row
            key={difference.field}
            difference={difference}
            taken={isTaken(difference, value, incoming)}
            onApply={() => apply(patchFor(difference.field, incoming))}
          />
        ))}
      </ul>
    </div>
  );
}

function Row({
  difference,
  taken,
  onApply,
}: {
  difference: Difference;
  taken: boolean;
  onApply: () => void;
}) {
  return (
    <li className="flex flex-wrap items-center gap-2 border-t border-line/60 pt-1.5 text-sm first:border-t-0 first:pt-0">
      <span className="text-sm font-extrabold uppercase tracking-wide text-text">
        {copy.imports.diffFields[difference.field]}
      </span>

      <span className="min-w-0 break-words text-muted line-through">
        {difference.current}
      </span>
      <span className="min-w-0 break-words">{difference.incoming}</span>

      <button
        type="button"
        onClick={onApply}
        disabled={taken}
        className="ml-auto min-h-11 shrink-0 rounded-input border border-line px-3 text-sm text-muted transition-colors hover:text-accent disabled:border-accent/40 disabled:text-accent disabled:opacity-100"
      >
        {taken ? copy.imports.diffTaken : copy.imports.diffApply}
      </button>
    </li>
  );
}
