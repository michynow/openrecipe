import { sql } from "drizzle-orm";

import { db } from "../lib/db/index.ts";
import { tag } from "../lib/db/schema.ts";
import { SEED_TAGS } from "../lib/db/tags.ts";

/**
 * Seed the Tag taxonomy. Idempotent: re-running it changes nothing.
 *
 * Upserts on `slug`, so a reworded Polish label is picked up on the next run while
 * existing recipe_tag rows keep pointing at the same Tag. Deliberately does NOT
 * delete Tags absent from the seed — the Master can add their own (OR-50), and a
 * seed script has no business removing those.
 *
 *   pnpm db:seed
 */
async function main() {
  const result = await db
    .insert(tag)
    .values([...SEED_TAGS])
    .onConflictDoUpdate({
      target: tag.slug,
      set: {
        // `excluded` is the incoming row. Referencing tag.label here would resolve
        // to the value already stored, making the update a silent no-op.
        label: sql`excluded.label`,
        facet: sql`excluded.facet`,
      },
    })
    .returning({ slug: tag.slug });

  console.log(`seeded ${result.length} tags`);
}

await main();
