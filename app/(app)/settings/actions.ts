"use server";

import { revalidatePath } from "next/cache";

import { mintInvite, revokeInvite } from "@/lib/invites";
import { requireMaster } from "@/lib/session";

/**
 * Master-only. Each action re-checks on the server — hiding a button is not
 * authorisation, and these are Server Actions, reachable by anyone who can craft
 * a request.
 */

export async function mintInviteAction(formData: FormData) {
  const master = await requireMaster();
  const email = String(formData.get("email") ?? "").trim();

  await mintInvite({
    createdById: master.id,
    email: email === "" ? null : email,
  });

  revalidatePath("/settings");
}

export async function revokeInviteAction(formData: FormData) {
  await requireMaster();
  await revokeInvite(String(formData.get("id") ?? ""));
  revalidatePath("/settings");
}
