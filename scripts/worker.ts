import {
  claimNextDraft,
  markFailed,
  markReady,
  reclaimStale,
} from "../lib/draft-queue.ts";
import { copy } from "../lib/copy.ts";
import { db } from "../lib/db/index.ts";
import { tag } from "../lib/db/schema.ts";
import { extractRecipeFromUrl, type ExtractFailure } from "../lib/import/extract.ts";
import { generateRecipe } from "../lib/import/generate.ts";
import { storeImageFromUrl } from "../lib/import/image.ts";
import { buildPayload } from "../lib/import/payload.ts";
import type { TagOption } from "../lib/import/prompt.ts";

/**
 * The Worker (OR-40). Runs on the Master's laptop, never on Vercel — see
 * ADR-0002. The database is the only thing it and the app share.
 *
 *   pnpm worker
 *
 * Drains the queue and exits. Safe to run on a whim, safe to run twice at once:
 * claiming is a conditional UPDATE with `for update skip locked`, so a second
 * Worker steps over the row the first one took.
 *
 * Structure is claim → extract → generate → store, with each step its own
 * module, because the extractor (OR-41), the model call (OR-42) and the image
 * pipeline (OR-43) land separately and must not require rewriting this loop.
 */

/** What each failure looks like to whoever opens the Drafts screen. */
const FAILURE_COPY: Record<ExtractFailure | "needs-a-model" | "invalid", string> = {
  "fetch-blocked": copy.imports.failures.blocked,
  "not-html": copy.imports.failures.notHtml,
  "no-recipe-found": copy.imports.failedFallback,
  "needs-a-model": copy.imports.failures.needsModel,
  invalid: copy.imports.failures.invalid,
};

/** One Draft, start to finish. Returns what happened, for the log. */
async function process(
  id: string,
  sourceUrl: string,
  tags: TagOption[],
): Promise<string> {
  const extracted = await extractRecipeFromUrl(sourceUrl);

  if (!extracted.ok) {
    await markFailed(id, FAILURE_COPY[extracted.reason]);
    return `failed (${extracted.reason})`;
  }

  const page = extracted.page;

  /**
   * The model runs on both paths, not only when structured data is missing: a
   * JSON-LD page still arrives in the wrong language, with no Tags and no
   * Substitutes. What differs is what it is given — facts to restructure, or
   * prose to read (see lib/import/prompt.ts).
   */
  console.log(`  extracted via ${page.path}, asking the model`);
  const generated = await generateRecipe(page, sourceUrl, tags);

  /**
   * The photo is fetched once, here, and stored in our own Blob (OR-43). Done
   * after the model rather than before: an import that was going to fail should
   * not leave a stored image behind with nothing pointing at it.
   */
  const imageUrl = page.imageUrl
    ? await storeImageFromUrl(page.imageUrl, sourceUrl)
    : null;
  if (page.imageUrl) console.log(`  image ${imageUrl ? "stored" : "skipped"}`);

  if (generated.ok) {
    const payload = { ...generated.payload, imageUrl };
    await markReady(id, payload, generated.inferred);
    const { ingredientLines, steps, tagSlugs } = payload;
    return `ready (${page.path} + model, ${ingredientLines.length} ingredients, ${steps.length} steps, tags: ${tagSlugs.join(", ") || "none"}${imageUrl ? ", image" : ""})`;
  }

  /**
   * The model failed. A structured page can still become a usable Draft without
   * it — untranslated and untagged, but with every quantity the site published.
   * That is worth more to the reviewer than a failure message.
   */
  const built = buildPayload(page, sourceUrl);

  if (built.ok) {
    await markReady(id, { ...built.payload, imageUrl }, ["translation"]);
    return `ready (${page.path}, no model: ${generated.reason})`;
  }

  await markFailed(id, FAILURE_COPY[built.reason]);
  return `failed (model ${generated.reason}, then ${built.reason})`;
}

async function main(): Promise<void> {
  const reclaimed = await reclaimStale();
  if (reclaimed > 0) console.log(`reclaimed ${reclaimed} stuck draft(s)`);

  /**
   * The closed list, read once. The model picks Tags by slug out of this, so a
   * Tag the Master adds later is available to imports with no code change —
   * and one the model invents is rejected before it reaches the database.
   */
  const tags: TagOption[] = await db
    .select({ slug: tag.slug, label: tag.label, facet: tag.facet })
    .from(tag);

  let handled = 0;

  for (;;) {
    const draft = await claimNextDraft();
    if (!draft) break;

    handled += 1;
    console.log(`claimed ${draft.id} ${draft.sourceUrl}`);

    try {
      console.log(`  ${await process(draft.id, draft.sourceUrl, tags)}`);
    } catch (error) {
      /**
       * The catch-all matters more than it looks: without it a thrown step
       * leaves the row in `processing`, where it sits until the reclaim timeout
       * rather than telling anyone what went wrong. Every failure path ends with
       * the row moved and a Polish reason on it.
       */
      console.error(`  crashed:`, error);
      await markFailed(draft.id, copy.imports.failures.crashed);
    }
  }

  console.log(handled === 0 ? "nothing to do" : `done, ${handled} draft(s)`);
}

await main();
