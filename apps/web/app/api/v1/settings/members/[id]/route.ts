import { revalidatePath } from "next/cache";
import { z } from "zod";

import { guard, jsonBody, ok } from "@/lib/api";
import { removeMember, setMemberRole } from "@/lib/admin-query";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Ctx) {
  const user = await guard("admin", request);
  if (user instanceof Response) return user;
  const body = await jsonBody(request, z.object({ role: z.enum(["admin", "member"]) }));
  if (body instanceof Response) return body;

  const result = await setMemberRole((await params).id, body.role);
  revalidatePath("/settings");

  return ok("PATCH /api/v1/settings/members/:id", result);
}

export async function DELETE(request: Request, { params }: Ctx) {
  const user = await guard("admin", request);
  if (user instanceof Response) return user;

  const result = await removeMember((await params).id);
  revalidatePath("/settings");

  return ok("DELETE /api/v1/settings/members/:id", result);
}
