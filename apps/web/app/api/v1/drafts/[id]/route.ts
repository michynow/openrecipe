import { fail, guard, ok, uuid } from "@/lib/api";
import { getDraftForReview } from "@/lib/draft-queue";
import { getTagsByFacet } from "@/lib/tags-query";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await guard("admin");
  if (user instanceof Response) return user;

  const id = uuid((await params).id);
  if (id instanceof Response) return id;

  const draft = await getDraftForReview(id);
  if (!draft) return fail(404, "not-found");

  return ok("GET /api/v1/drafts/:id", { draft, tags: await getTagsByFacet() });
}
