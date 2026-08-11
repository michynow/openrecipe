"use server";

import { revalidatePath } from "next/cache";

import {
  discardDraft,
  parkUrl,
  retryDraft,
  type ParkResult,
} from "@/lib/draft-queue";
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
