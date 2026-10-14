import { revalidatePath } from "next/cache";

import { guard, ok, uuid } from "@/lib/api";
import { undoCooked } from "@/lib/cook-log";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ entryId: string }> },
) {
  const user = await guard("admin", request);
  if (user instanceof Response) return user;

  const entryId = uuid((await params).entryId);
  if (entryId instanceof Response) return entryId;

  const done = await undoCooked(entryId, user.id);
  if (done) revalidatePath("/");

  return ok("DELETE /api/v1/cook-log/:entryId", { ok: done });
}
