"use client";

import { createRecipeAction } from "@/app/(app)/recipes/actions";
import { RecipeEditor, type RecipeEditorValue } from "@/components/recipe-editor";

/**
 * Wires the editor to the create action.
 *
 * A thin client component so the editor itself stays free of any knowledge about
 * where its data goes — edit and Draft review (OR-44) mount the same editor with a
 * different handler.
 */
export function NewRecipeForm({ heading }: { heading: string }) {
  return (
    <RecipeEditor
      heading={heading}
      onSubmit={(value: RecipeEditorValue) => createRecipeAction(value)}
    />
  );
}
