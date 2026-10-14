import { guard, ok } from "@/lib/api";
import { listDraftPulse } from "@/lib/draft-queue";

export async function GET() {
  const user = await guard("admin");
  if (user instanceof Response) return user;

  return ok("GET /api/v1/drafts/pulse", { drafts: await listDraftPulse() });
}
