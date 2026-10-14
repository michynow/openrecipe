import { copy } from "@openrecipe/core/copy";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { guard, jsonBody, ok } from "@/lib/api";
import { auth } from "@/lib/auth";

export async function PATCH(request: Request) {
  const user = await guard("user", request);
  if (user instanceof Response) return user;
  const body = await jsonBody(request, z.object({ name: z.string() }));
  if (body instanceof Response) return body;

  const name = body.name.trim();
  if (name === "") {
    return ok("PATCH /api/v1/account/name", { ok: false, message: copy.account.nameRequired });
  }

  try {
    await auth.api.updateUser({ body: { name }, headers: request.headers });
  } catch {
    return ok("PATCH /api/v1/account/name", { ok: false, message: copy.common.somethingFailed });
  }

  // The name shows on every Recipe this person added.
  revalidatePath("/", "layout");
  return ok("PATCH /api/v1/account/name", { ok: true, message: copy.account.saved });
}
