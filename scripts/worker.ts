import {
  appendLog,
  claimNextDraft,
  expireStaleQueued,
  markFailed,
  markLimited,
  markReady,
  reclaimStale,
  setStage,
} from "../lib/draft-queue.ts";
import { copy } from "../lib/copy.ts";
import { db } from "../lib/db/index.ts";
import { formatClock } from "../lib/format.ts";
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
  "not-found": copy.imports.failures.notFound,
  "not-html": copy.imports.failures.notHtml,
  "no-recipe-found": copy.imports.failedFallback,
  "needs-a-model": copy.imports.failures.needsModel,
  invalid: copy.imports.failures.invalid,
};

const L = copy.imports.log;

/**
 * Where this run is, for the log: a GitHub Actions run links to itself, so
 * "what happened" is one click from the Drafts screen.
 */
const WHERE = process.env.GITHUB_ACTIONS
  ? `GitHub Actions, ${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
  : "laptop";

const seconds = (since: number) => Math.round((Date.now() - since) / 1000);

/**
 * One Draft, start to finish. Returns what happened, for the console, and
 * whether the rest of the queue should wait for another run.
 */
async function importDraft(
  id: string,
  sourceUrl: string,
  tags: TagOption[],
): Promise<{ summary: string; stop?: boolean }> {
  await appendLog(id, "info", L.claimed(WHERE));
  await appendLog(id, "info", L.fetching(sourceUrl));

  const extracted = await extractRecipeFromUrl(sourceUrl);

  if (!extracted.ok) {
    await appendLog(
      id,
      "error",
      extracted.reason === "no-recipe-found" ? L.noRecipe : L.fetchFailed(extracted.detail ?? extracted.reason),
    );
    await markFailed(id, FAILURE_COPY[extracted.reason]);
    return { summary: `failed (${extracted.reason}${extracted.detail ? `: ${extracted.detail}` : ""})` };
  }

  const page = extracted.page;
  if (extracted.fetched) {
    const { status, bytes, ms } = extracted.fetched;
    await appendLog(id, "info", L.fetched(status, Math.round(bytes / 1024), ms));
  }
  await appendLog(
    id,
    "info",
    page.path === "json-ld" ? L.jsonLd(page.ingredients.length) : L.readableText(page.text?.length ?? 0),
  );

  /**
   * The model runs on both paths, not only when structured data is missing: a
   * JSON-LD page still arrives in the wrong language, with no Tags and no
   * Substitutes. What differs is what it is given — facts to restructure, or
   * prose to read (see lib/import/prompt.ts).
   */
  console.log(`  extracted via ${page.path}, asking the model`);
  await setStage(id, "generating");
  await appendLog(id, "info", L.modelStart);
  const modelStarted = Date.now();
  const generated = await generateRecipe(page, sourceUrl, tags);

  if (generated.ok) {
    const { ingredientLines, steps } = generated.payload;
    await appendLog(id, "info", L.modelOk(seconds(modelStarted), ingredientLines.length, steps.length));
  } else {
    const why = generated.detail ? `${generated.reason}: ${generated.detail}` : generated.reason;
    await appendLog(id, "warn", L.modelFailed(why, seconds(modelStarted)));
  }

  /**
   * The subscription ran out. Not a failure: the same link imports fine after
   * the reset, and a page-data fallback now would be an untranslated Draft the
   * Master has to fix by hand for want of a few hours. Checked before the image
   * so a Draft that is coming back later does not store its photo twice.
   */
  if (!generated.ok && generated.reason === "usage-limit") {
    await markLimited(id, generated.retryAt, L.limited(formatClock(generated.retryAt)));
    return { summary: `limited (retry after ${generated.retryAt.toISOString()})`, stop: true };
  }

  /**
   * The photo is fetched once, here, and stored in our own Blob (OR-43). Done
   * after the model rather than before: an import that was going to fail should
   * not leave a stored image behind with nothing pointing at it.
   */
  if (page.imageUrl) await setStage(id, "image");
  const imageUrl = page.imageUrl
    ? await storeImageFromUrl(page.imageUrl, sourceUrl)
    : null;
  if (page.imageUrl) {
    console.log(`  image ${imageUrl ? "stored" : "skipped"}`);
    await appendLog(id, imageUrl ? "info" : "warn", L.image(imageUrl !== null));
  }

  if (generated.ok) {
    const payload = { ...generated.payload, imageUrl };
    await markReady(id, payload, generated.inferred);
    const { ingredientLines, steps, tagSlugs } = payload;
    return {
      summary: `ready (${page.path} + model, ${ingredientLines.length} ingredients, ${steps.length} steps, tags: ${tagSlugs.join(", ") || "none"}${imageUrl ? ", image" : ""})`,
    };
  }

  /**
   * The model failed. A structured page can still become a usable Draft without
   * it — untranslated and untagged, but with every quantity the site published.
   * That is worth more to the reviewer than a failure message.
   */
  const built = buildPayload(page, sourceUrl);

  if (built.ok) {
    await appendLog(id, "warn", L.fallback);
    await markReady(id, { ...built.payload, imageUrl }, ["translation"]);
    return { summary: `ready (${page.path}, no model: ${generated.reason})` };
  }

  await markFailed(id, FAILURE_COPY[built.reason]);
  return { summary: `failed (model ${generated.reason}, then ${built.reason})` };
}

async function main(): Promise<void> {
  const expired = await expireStaleQueued();
  if (expired > 0) console.log(`expired ${expired} draft(s) that waited too long`);

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
      const { summary, stop } = await importDraft(draft.id, draft.sourceUrl, tags);
      console.log(`  ${summary}`);
      /**
       * A usage limit is the subscription's, not the page's: every Draft after
       * this one would hit it too and land in `limited` for nothing. They stay
       * queued for the next run — the cron after the reset, or a wake-up.
       */
      if (stop) {
        console.log("  usage limit hit, leaving the rest of the queue for the next run");
        break;
      }
    } catch (error) {
      /**
       * The catch-all matters more than it looks: without it a thrown step
       * leaves the row in `processing`, where it sits until the reclaim timeout
       * rather than telling anyone what went wrong. Every failure path ends with
       * the row moved and a Polish reason on it.
       */
      console.error(`  crashed:`, error);
      await appendLog(draft.id, "error", L.crashed((error as Error).message ?? String(error)));
      await markFailed(draft.id, copy.imports.failures.crashed);
    }
  }

  console.log(handled === 0 ? "nothing to do" : `done, ${handled} draft(s)`);
}

await main();
