import { z } from "zod";

import { guard, jsonBody, ok } from "@/lib/api";
import { deletePushToken } from "@/lib/push";

export async function POST(request: Request) {
  const user = await guard("user", request);
  if (user instanceof Response) return user;
  const body = await jsonBody(request, z.object({ token: z.string().min(1).max(4096) }));
  if (body instanceof Response) return body;

  await deletePushToken(user.id, body.token);

  return ok("POST /api/v1/push-tokens/delete", { ok: true });
}
