import { copy } from "@openrecipe/core/copy";
import { z } from "zod";

import { guard, jsonBody, ok } from "@/lib/api";
import { auth } from "@/lib/auth";

const E = "POST /api/v1/account/password";

export async function POST(request: Request) {
  const user = await guard("user", request);
  if (user instanceof Response) return user;
  const body = await jsonBody(
    request,
    z.object({ currentPassword: z.string(), newPassword: z.string() }),
  );
  if (body instanceof Response) return body;

  const { currentPassword, newPassword } = body;
  if (newPassword.length < 8) {
    return ok(E, { ok: false, message: copy.account.passwordTooShort });
  }

  try {
    // Empty current password = "I have none yet" (Google-only account); setPassword
    // refuses if one exists, so this cannot skip the current-password check.
    if (currentPassword === "") {
      await auth.api.setPassword({ body: { newPassword }, headers: request.headers });
    } else {
      await auth.api.changePassword({
        body: { currentPassword, newPassword, revokeOtherSessions: true },
        headers: request.headers,
      });
    }
  } catch {
    return ok(E, { ok: false, message: copy.account.passwordFailed });
  }

  return ok(E, { ok: true, message: copy.account.passwordChanged });
}
