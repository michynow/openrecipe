"use server";

import { revalidatePath } from "next/cache";

import {
  addTag,
  deleteTag,
  removeMember,
  renameTag,
  setMemberRole,
} from "@/lib/admin-query";
import { mintInvite, revokeInvite } from "@/lib/invites";
import { requireAdmin } from "@/lib/session";
import type { Facet } from "@openrecipe/core/tags";

/**
 * Admin-only. Each action re-checks on the server — hiding a button is not
 * authorisation, and these are Server Actions, reachable by anyone who can craft
 * a request.
 */

export async function mintInviteAction(formData: FormData) {
  const admin = await requireAdmin();
  const email = String(formData.get("email") ?? "").trim();

  await mintInvite({
    createdById: admin.id,
    email: email === "" ? null : email,
  });

  revalidatePath("/settings");
}

export async function revokeInviteAction(formData: FormData) {
  await requireAdmin();
  await revokeInvite(String(formData.get("id") ?? ""));
  revalidatePath("/settings");
}

/* ──────────────────── Members and Tags (OR-50) ───────────────────────── */

/**
 * Every action below re-checks admin server-side. The screen 404s for a Member,
 * but a Server Action is an HTTP endpoint and hiding a button is not a check.
 */

export async function removeMemberAction(
  formData: FormData,
): Promise<void> {
  await requireAdmin();
  await removeMember(String(formData.get("id") ?? ""));
  revalidatePath("/settings");
}

export async function setMemberRoleAction(
  formData: FormData,
): Promise<void> {
  await requireAdmin();
  await setMemberRole(
    String(formData.get("id") ?? ""),
    String(formData.get("role") ?? ""),
  );
  revalidatePath("/settings");
}

export async function addTagAction(formData: FormData): Promise<void> {
  await requireAdmin();

  await addTag(
    String(formData.get("facet") ?? "") as Facet,
    String(formData.get("slug") ?? ""),
    String(formData.get("label") ?? ""),
  );

  // The picker and the search filters read the table, so a new Tag shows up
  // everywhere without a deploy.
  revalidatePath("/settings");
  revalidatePath("/recipes/new");
  revalidatePath("/search");
}

export async function renameTagAction(formData: FormData): Promise<void> {
  await requireAdmin();

  await renameTag(
    String(formData.get("id") ?? ""),
    String(formData.get("label") ?? ""),
  );

  revalidatePath("/settings");
  revalidatePath("/search");
}

export async function deleteTagAction(formData: FormData): Promise<void> {
  await requireAdmin();
  await deleteTag(String(formData.get("id") ?? ""));
  revalidatePath("/settings");
}
