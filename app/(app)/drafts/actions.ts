"use server";

import { revalidatePath } from "next/cache";

import {
  discardDraft,
  markApproved,
  parkUrl,
  retryDraft,
  type ParkResult,
} from "@/lib/draft-queue";
import type { RecipeInput } from "@/lib/recipe-schema";
import { createRecipe, type SaveResult } from "@/lib/recipes";
import { requireUser } from "@/lib/session";

/**
 * Server Actions for the import queue (OR-39, OR-45).
 *
 * Each one checks the session itself. Middleware is a redirect for convenience,
 * not authorisation — a Server Action is an HTTP endpoint reachable by POST.
 */

export async function parkUrlAction(sourceUrl: string): Promise<ParkResult> {
  const user = await requireUser();
  const result = await parkUrl(sourceUrl, user.id);

  if (result.ok) {
    revalidatePath("/drafts");
    // The dashboard counts what is waiting (OR-47).
    revalidatePath("/");
  }

  return result;
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
): Promise<SaveResult> {
  const user = await requireUser();

  const result = await createRecipe(input, user.id);
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
  await requireUser();

  try {
    const ok = await action(id);
    if (ok) revalidatePath("/drafts");
    return { ok };
  } catch {
    return { ok: false };
  }
}

export async function retryDraftAction(id: string): Promise<{ ok: boolean }> {
  return move(retryDraft, id);
}

export async function discardDraftAction(id: string): Promise<{ ok: boolean }> {
  return move(discardDraft, id);
}
