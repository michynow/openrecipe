"use client";

import { updateRecipeAction } from "@/app/(app)/recipes/actions";
import { RecipeEditor, type RecipeEditorValue } from "@/components/recipe-editor";
import type { FacetGroup } from "@/lib/tags-query";

/**
 * Wires the editor to the update action.
 *
 * The only difference from NewRecipeForm is the handler and the initial value —
 * which is the point of building the editor as a component over the Recipe shape.
 */
export function EditRecipeForm({
  recipeId,
  heading,
  initial,
  tagGroups,
}: {
  recipeId: string;
  heading: string;
  initial: RecipeEditorValue;
  tagGroups: FacetGroup[];
}) {
  return (
    <RecipeEditor
      heading={heading}
      initial={initial}
      tagGroups={tagGroups}
      onSubmit={(value: RecipeEditorValue) =>
        updateRecipeAction(recipeId, value)
      }
    />
  );
}
