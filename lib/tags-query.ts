import { asc, sql } from "drizzle-orm";

import { db } from "./db/index.ts";
import { tag } from "./db/schema.ts";
import { FACETS, type Facet } from "./db/tags.ts";

/**
 * Tags for the picker and, later, the search filters.
 *
 * Read from the table rather than the seed constant: the Master can add Tags at
 * runtime (OR-50), and a picker built from a hardcoded list would silently ignore
 * them.
 */

export type TagOption = { slug: string; label: string };
export type FacetGroup = { facet: Facet; tags: TagOption[] };

/**
 * All Tags, grouped by Facet, in the Facet order the PRD declares.
 *
 * Sorted with the `pl-PL-x-icu` collation.
 *
 * The name matters: plain `"pl-PL"` does not exist on Neon (Postgres 17) and the
 * query errors outright — ICU collations carry the `-x-icu` suffix. And it cannot
 * be omitted, because this database's default collation is `C.UTF-8`, which sorts
 * by byte value and drops every Polish diacritic after Z.
 */
export async function getTagsByFacet(): Promise<FacetGroup[]> {
  const rows = await db
    .select({ facet: tag.facet, slug: tag.slug, label: tag.label })
    .from(tag)
    .orderBy(asc(sql`${tag.label} collate "pl-PL-x-icu"`));

  const byFacet = new Map<string, TagOption[]>();
  for (const row of rows) {
    const list = byFacet.get(row.facet) ?? [];
    list.push({ slug: row.slug, label: row.label });
    byFacet.set(row.facet, list);
  }

  // FACETS order, not alphabetical — Meal Slot first because it is the one people
  // reach for. Any facet in the table but not in FACETS still shows, at the end.
  const known = FACETS.filter((facet) => byFacet.has(facet)).map((facet) => ({
    facet,
    tags: byFacet.get(facet)!,
  }));

  const extra = [...byFacet.keys()]
    .filter((facet) => !FACETS.includes(facet as Facet))
    .map((facet) => ({ facet: facet as Facet, tags: byFacet.get(facet)! }));

  return [...known, ...extra];
}
