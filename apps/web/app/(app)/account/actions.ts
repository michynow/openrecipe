"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { copy } from "@openrecipe/core/copy";
import { requireUser } from "@/lib/session";

/**
 * Your own account, for every role. Better Auth works out whose account from the
 * session cookie, so there is no user id to forge here.
 */

export type AccountResult = { ok: boolean; message: string } | null;

export async function updateNameAction(
  _prev: AccountResult,
  formData: FormData,
): Promise<AccountResult> {
  await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  if (name === "") return { ok: false, message: copy.account.nameRequired };

  try {
    await auth.api.updateUser({ body: { name }, headers: await headers() });
  } catch {
    return { ok: false, message: copy.common.somethingFailed };
  }

  // The name shows on every Recipe this person added.
  revalidatePath("/", "layout");
  return { ok: true, message: copy.account.saved };
}

/**
 * An empty current password means "I have none yet" — someone who only ever
 * signed in with Google. Better Auth's setPassword refuses if a password already
 * exists, so this cannot be used to skip the current-password check.
 */
export async function changePasswordAction(
  _prev: AccountResult,
  formData: FormData,
): Promise<AccountResult> {
  await requireUser();
  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");

  if (newPassword.length < 8) {
    return { ok: false, message: copy.account.passwordTooShort };
  }

  try {
    if (currentPassword === "") {
      await auth.api.setPassword({
        body: { newPassword },
        headers: await headers(),
      });
    } else {
      await auth.api.changePassword({
        body: { currentPassword, newPassword, revokeOtherSessions: true },
        headers: await headers(),
      });
    }
  } catch {
    return { ok: false, message: copy.account.passwordFailed };
  }

  return { ok: true, message: copy.account.passwordChanged };
}
