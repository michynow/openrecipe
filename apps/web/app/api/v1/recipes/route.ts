import type { RecipeInput } from "@openrecipe/core/recipe-schema";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { guard, jsonBody, ok } from "@/lib/api";
import { createRecipe } from "@/lib/recipes";

// `createRecipe` validates with recipeSchema and returns `{ok:false, errors}`.
const body = z.custom<RecipeInput>((v) => typeof v === "object" && v !== null);

export async function POST(request: Request) {
  const user = await guard("admin", request);
  if (user instanceof Response) return user;
  const input = await jsonBody(request, body);
  if (input instanceof Response) return input;

  const result = await createRecipe(input, user.id);

  if (result.ok) {
    revalidatePath("/");
    revalidatePath("/search");
    revalidatePath(`/recipes/${result.slug}`);
  }

  return ok("POST /api/v1/recipes", result);
}
