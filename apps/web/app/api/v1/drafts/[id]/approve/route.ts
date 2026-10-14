import type { RecipeInput } from "@openrecipe/core/recipe-schema";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { guard, isUuid, jsonBody, ok, uuid } from "@/lib/api";
import { approveDraft } from "@/lib/draft-queue";

// The recipe itself is validated by createRecipe/updateRecipe.
const body = z.object({
  input: z.custom<RecipeInput>((v) => typeof v === "object" && v !== null),
  recipeId: z.string().refine(isUuid).optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await guard("admin", request);
  if (user instanceof Response) return user;
  const id = uuid((await params).id);
  if (id instanceof Response) return id;
  const parsed = await jsonBody(request, body);
  if (parsed instanceof Response) return parsed;

  const { input, recipeId } = parsed;
  const result = await approveDraft(id, input, user.id, recipeId);
  if (!result.ok) return ok("POST /api/v1/drafts/:id/approve", result);

  revalidatePath("/drafts");
  revalidatePath("/");
  revalidatePath("/search");
  revalidatePath(`/recipes/${result.slug}`);

  return ok("POST /api/v1/drafts/:id/approve", result);
}
