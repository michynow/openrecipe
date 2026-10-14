import { guard, ok } from "@/lib/api";
import { getTagsByFacet } from "@/lib/tags-query";

export async function GET() {
  const user = await guard("user");
  if (user instanceof Response) return user;

  return ok("GET /api/v1/tags", await getTagsByFacet());
}
