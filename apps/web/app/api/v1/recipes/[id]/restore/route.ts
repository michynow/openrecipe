import { revalidatePath } from "next/cache";

import { guard, ok, uuid } from "@/lib/api";
import { restoreRecipe } from "@/lib/recipes";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await guard("admin", request);
  if (user instanceof Response) return user;

  const id = uuid((await params).id);
  if (id instanceof Response) return id;

  const slug = await restoreRecipe(id);

  if (slug) {
    revalidatePath("/");
    revalidatePath("/search");
    revalidatePath(`/recipes/${slug}`);
  }

  return ok("POST /api/v1/recipes/:id/restore", { ok: slug !== null });
}
