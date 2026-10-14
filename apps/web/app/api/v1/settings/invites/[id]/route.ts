import { revalidatePath } from "next/cache";

import { guard, ok, uuid } from "@/lib/api";
import { revokeInvite } from "@/lib/invites";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await guard("admin", request);
  if (user instanceof Response) return user;

  const id = uuid((await params).id);
  if (id instanceof Response) return id;

  await revokeInvite(id);
  revalidatePath("/settings");

  return ok("DELETE /api/v1/settings/invites/:id", { ok: true });
}
