import { z } from "zod";

import { guard, jsonBody, ok } from "@/lib/api";
import { savePushToken } from "@/lib/push";

export async function POST(request: Request) {
  const user = await guard("admin", request);
  if (user instanceof Response) return user;
  const body = await jsonBody(request, z.object({ token: z.string().min(1).max(4096) }));
  if (body instanceof Response) return body;

  await savePushToken(user.id, body.token);

  return ok("POST /api/v1/push-tokens", { ok: true });
}
