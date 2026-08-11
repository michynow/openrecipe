import {
  httpUrlSchema,
  recipeSchema,
  type Recipe,
} from "./recipe-schema.ts";

/**
 * The Draft status model (OR-38).
 *
 * A Draft is both a queue entry and a candidate Recipe; status is the only
 * difference. This module owns what may follow what, so the rule lives in one
 * place rather than being re-implemented by the Worker, the Drafts screen and
 * the review action — three callers who would drift apart.
 *
 *   queued ──▶ processing ──▶ ready ──▶ approved
 *      ▲            │            │
 *      │            ▼            ▼
 *      └───────── failed ──── discarded
 *
 * The arrows back into `queued` are retry (from failed or ready) and reclaim
 * (from processing, when the laptop was closed mid-run). `approved` and
 * `discarded` are terminal: a Draft that became a Recipe is finished, and
 * un-discarding is not a feature anyone asked for.
 */

/**
 * A parked link. Same http(s)-only rule as `recipe.sourceUrl`, because this URL
 * ends up there on approval — and because the Worker will fetch whatever this
 * accepts, which makes it a trust boundary rather than a formatting nicety.
 */
export const sourceUrlSchema = httpUrlSchema;

export const DRAFT_STATUSES = [
  "queued",
  "processing",
  "ready",
  "failed",
  "approved",
  "discarded",
] as const;

export type DraftStatus = (typeof DRAFT_STATUSES)[number];

const NEXT: Record<DraftStatus, readonly DraftStatus[]> = {
  queued: ["processing", "discarded"],
  // Back to queued is the reclaim; see isReclaimable below.
  processing: ["ready", "failed", "queued"],
  ready: ["approved", "discarded", "queued"],
  failed: ["queued", "discarded"],
  approved: [],
  discarded: [],
};

export function isDraftStatus(value: unknown): value is DraftStatus {
  return DRAFT_STATUSES.includes(value as DraftStatus);
}

export function canTransition(from: DraftStatus, to: DraftStatus): boolean {
  return NEXT[from].includes(to);
}

/**
 * Throws on an illegal move. The status column is plain text — Postgres will
 * store "banana" as happily as "ready" — so this is what actually holds the
 * model together. Every write of `status` goes through here.
 */
export function assertTransition(from: DraftStatus, to: DraftStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(`Illegal Draft transition: ${from} -> ${to}`);
  }
}

/**
 * How long a Draft may sit in `processing` before another run may take it back.
 *
 * Generous on purpose: the Worker fetches a page, calls a model and uploads an
 * image, and reclaiming a row that is merely slow would run the whole thing
 * twice. The failure this guards against is a closed laptop, which does not
 * resolve itself in ten minutes either way.
 */
export const RECLAIM_AFTER_MS = 10 * 60_000;

/**
 * Whether a claimed Draft has been abandoned. A `processing` row with no
 * `claimedAt` counts as stuck: nothing legitimately sets one without the other,
 * so the row predates its claim or was written by hand.
 */
export function isReclaimable(
  status: DraftStatus,
  claimedAt: Date | null,
  now: Date = new Date(),
): boolean {
  if (status !== "processing") return false;
  if (!claimedAt) return true;
  return now.getTime() - claimedAt.getTime() >= RECLAIM_AFTER_MS;
}

/**
 * A Draft's payload, validated against the same schema the editor and the Server
 * Action use. Returns null rather than throwing: a malformed payload is the
 * Worker's mistake, and the Drafts screen has to be able to say so instead of
 * rendering an error page.
 */
export function parseDraftPayload(payload: unknown): Recipe | null {
  const parsed = recipeSchema.safeParse(payload);
  return parsed.success ? parsed.data : null;
}

/**
 * `ready` means "a human can review this now", so it is the point where the
 * payload stops being optional. Enforced here rather than in the database: a
 * check constraint cannot run a Zod schema, and half-validating the shape in SQL
 * would be a second definition of a Recipe.
 */
export function assertReady(payload: unknown): Recipe {
  const recipe = parseDraftPayload(payload);
  if (!recipe) {
    throw new Error("A Draft cannot become ready without a valid payload");
  }
  return recipe;
}
