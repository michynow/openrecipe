import { revalidatePath } from "next/cache";

import { guard, jsonBody, ok } from "@/lib/api";
import { addToShoppingList, getShoppingList } from "@/lib/shopping-list";
import { shoppingListSchemas } from "@/lib/shopping-list-schemas";

export async function POST(request: Request) {
  const user = await guard("user", request);
  if (user instanceof Response) return user;
  const body = await jsonBody(request, shoppingListSchemas.add);
  if (body instanceof Response) return body;

  const added = await addToShoppingList(body.recipeId, body.servings, body.excludedLineIds, user.id);
  revalidatePath("/shopping-list");
  revalidatePath("/recipes/[slug]", "page");

  return ok("POST /api/v1/shopping-list/recipes", { ok: added, list: await getShoppingList() });
}
