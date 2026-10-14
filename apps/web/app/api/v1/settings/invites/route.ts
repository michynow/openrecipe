import { revalidatePath } from "next/cache";
import { z } from "zod";

import { guard, jsonBody, ok } from "@/lib/api";
import { mintInvite } from "@/lib/invites";

export async function POST(request: Request) {
  const user = await guard("admin", request);
  if (user instanceof Response) return user;
  const body = await jsonBody(
    request,
    z.object({ email: z.string().nullish() }),
  );
  if (body instanceof Response) return body;

  const email = body.email?.trim();
  await mintInvite({ createdById: user.id, email: email ? email : null });
  revalidatePath("/settings");

  return ok("POST /api/v1/settings/invites", { ok: true });
}
