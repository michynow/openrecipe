
/**
 * The /search URL contract (OR-36).
 *
 * Everything the search page can be asked lives in the query string, so a filtered
 * view is linkable and the back button restores it without any state of ours
 * (PRD §7.4). This module is the only place that knows how that string is spelled:
 * the page parses one on the way in, the filter panel builds them for its links,
 * and the paging Server Action parses the same string again on the way back.
 *
 *   q     free text            ?q=zurek
 *   tag   Tag slug, repeated   ?tag=vegan&tag=lunch
 *   time  max total minutes    ?time=30
 *   img   has-image, when "1"  ?img=1
 *
 * Repeated `tag` rather than a comma-joined list because that is what a GET form
 * and `URLSearchParams` both do natively — a separator would mean inventing an
 * escape for slugs that contain it.
 *
 * There is no `sort`. The two sorts that exist — best match and newest — are not a
 * choice: `searchRecipes` ranks by relevance exactly when there is a text query and
 * by date when there is not, so the sort is already implied by `q` and a parameter
 * for it could only ever disagree with the query it describes.
 *
 * Nothing here touches the cursor. The cursor is a position inside one result set,
 * not part of the view being shared, and it stays in the client island that asked
 * for it.
 */

/** What `searchRecipes` (apps/web/lib/search-query.ts) can be asked. */
export type SearchParams = {
  /** Free text. Empty or whitespace means "browse", not "search for nothing". */
  query?: string;
  /** Tag slugs, flat. Facet grouping is worked out in SQL, in `searchRecipes`. */
  tagSlugs?: string[];
  maxTotalMinutes?: number;
  hasImage?: boolean;
  /** Opaque; hand back `nextCursor` from the previous page. */
  cursor?: string | null;
  limit?: number;
};

/** What both the page and the paging action hand to `searchRecipes`. */
export type SearchFilters = Pick<SearchParams, "query" | "maxTotalMinutes"> & {
  /** Flat, deduplicated, in the order they were given. */
  tagSlugs: string[];
  /**
   * Required here where the query type has it optional: a filter that is off is
   * a state the panel renders, so "false" and "not set" cannot be different.
   */
  hasImage: boolean;
};

/** The shape Next hands a page as `searchParams`. */
export type RawSearchParams = Record<string, string | string[] | undefined>;

/**
 * Enough Tags to filter on every Facet at once several times over, and few enough
 * that a hand-written URL cannot turn one page view into a 500-term `IN` list.
 */
const MAX_TAG_FILTERS = 20;

/** A week, the same ceiling the editor validates `totalMinutes` against. */
const MAX_MINUTES = 10_080;

function values(raw: RawSearchParams | URLSearchParams, key: string): string[] {
  if (raw instanceof URLSearchParams) return raw.getAll(key);
  const value = raw[key];
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

/**
 * Read the filters out of a URL. Accepts both shapes that occur: the plain object
 * a page receives, and a `URLSearchParams` parsed from a query string.
 *
 * Every value is untrusted — this runs on whatever someone pasted into the address
 * bar — so nothing is passed through unbounded. A value that makes no sense is
 * dropped rather than rejected: a stale link should lose one filter, not show an
 * error page.
 */
export function parseSearchFilters(
  raw: RawSearchParams | URLSearchParams,
): SearchFilters {
  const query = values(raw, "q")[0]?.trim();
  const minutes = Number(values(raw, "time")[0]);

  return {
    // Whitespace is not a search. Empty means "browse everything", which is the
    // page's normal opening state rather than a query that found nothing.
    query: query || undefined,
    tagSlugs: [...new Set(values(raw, "tag").filter(Boolean))].slice(
      0,
      MAX_TAG_FILTERS,
    ),
    // Non-integers, zero, negatives and NaN all fall through to undefined.
    maxTotalMinutes:
      Number.isInteger(minutes) && minutes > 0
        ? Math.min(minutes, MAX_MINUTES)
        : undefined,
    hasImage: values(raw, "img")[0] === "1",
  };
}

/**
 * The canonical query string for a set of filters — the same filters always
 * produce the same string, byte for byte, which is what lets it double as the
 * React key that resets the results island.
 *
 * Defaults are omitted rather than spelled out, so browsing with nothing chosen is
 * `/search` and not `/search?q=&time=&img=0`.
 */
export function searchFiltersToQuery(filters: SearchFilters): string {
  const params = new URLSearchParams();
  if (filters.query) params.set("q", filters.query);
  for (const slug of filters.tagSlugs) params.append("tag", slug);
  if (filters.maxTotalMinutes !== undefined) {
    params.set("time", String(filters.maxTotalMinutes));
  }
  if (filters.hasImage) params.set("img", "1");
  return params.toString();
}

/** Href for a filter link. Every filter control on the page is one of these. */
export function searchHref(filters: SearchFilters): string {
  const query = searchFiltersToQuery(filters);
  return query ? `/search?${query}` : "/search";
}

/** Add a Tag to the filters, or take it away if it is already there. */
export function toggleTag(filters: SearchFilters, slug: string): SearchFilters {
  return {
    ...filters,
    tagSlugs: filters.tagSlugs.includes(slug)
      ? filters.tagSlugs.filter((s) => s !== slug)
      : [...filters.tagSlugs, slug],
  };
}
