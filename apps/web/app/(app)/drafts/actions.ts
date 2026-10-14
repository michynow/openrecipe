"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";

import {
  discardDraft,
  markApproved,
  parkReimport,
  parkUrl,
  retryDraft,
  type ParkResult,
} from "@/lib/draft-queue";
import { wakeKitchen } from "@/lib/kitchen";
import type { RecipeInput } from "@openrecipe/core/recipe-schema";
import { createRecipe, updateRecipe, type SaveResult } from "@/lib/recipes";
import { requireAdmin } from "@/lib/session";

/**
 * Server Actions for the import queue (OR-39, OR-45).
 *
 * Each one checks the session itself. Middleware is a redirect for convenience,
 * not authorisation — a Server Action is an HTTP endpoint reachable by POST.
 */

export async function parkUrlAction(sourceUrl: string): Promise<ParkResult> {
  const user = await requireAdmin();
  const result = await parkUrl(sourceUrl, user.id);

  if (result.ok) {
    revalidatePath("/drafts");
    // The dashboard counts what is waiting (OR-47).
    revalidatePath("/");
    // A fresh Draft wakes the cloud kitchen, after the response so the form
    // does not wait on GitHub. An already-queued link was woken for already.
    const { id, alreadyQueued } = result;
    if (id && !alreadyQueued) after(() => wakeKitchen(id));
  }

  return result;
}

/**
 * Queue a re-import of a Recipe that already has a Source URL (OR-46).
 *
 * The Draft carries `recipe_id` from the moment it is queued, which is what lets
 * review diff against the Recipe instead of offering a blank slate.
 */
export async function reimportAction(recipeId: string): Promise<{ ok: boolean }> {
  const user = await requireAdmin();
  const id = await parkReimport(recipeId, user.id);

  if (id) {
    revalidatePath("/drafts");
    revalidatePath("/");
    after(() => wakeKitchen(id));
  }

  return { ok: id !== null };
}

/**
 * Approve a reviewed Draft into a Recipe (OR-44).
 *
 * Takes the editor's current value, not the stored payload: the whole point of
 * review is that what the reviewer fixed is what gets saved. The payload is
 * left as it was, so a Draft that fails validation here can be reopened and
 * tried again rather than losing the edits.
 *
 * `createRecipe` validates unconditionally, so nothing can be approved that
 * would fail Recipe validation — the Draft only moves once the Recipe exists.
 */
export async function approveDraftAction(
  id: string,
  input: RecipeInput,
  /**
   * Set on a re-import (OR-46): the Recipe this Draft belongs to. Approving then
   * updates it in place rather than creating a second copy — the slug and the
   * author stay as they were, because `updateRecipe` never touches either.
   */
  recipeId?: string,
): Promise<SaveResult> {
  const user = await requireAdmin();

  const result = recipeId
    ? await updateRecipe(recipeId, input, user.id)
    : await createRecipe(input, user.id);

  if (!result.ok) return result;

  await markApproved(id, result.id);

  revalidatePath("/drafts");
  revalidatePath("/");
  revalidatePath("/search");
  revalidatePath(`/recipes/${result.slug}`);

  return result;
}

/**
 * Retry and discard both move a Draft, and the model refuses illegal moves by
 * throwing. The buttons only ever offer legal ones, so a throw here means a
 * forged request — caught and reported as a plain failure rather than reaching
 * the user as an error page.
 */
async function move(
  action: (id: string) => Promise<boolean>,
  id: string,
): Promise<{ ok: boolean }> {
  await requireAdmin();

  try {
    const ok = await action(id);
    if (ok) revalidatePath("/drafts");
    return { ok };
  } catch {
    return { ok: false };
  }
}

export async function retryDraftAction(id: string): Promise<{ ok: boolean }> {
  const result = await move(retryDraft, id);
  if (result.ok) after(() => wakeKitchen(id));
  return result;
}

export async function discardDraftAction(id: string): Promise<{ ok: boolean }> {
  return move(discardDraft, id);
}
