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
 *      ▲          │  ▲  │        │
 *      │          ▼  │  ▼        ▼
 *      │      limited  failed ── discarded
 *      └──────────┴─────┘
 *
 * The arrows back into `queued` are retry (from failed, ready or limited) and
 * reclaim (from processing, when the laptop was closed mid-run). `limited` is
 * the Master's Claude subscription running out mid-import: the Draft waits for
 * the reset and the Worker claims it again by itself — see isRetryDue. `approved` and
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
  "limited",
  "approved",
  "discarded",
] as const;

export type DraftStatus = (typeof DRAFT_STATUSES)[number];

/**
 * Steps inside `processing`, in the order the Worker takes them. Only the
 * progress bar reads these; nothing branches on them.
 */
export const DRAFT_STAGES = ["fetching", "generating", "image"] as const;

export type DraftStage = (typeof DRAFT_STAGES)[number];

/** One line of a Draft's log. `at` is an ISO timestamp; `msg` is Polish, shown as-is. */
export type DraftLogEntry = {
  at: string;
  level: "info" | "warn" | "error";
  msg: string;
};

export function isDraftStage(value: unknown): value is DraftStage {
  return DRAFT_STAGES.includes(value as DraftStage);
}

const NEXT: Record<DraftStatus, readonly DraftStatus[]> = {
  // To failed is the queue timeout; see isQueueExpired below.
  queued: ["processing", "failed", "discarded"],
  // Back to queued is the reclaim; see isReclaimable below.
  processing: ["ready", "failed", "queued", "limited"],
  // Back to processing is the Worker retrying after the reset; to queued is
  // "try now" from the Drafts screen.
  limited: ["processing", "queued", "discarded"],
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
 * How long a Draft may wait in `queued` for a Worker before it gives up.
 *
 * The Worker only runs when the Master starts it on their laptop, so a parked
 * link can otherwise wait forever and look like it is still coming. Three days
 * covers a weekend away; past that the link fails with a reason, and "try
 * again" puts it back with a fresh clock.
 */
export const QUEUE_MAX_MS = 3 * 24 * 60 * 60_000;

/** Whether a queued Draft has waited past QUEUE_MAX_MS since it was (re)queued. */
export function isQueueExpired(
  status: DraftStatus,
  queuedAt: Date,
  now: Date = new Date(),
): boolean {
  return status === "queued" && now.getTime() - queuedAt.getTime() >= QUEUE_MAX_MS;
}

/**
 * Whether a `limited` Draft may be claimed again. While limited, `queuedAt`
 * holds the retry time rather than when it entered the queue: one column for
 * "the Worker may take this from then on", in either status.
 */
export function isRetryDue(
  status: DraftStatus,
  queuedAt: Date,
  now: Date = new Date(),
): boolean {
  return status === "limited" && now.getTime() >= queuedAt.getTime();
}

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

/** What the header's toast poller sees of one Draft. */
export type DraftPulse = { id: string; status: DraftStatus; title: string | null };

/**
 * The Drafts that finished between two polls: were waiting on the Worker in
 * `before`, are `ready` or `failed` now. Anything not seen before is skipped —
 * the first poll after a page load is a baseline, not news, or every reload
 * would re-announce yesterday's Drafts.
 */
export function finishedSince(
  before: ReadonlyMap<string, DraftStatus>,
  now: readonly DraftPulse[],
): DraftPulse[] {
  const waiting = (s: DraftStatus | undefined) =>
    s === "queued" || s === "processing" || s === "limited";
  return now.filter(
    (d) => waiting(before.get(d.id)) && (d.status === "ready" || d.status === "failed"),
  );
}
