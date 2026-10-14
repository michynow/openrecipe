import Link from "next/link";

import { Proposals } from "@/components/proposals";
import { RecipeGrid } from "@/components/recipe-card";
import { StatWidgets } from "@/components/stat-widgets";
import { copy } from "@/lib/copy";
import { getDashboardStats } from "@/lib/dashboard-query";
import { getProposals } from "@/lib/proposals-query";
import { requireUser } from "@/lib/session";
import { searchRecipes } from "@/lib/search-query";

/**
 * The dashboard's library strip (OR-58).
 *
 * `searchRecipes` with no query is already "browse, newest first, soft-deletes
 * filtered", which is exactly this list — so there is no second query to keep in
 * step with the search page. Stat widgets and Proposals are OR-47 and OR-48.
 */

/** One full grid row at the widest breakpoint, two at the narrowest. */
const RECENT_LIMIT = 8;

export default async function Home() {
  const user = await requireUser();

  const [{ recipes, nextCursor }, stats, proposals] = await Promise.all([
    searchRecipes({ limit: RECENT_LIMIT }),
    getDashboardStats(),
    getProposals(user.id),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
      {/* Members cannot open Drafts, so they are not told any are waiting. */}
      <StatWidgets
        stats={user.isAdmin ? stats : { ...stats, draftsWaiting: 0 }}
      />

      <Proposals proposals={proposals} canAdd={user.isAdmin} />

      <div className="flex items-baseline justify-between gap-4">
        <h1 className="font-display text-3xl uppercase tracking-tight sm:text-4xl">
          {copy.library.recent}
        </h1>

        {/*
          Only offered when there is more to see. A "wszystkie" link over a
          library of three is a link to the same three Recipes.
        */}
        {nextCursor && (
          <Link
            href="/search"
            className="shrink-0 text-sm text-accent underline underline-offset-4"
          >
            {copy.library.seeAll}
          </Link>
        )}
      </div>

      <RecipeGrid recipes={recipes} />
    </main>
  );
}
