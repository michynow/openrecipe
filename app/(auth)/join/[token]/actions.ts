"use server";

import { auth } from "@/lib/auth";
import { copy } from "@/lib/copy";
import {
  attributeInvite,
  claimInvite,
  inspectInvite,
  releaseInvite,
} from "@/lib/invites";

export type JoinResult = { ok: true } | { ok: false; error: string };

function messageFor(state: Awaited<ReturnType<typeof inspectInvite>>): string {
  switch (state) {
    case "unknown":
      return copy.join.tokenUnknown;
    case "used":
    case "revoked":
      return copy.join.tokenUsed;
    case "expired":
      return copy.join.tokenExpired;
    case "wrong-email":
      return copy.join.tokenWrongEmail;
    default:
      return copy.common.somethingFailed;
  }
}

/**
 * Create an account against an Invite.
 *
 * Order matters: claim first, create second. The claim is a conditional UPDATE and
 * therefore the mutex — two racing submissions cannot both pass it, so they cannot
 * both create an account.
 *
 * Better Auth owns user creation and does not join our transaction, so a failure
 * after the claim is compensated by releasing it. Burning someone's only invite
 * because their password was four characters long would be a nasty way to fail.
 */
export async function joinWithPassword(
  token: string,
  input: { name: string; email: string; password: string },
): Promise<JoinResult> {
  const email = input.email.trim().toLowerCase();

  const claimed = await claimInvite(token, email);
  if (!claimed) {
    // Lost the claim. Re-read purely to choose a message.
    return { ok: false, error: messageFor(await inspectInvite(token, email)) };
  }

  try {
    const created = await auth.api.signUpEmail({
      body: { email, password: input.password, name: input.name.trim() },
    });

    if (!created.user?.id) throw new Error("sign-up returned no user");

    await attributeInvite(claimed.id, created.user.id);
    return { ok: true };
  } catch (error) {
    await releaseInvite(claimed.id);
    const detail = error instanceof Error ? error.message : "";
    // Duplicate address is the one failure worth naming — it is actionable.
    if (/exist/i.test(detail)) {
      return { ok: false, error: copy.join.emailTaken };
    }
    return { ok: false, error: copy.join.couldNotCreate };
  }
}
