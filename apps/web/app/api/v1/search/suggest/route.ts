import { guard, ok } from "@/lib/api";
import { searchRecipes } from "@/lib/search-query";

/** Twin of app/api/search/suggest. PRD §7.4: eight rows. */
const SUGGEST_LIMIT = 8;

export async function GET(request: Request) {
  const user = await guard("user");
  if (user instanceof Response) return user;

  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";

  // An empty query would make `searchRecipes` browse, not suggest.
  if (!query) return ok("GET /api/v1/search/suggest", { recipes: [] });

  const { recipes } = await searchRecipes({ query, limit: SUGGEST_LIMIT });

  return ok("GET /api/v1/search/suggest", { recipes });
}
