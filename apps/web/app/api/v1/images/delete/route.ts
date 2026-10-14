import { z } from "zod";

import { guard, jsonBody, ok } from "@/lib/api";
import { deleteBlob } from "@/lib/blob-server";

export async function POST(request: Request) {
  const user = await guard("admin", request);
  if (user instanceof Response) return user;
  const body = await jsonBody(request, z.object({ url: z.string() }));
  if (body instanceof Response) return body;

  // deleteBlob ignores URLs that are not ours.
  await deleteBlob(body.url);

  return ok("POST /api/v1/images/delete", { ok: true });
}
