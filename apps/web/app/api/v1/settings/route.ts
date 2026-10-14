import { guard, ok } from "@/lib/api";
import { getQueueSummary, listMembers, listTagsWithUse } from "@/lib/admin-query";
import { listInvites } from "@/lib/invites";

export async function GET() {
  const user = await guard("admin");
  if (user instanceof Response) return user;

  const [invites, members, tags, queue] = await Promise.all([
    listInvites(),
    listMembers(),
    listTagsWithUse(),
    getQueueSummary(),
  ]);

  return ok("GET /api/v1/settings", { invites, members, tags, queue });
}
