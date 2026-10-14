import { revalidatePath } from "next/cache";
import { after } from "next/server";

import { guard, ok, uuid } from "@/lib/api";
import { parkReimport } from "@/lib/draft-queue";
import { wakeKitchen } from "@/lib/kitchen";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await guard("admin", request);
  if (user instanceof Response) return user;

  const recipeId = uuid((await params).id);
  if (recipeId instanceof Response) return recipeId;

  const id = await parkReimport(recipeId, user.id);

  if (id) {
    revalidatePath("/drafts");
    revalidatePath("/");
    after(() => wakeKitchen(id));
  }

  return ok("POST /api/v1/recipes/:id/reimport", { ok: id !== null });
}
