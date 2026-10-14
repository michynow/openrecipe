import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";

import { guard, jsonBody, ok } from "@/lib/api";
import { listDrafts, parkUrl } from "@/lib/draft-queue";
import { wakeKitchen } from "@/lib/kitchen";

export async function GET() {
  const user = await guard("admin");
  if (user instanceof Response) return user;

  return ok("GET /api/v1/drafts", await listDrafts());
}

export async function POST(request: Request) {
  const user = await guard("admin", request);
  if (user instanceof Response) return user;
  const body = await jsonBody(request, z.object({ sourceUrl: z.string() }));
  if (body instanceof Response) return body;

  const result = await parkUrl(body.sourceUrl, user.id);

  if (result.ok) {
    revalidatePath("/drafts");
    revalidatePath("/");
    // An already-queued link was woken for already.
    const { id, alreadyQueued } = result;
    if (id && !alreadyQueued) after(() => wakeKitchen(id));
  }

  return ok("POST /api/v1/drafts", result);
}
