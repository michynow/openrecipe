import { Suspense } from "react";

import { RecipeGrid } from "@/components/recipe-card";
import { SearchFilterPanel } from "@/components/search-filters";
import { SearchResults } from "@/components/search-results";
import { copy } from "@openrecipe/core/copy";
import {
  parseSearchFilters,
  searchFiltersToQuery,
  type RawSearchParams,
  type SearchFilters,
} from "@openrecipe/core/search-params";
import { searchRecipes } from "@/lib/search-query";
import { requireUser } from "@/lib/session";
import { getTagsByFacet } from "@/lib/tags-query";

/**
 * /search (OR-36).
 *
 * A Server Component that renders the first page itself. Someone opening a shared
 * link gets results in the HTML rather than an empty grid that fills in after
 * hydration — and the Recipes are read straight from the database in the same
 * request, so there is no round trip to spend on it.
 *
 * The only client code is the results island, which appends the pages after the
 * first. Everything else — the search box, the Facet panel, the chips — is a form
 * field or a link, because the entire view is described by the URL (PRD §7.4).
 *
 * Results sit behind their own Suspense boundary keyed by the query string. The
 * shell paints immediately on a filter change and only the grid shows skeletons,
 * where a `loading.tsx` would blank the search box the reader is looking at.
 */
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  await requireUser();

  const filters = parseSearchFilters(await searchParams);
  const qs = searchFiltersToQuery(filters);
  const groups = await getTagsByFacet();

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
      <h1 className="font-display text-3xl uppercase tracking-tight sm:text-4xl">
        {copy.nav.search}
      </h1>

      <SearchFilterPanel filters={filters} groups={groups} />

      <Suspense key={qs} fallback={<RecipeGrid recipes={[]} loading />}>
        <FirstPage filters={filters} qs={qs} />
      </Suspense>
    </main>
  );
}

/**
 * Split out so the query is what suspends, rather than the whole page. The
 * boundary above is keyed, so the island below remounts with it and needs no key
 * of its own; `qs` is passed for the paging action to re-parse.
 */
async function FirstPage({
  filters,
  qs,
}: {
  filters: SearchFilters;
  qs: string;
}) {
  const page = await searchRecipes(filters);

  return <SearchResults initial={page} qs={qs} />;
}
