"use server";

import { revalidatePath } from "next/cache";

import type { RecipeInput } from "@/lib/recipe-schema";
import { createRecipe, updateRecipe, type SaveResult } from "@/lib/recipes";
import { requireUser } from "@/lib/session";

/**
 * Server Actions for the editor.
 *
 * Each one calls `requireUser()` itself. The proxy guard is a redirect for
 * convenience, not authorisation — a Server Action is an HTTP endpoint and has to
 * defend itself.
 *
 * Free-for-all editing (PRD §5): any signed-in user may edit any Recipe, so there
 * is no ownership check here. That is deliberate, not an omission.
 */

export async function createRecipeAction(
  input: RecipeInput,
): Promise<SaveResult> {
  const user = await requireUser();
  const result = await createRecipe(input, user.id);

  if (result.ok) {
    revalidatePath("/");
    revalidatePath("/search");
    revalidatePath(`/recipes/${result.slug}`);
  }

  return result;
}

export async function updateRecipeAction(
  recipeId: string,
  input: RecipeInput,
): Promise<SaveResult> {
  const user = await requireUser();
  const result = await updateRecipe(recipeId, input, user.id);

  if (result.ok) {
    revalidatePath("/");
    revalidatePath("/search");
    revalidatePath(`/recipes/${result.slug}`);
  }

  return result;
}
