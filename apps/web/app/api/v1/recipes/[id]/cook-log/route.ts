import { revalidatePath } from "next/cache";

import { fail, guard, ok, uuid } from "@/lib/api";
import { logCooked } from "@/lib/cook-log";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await guard("admin", request);
  if (user instanceof Response) return user;

  const id = uuid((await params).id);
  if (id instanceof Response) return id;

  const entryId = await logCooked(id, user.id);
  if (!entryId) return fail(404, "not-found");
  revalidatePath("/");

  return ok("POST /api/v1/recipes/:id/cook-log", { entryId });
}
