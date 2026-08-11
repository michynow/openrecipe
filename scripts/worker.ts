import {
  claimNextDraft,
  markFailed,
  markReady,
  reclaimStale,
} from "../lib/draft-queue.ts";
import { copy } from "../lib/copy.ts";
import { extractRecipeFromUrl, type ExtractFailure } from "../lib/import/extract.ts";
import { buildPayload } from "../lib/import/payload.ts";

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
async function process(id: string, sourceUrl: string): Promise<string> {
  const extracted = await extractRecipeFromUrl(sourceUrl);

  if (!extracted.ok) {
    await markFailed(id, FAILURE_COPY[extracted.reason]);
    return `failed (${extracted.reason})`;
  }

  const built = buildPayload(extracted.page, sourceUrl);

  if (!built.ok) {
    await markFailed(id, FAILURE_COPY[built.reason]);
    return `failed (${built.reason}, via ${extracted.page.path})`;
  }

  await markReady(id, built.payload);

  return `ready (${extracted.page.path}, ${built.payload.ingredientLines.length} ingredients, ${built.payload.steps.length} steps)`;
}

async function main(): Promise<void> {
  const reclaimed = await reclaimStale();
  if (reclaimed > 0) console.log(`reclaimed ${reclaimed} stuck draft(s)`);

  let handled = 0;

  for (;;) {
    const draft = await claimNextDraft();
    if (!draft) break;

    handled += 1;
    console.log(`claimed ${draft.id} ${draft.sourceUrl}`);

    try {
      console.log(`  ${await process(draft.id, draft.sourceUrl)}`);
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
