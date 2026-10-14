import { revalidatePath } from "next/cache";

import { guard, jsonBody, ok } from "@/lib/api";
import { getShoppingList, tickShoppingItem } from "@/lib/shopping-list";
import { shoppingListSchemas } from "@/lib/shopping-list-schemas";

export async function POST(request: Request) {
  const user = await guard("user", request);
  if (user instanceof Response) return user;
  const body = await jsonBody(request, shoppingListSchemas.tick);
  if (body instanceof Response) return body;

  await tickShoppingItem(body.key, body.quantity, body.ticked, user.id);
  revalidatePath("/shopping-list");

  return ok("POST /api/v1/shopping-list/ticks", { ok: true, list: await getShoppingList() });
}
