import type { RecipeInput } from "@openrecipe/core/recipe-schema";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { guard, jsonBody, ok, uuid } from "@/lib/api";
import { deleteRecipe, updateRecipe } from "@/lib/recipes";

type Ctx = { params: Promise<{ id: string }> };

const body = z.custom<RecipeInput>((v) => typeof v === "object" && v !== null);

export async function PUT(request: Request, { params }: Ctx) {
  const user = await guard("admin", request);
  if (user instanceof Response) return user;
  const input = await jsonBody(request, body);
  if (input instanceof Response) return input;

  const id = uuid((await params).id);
  if (id instanceof Response) return id;

  const result = await updateRecipe(id, input, user.id);

  if (result.ok) {
    revalidatePath("/");
    revalidatePath("/search");
    revalidatePath(`/recipes/${result.slug}`);
  }

  return ok("PUT /api/v1/recipes/:id", result);
}

export async function DELETE(request: Request, { params }: Ctx) {
  const user = await guard("admin", request);
  if (user instanceof Response) return user;

  const id = uuid((await params).id);
  if (id instanceof Response) return id;

  const slug = await deleteRecipe(id);

  if (slug) {
    revalidatePath("/");
    revalidatePath("/search");
    revalidatePath(`/recipes/${slug}`);
  }

  return ok("DELETE /api/v1/recipes/:id", { ok: slug !== null });
}
