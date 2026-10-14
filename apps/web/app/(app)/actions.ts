"use server";

import { revalidatePath } from "next/cache";

import { bumpReroll } from "@/lib/proposals-query";
import { requireUser } from "@/lib/session";

/**
 * "Coś innego" (OR-48).
 *
 * Bumps this person's counter for today, which joins the Proposal seed. Yours
 * only: rerolling changes what you see and nothing about what anyone else does.
 */
export async function rerollProposalsAction(): Promise<{ n: number }> {
  const user = await requireUser();
  const n = await bumpReroll(user.id);

  revalidatePath("/");

  return { n };
}
