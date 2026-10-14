import { revalidatePath } from "next/cache";

import { guard, jsonBody, ok } from "@/lib/api";
import { clearShoppingList, getShoppingList } from "@/lib/shopping-list";
import { shoppingListSchemas } from "@/lib/shopping-list-schemas";

export async function POST(request: Request) {
  const user = await guard("user", request);
  if (user instanceof Response) return user;
  const body = await jsonBody(request, shoppingListSchemas.clear);
  if (body instanceof Response) return body;

  await clearShoppingList(body.scope);
  revalidatePath("/shopping-list");
  revalidatePath("/recipes/[slug]", "page");

  return ok("POST /api/v1/shopping-list/clear", { ok: true, list: await getShoppingList() });
}
