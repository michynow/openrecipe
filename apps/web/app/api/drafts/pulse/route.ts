import { listDraftPulse } from "@/lib/draft-queue";
import { getCurrentUser } from "@/lib/session";

/**
 * What the header's toasts poll (components/draft-toasts.tsx): every open
 * Draft's status and title. A Route Handler so the poller can skip a tick
 * cheaply; admin-only, like the Drafts screen itself — the proxy in front is
 * a redirect for convenience, not authorisation.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user?.isAdmin) return Response.json({ drafts: [] }, { status: 403 });

  return Response.json({ drafts: await listDraftPulse() });
}
