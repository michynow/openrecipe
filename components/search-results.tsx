"use client";

import { useEffect, useRef, useState } from "react";

import { loadMoreSearchPage } from "@/app/(app)/search/actions";
import { RecipeGrid } from "@/components/recipe-card";
import { copy } from "@/lib/copy";
import type { SearchPage } from "@/lib/search-query";

/**
 * The results grid, and the only client code on /search (OR-36).
 *
 * The first page arrives already rendered, from the page's own `searchRecipes`
 * call — a shared link shows results in its first paint rather than a spinner.
 * This island exists purely to append the pages after it.
 *
 * It is mounted under a boundary keyed by the query string, so a new query or
 * filter set brings a fresh one with the server's page in hand. That removes the
 * whole class of bug where appended results outlive the search they belonged to.
 *
 * The pages appended here are client state and are deliberately not in the URL:
 * coming back to a search re-renders its first page under a restored scroll
 * position. Keeping ten pages addressable would mean carrying the cursor in the
 * URL and re-running every page of the query to honour it, which is a great deal
 * of machinery for the second half of a scroll nobody asked to bookmark.
 */

/**
 * Start the next page while the last row is still a screen away. Loading only
 * once the sentinel is actually visible means the reader always sees the gap.
 */
const LOAD_AHEAD = "400px";

export function SearchResults({
  initial,
  qs,
}: {
  initial: SearchPage;
  /** The canonical query string these results are for; the action re-parses it. */
  qs: string;
}) {
  const [recipes, setRecipes] = useState(initial.recipes);
  const [cursor, setCursor] = useState(initial.nextCursor);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);
  /** The cursor a request is out for, so one page is never asked for twice. */
  const fetching = useRef<string | null>(null);

  useEffect(() => {
    const node = sentinel.current;
    // No cursor means the last page is on screen. After a failure the observer
    // stays off, so a broken connection cannot spin on the sentinel — the retry
    // button is what turns it back on.
    if (!node || !cursor || failed) return;

    const observer = new IntersectionObserver(
      async ([entry]) => {
        if (!entry.isIntersecting || fetching.current === cursor) return;
        fetching.current = cursor;
        // Stop watching for the duration of the request; the effect re-runs with
        // the next cursor and starts a new observer.
        observer.disconnect();
        setLoading(true);

        try {
          const next = await loadMoreSearchPage(qs, cursor);
          setRecipes((previous) => [...previous, ...next.recipes]);
          setCursor(next.nextCursor);
        } catch {
          fetching.current = null;
          setFailed(true);
        } finally {
          setLoading(false);
        }
      },
      { rootMargin: LOAD_AHEAD },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [cursor, failed, qs]);

  // Nothing matched. Distinct from an empty library, which is what RecipeGrid
  // would otherwise say — "add your first recipe" is wrong advice for a typo.
  if (recipes.length === 0) {
    return (
      <p className="rounded-card border border-dashed border-line px-6 py-16 text-center text-muted">
        {copy.search.noResults}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <RecipeGrid recipes={recipes} />

      {/* Skeletons below what is already there, so the page never jumps back. */}
      {loading && <RecipeGrid recipes={[]} loading skeletonCount={4} />}

      {failed && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-center gap-3 py-6 text-sm"
        >
          <span className="text-accent2">{copy.common.somethingFailed}</span>
          {/*
            Retrying re-arms the observer, which fires again on a sentinel that
            never left the viewport. Nothing navigates and nothing remounts, so
            the reader keeps the scroll position — and the results — they had.
          */}
          <button
            type="button"
            onClick={() => setFailed(false)}
            className="min-h-11 rounded-input border border-line px-4 text-muted"
          >
            {copy.common.retry}
          </button>
        </div>
      )}

      {!cursor && !loading && (
        <p className="py-6 text-center text-sm text-muted">
          {copy.search.endOfResults}
        </p>
      )}

      {/* Watched, never seen. Sits after the grid so it enters last. */}
      <div ref={sentinel} aria-hidden />
    </div>
  );
}
