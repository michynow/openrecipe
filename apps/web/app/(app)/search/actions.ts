"use server";

import { parseSearchFilters } from "@openrecipe/core/search-params";
import { searchRecipes, type SearchPage } from "@/lib/search-query";
import { requireUser } from "@/lib/session";

/**
 * One more page of search results, for the infinite scroll (OR-36).
 *
 * A Server Action rather than a Route Handler: this is the same query the page
 * already ran, called from one component, and an action gets there without a
 * hand-written fetch, a JSON envelope or a second copy of the response type —
 * `SearchPage` crosses the wire as itself. A route would also have to live under
 * app/api, which OR-37 owns this week.
 *
 * It takes the query string the page was rendered with rather than a filter
 * object, so the URL is parsed by exactly one function no matter which way it
 * came in. Like any Server Action this is a public endpoint reachable with
 * whatever body someone likes, hence `requireUser` and hence re-parsing rather
 * than trusting what arrived.
 *
 * `cursor` is opaque and is handed on verbatim. `searchRecipes` validates it and
 * treats anything it did not write as the start of the scroll.
 */
export async function loadMoreSearchPage(
  qs: string,
  cursor: string,
): Promise<SearchPage> {
  await requireUser();

  return searchRecipes({
    ...parseSearchFilters(new URLSearchParams(qs)),
    cursor,
  });
}
