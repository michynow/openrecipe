import { revalidatePath } from "next/cache";

import { guard, ok, uuid } from "@/lib/api";
import { discardDraft } from "@/lib/draft-queue";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await guard("admin", request);
  if (user instanceof Response) return user;

  const id = uuid((await params).id);
  if (id instanceof Response) return id;

  // An illegal move is `false`; a database failure still throws.
  const done = await discardDraft(id);
  if (done) revalidatePath("/drafts");

  return ok("POST /api/v1/drafts/:id/discard", { ok: done });
}
