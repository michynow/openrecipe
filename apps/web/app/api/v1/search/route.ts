import { parseSearchFilters } from "@openrecipe/core/search-params";

import { guard, ok } from "@/lib/api";
import { searchRecipes } from "@/lib/search-query";

/** The /search URL contract plus `cursor`, which `searchRecipes` validates itself. */
export async function GET(request: Request) {
  const user = await guard("user");
  if (user instanceof Response) return user;

  const { searchParams } = new URL(request.url);

  return ok(
    "GET /api/v1/search",
    await searchRecipes({
      ...parseSearchFilters(searchParams),
      cursor: searchParams.get("cursor") ?? undefined,
    }),
  );
}
