import { fail, guard, ok } from "@/lib/api";
import { getCookLog } from "@/lib/cook-log";
import { getRecipeBySlug } from "@/lib/recipe-query";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const user = await guard("user");
  if (user instanceof Response) return user;

  const recipe = await getRecipeBySlug((await params).slug);
  if (!recipe) return fail(404, "not-found");

  return ok("GET /api/v1/recipes/by-slug/:slug", {
    recipe,
    cookLog: await getCookLog(recipe.id),
  });
}
