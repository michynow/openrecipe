import { revalidatePath } from "next/cache";
import { after } from "next/server";

import { guard, ok, uuid } from "@/lib/api";
import { retryDraft } from "@/lib/draft-queue";
import { wakeKitchen } from "@/lib/kitchen";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await guard("admin", request);
  if (user instanceof Response) return user;

  const id = uuid((await params).id);
  if (id instanceof Response) return id;

  // An illegal move is `false`; a database failure still throws.
  const done = await retryDraft(id);

  if (done) {
    revalidatePath("/drafts");
    after(() => wakeKitchen(id));
  }

  return ok("POST /api/v1/drafts/:id/retry", { ok: done });
}
