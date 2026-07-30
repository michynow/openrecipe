"use server";

import { revalidatePath } from "next/cache";

import { logCooked, undoCooked } from "@/lib/cook-log";
import type { RecipeInput } from "@/lib/recipe-schema";
import {
  createRecipe,
  deleteRecipe,
  restoreRecipe,
  updateRecipe,
  type SaveResult,
} from "@/lib/recipes";
import { requireUser } from "@/lib/session";

/**
 * Server Actions for the editor.
 *
 * Each one calls `requireUser()` itself. The middleware guard is a redirect for
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

/* ──────────────────────────── Delete (OR-25) ──────────────────────────── */

/**
 * `ok: false` means the Recipe was already gone, not that something broke. The
 * dialog treats it as done either way — there is nothing for the user to retry.
 */
export async function deleteRecipeAction(
  recipeId: string,
): Promise<{ ok: boolean }> {
  await requireUser();
  const slug = await deleteRecipe(recipeId);

  if (slug) {
    revalidatePath("/");
    revalidatePath("/search");
    revalidatePath(`/recipes/${slug}`);
  }

  return { ok: slug !== null };
}

/** The undo toast. Fails quietly once the grace window has closed. */
export async function restoreRecipeAction(
  recipeId: string,
): Promise<{ ok: boolean }> {
  await requireUser();
  const slug = await restoreRecipe(recipeId);

  if (slug) {
    revalidatePath("/");
    revalidatePath("/search");
    revalidatePath(`/recipes/${slug}`);
  }

  return { ok: slug !== null };
}

/* ─────────────────────────── Cook Log (OR-32) ─────────────────────────── */

/**
 * Only the dashboard is revalidated. The Recipe page's own count is held
 * optimistically in the button until the page is re-fetched, and it is a dynamic
 * route anyway, so re-reading it here would buy nothing.
 */
export async function logCookedAction(
  recipeId: string,
): Promise<{ entryId: string }> {
  const user = await requireUser();
  const entryId = await logCooked(recipeId, user.id);

  revalidatePath("/");

  return { entryId };
}

export async function undoCookedAction(
  entryId: string,
): Promise<{ ok: boolean }> {
  const user = await requireUser();
  const ok = await undoCooked(entryId, user.id);

  if (ok) revalidatePath("/");

  return { ok };
}
