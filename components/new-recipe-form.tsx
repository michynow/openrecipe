"use client";

import { createRecipeAction } from "@/app/(app)/recipes/actions";
import { RecipeEditor, type RecipeEditorValue } from "@/components/recipe-editor";
import type { FacetGroup } from "@/lib/tags-query";

/**
 * Wires the editor to the create action.
 *
 * A thin client component so the editor itself stays free of any knowledge about
 * where its data goes — edit and Draft review (OR-44) mount the same editor with a
 * different handler.
 */
export function NewRecipeForm({
  heading,
  tagGroups,
  initial,
}: {
  heading: string;
  tagGroups: FacetGroup[];
  /** Set when a failed import handed the Source URL over (OR-45). */
  initial?: RecipeEditorValue;
}) {
  return (
    <RecipeEditor
      heading={heading}
      tagGroups={tagGroups}
      initial={initial}
      onSubmit={(value: RecipeEditorValue) => createRecipeAction(value)}
    />
  );
}
