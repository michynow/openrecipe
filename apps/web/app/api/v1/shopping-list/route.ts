import { guard, ok } from "@/lib/api";
import { getShoppingList } from "@/lib/shopping-list";

/** The household Shopping List (ADR-0009). Members included. */
export async function GET() {
  const user = await guard("user");
  if (user instanceof Response) return user;

  return ok("GET /api/v1/shopping-list", await getShoppingList());
}
