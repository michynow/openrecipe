import { revalidatePath } from "next/cache";

import { guard, jsonBody, ok, uuid } from "@/lib/api";
import { getShoppingList, removeFromShoppingList, setShoppingListServings } from "@/lib/shopping-list";
import { shoppingListSchemas } from "@/lib/shopping-list-schemas";

type Ctx = { params: Promise<{ recipeId: string }> };

export async function PATCH(request: Request, { params }: Ctx) {
  const user = await guard("user", request);
  if (user instanceof Response) return user;
  const body = await jsonBody(request, shoppingListSchemas.servings);
  if (body instanceof Response) return body;

  const recipeId = uuid((await params).recipeId);
  if (recipeId instanceof Response) return recipeId;

  const changed = await setShoppingListServings(recipeId, body.servings);
  revalidatePath("/shopping-list");

  return ok("PATCH /api/v1/shopping-list/recipes/:recipeId", { ok: changed, list: await getShoppingList() });
}

export async function DELETE(request: Request, { params }: Ctx) {
  const user = await guard("user", request);
  if (user instanceof Response) return user;

  const recipeId = uuid((await params).recipeId);
  if (recipeId instanceof Response) return recipeId;

  const removed = await removeFromShoppingList(recipeId);
  revalidatePath("/shopping-list");

  return ok("DELETE /api/v1/shopping-list/recipes/:recipeId", { ok: removed, list: await getShoppingList() });
}
