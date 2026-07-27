"use client";

import { createRecipeAction } from "@/app/(app)/recipes/actions";
import { RecipeEditor, type RecipeEditorValue } from "@/components/recipe-editor";

/**
 * Wires the editor to the create action.
 *
 * A thin client component so the editor itself stays free of any knowledge about
 * where its data goes — the same editor serves edit (OR-19) and Draft review
 * (OR-44) by being handed a different handler.
 */
export function NewRecipeForm({ heading }: { heading: string }) {
  return (
    <RecipeEditor
      heading={heading}
      onSubmit={(value: RecipeEditorValue) => createRecipeAction(value)}
    />
  );
}
