import { revalidatePath } from "next/cache";
import { z } from "zod";

import { guard, jsonBody, ok, uuid } from "@/lib/api";
import { deleteTag, renameTag } from "@/lib/admin-query";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Ctx) {
  const user = await guard("admin", request);
  if (user instanceof Response) return user;
  const body = await jsonBody(request, z.object({ label: z.string() }));
  if (body instanceof Response) return body;

  const id = uuid((await params).id);
  if (id instanceof Response) return id;

  const result = await renameTag(id, body.label);
  revalidatePath("/settings");
  revalidatePath("/search");

  return ok("PATCH /api/v1/settings/tags/:id", result);
}

export async function DELETE(request: Request, { params }: Ctx) {
  const user = await guard("admin", request);
  if (user instanceof Response) return user;

  const id = uuid((await params).id);
  if (id instanceof Response) return id;

  const result = await deleteTag(id);
  revalidatePath("/settings");

  return ok("DELETE /api/v1/settings/tags/:id", result);
}
