import { FACETS } from "@openrecipe/core/tags";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { guard, jsonBody, ok } from "@/lib/api";
import { addTag } from "@/lib/admin-query";

export async function POST(request: Request) {
  const user = await guard("admin", request);
  if (user instanceof Response) return user;
  const body = await jsonBody(
    request,
    z.object({ facet: z.enum(FACETS), slug: z.string(), label: z.string() }),
  );
  if (body instanceof Response) return body;

  const result = await addTag(body.facet, body.slug, body.label);

  // The picker and the search filters read the table.
  revalidatePath("/settings");
  revalidatePath("/recipes/new");
  revalidatePath("/search");

  return ok("POST /api/v1/settings/tags", result);
}
