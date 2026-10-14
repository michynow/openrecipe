import { guard, ok } from "@/lib/api";
import { getDashboardStats } from "@/lib/dashboard-query";
import { getProposals } from "@/lib/proposals-query";
import { searchRecipes } from "@/lib/search-query";

/** Twin of app/(app)/page.tsx. */
const RECENT_LIMIT = 8;

export async function GET() {
  const user = await guard("user");
  if (user instanceof Response) return user;

  const [recent, stats, proposals] = await Promise.all([
    searchRecipes({ limit: RECENT_LIMIT }),
    getDashboardStats(),
    getProposals(user.id),
  ]);

  return ok("GET /api/v1/home", {
    recent,
    // Members cannot open Drafts, so they are not told any are waiting.
    stats: user.isAdmin ? stats : { ...stats, draftsWaiting: 0 },
    proposals,
  });
}
