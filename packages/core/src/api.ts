/**
 * The /api/v1 contract between apps/web (Route Handlers) and apps/mobile (client).
 * ADR-0007. Types only — nothing here runs.
 *
 * Wire shapes, not the server's: JSON has no Date, so every timestamp is an ISO
 * string. Handlers return `satisfies` these; the mobile client reads them. Change
 * a shape here first, then both sides follow the typechecker.
 *
 * Errors are always `{ error: ApiErrorCode }` with the matching status (plus
 * `issues` on a 400). Domain refusals are not errors: a save that fails
 * validation is a 200 with `{ ok: false, errors }`, exactly as the Server
 * Action returns it.
 */

import type { DraftLogEntry, DraftPulse, DraftStage, DraftStatus } from "./drafts.ts";
import type { RecipeFormValue, RecipeInput } from "./recipe-schema.ts";
import type { ChipTag, Facet } from "./tags.ts";

/**
 * An ISO 8601 timestamp. Branded so the server-side `Wire<T>` can widen exactly
 * these fields to `Date` and leave every other string alone. Still a string at
 * runtime and assignable to `string`; `new Date(iso)` reads it.
 */
export type Iso = string & { readonly __brand: "Iso" };

export type ApiErrorCode = "unauthorised" | "forbidden" | "not-found" | "bad-request";
export type ApiError = { error: ApiErrorCode; issues?: unknown };

export type Role = "master" | "admin" | "member";

/* ─────────────────────────────── Shapes ─────────────────────────────── */

export type Me = {
  id: string;
  email: string;
  name: string;
  image: string | null;
  role: Role;
  isMaster: boolean;
  isAdmin: boolean;
};

export type RecipeCard = {
  slug: string;
  title: string;
  imageUrl: string | null;
  totalMinutes: number | null;
  tags: ChipTag[];
};

export type SearchPage = { recipes: RecipeCard[]; nextCursor: string | null };

export type DashboardStats = {
  total: number;
  addedThisWeek: number;
  cookedThisWeek: number;
  /** Always 0 for a Member, as on the web dashboard. */
  draftsWaiting: number;
  mostCooked: { slug: string; title: string; times: number } | null;
  neglected: { slug: string; title: string; days: number | null } | null;
};

export type Proposal = {
  slot: "breakfast" | "lunch" | "dinner";
  recipe: RecipeCard | null;
  wildcard: boolean;
};

export type RecipeDetail = {
  id: string;
  slug: string;
  title: string;
  imageUrl: string | null;
  servings: number;
  totalMinutes: number | null;
  kcalPerServing: number | null;
  sourceUrl: string | null;
  steps: string[];
  tips: string[];
  createdAt: Iso;
  author: { name: string; image: string | null };
  lastEditor: { name: string } | null;
  ingredientLines: {
    id: string;
    quantity: number | null;
    unit: string | null;
    item: string;
    note: string | null;
    substitutes: { item: string; note: string | null }[];
  }[];
  tags: ChipTag[];
};

export type CookLogSummary = { times: number; lastCookedAt: Iso | null };

export type FacetGroup = { facet: Facet; tags: { slug: string; label: string }[] };

export type SaveResult =
  | { ok: true; slug: string; id: string }
  | { ok: false; errors: string[] };

export type ParkResult =
  | { ok: true; id: string; alreadyQueued: boolean }
  | { ok: true; id: null; alreadyQueued: false; existingSlug: string }
  | { ok: false; error: string };

export type DraftRow = {
  id: string;
  sourceUrl: string;
  status: DraftStatus;
  stage: DraftStage | null;
  error: string | null;
  recipeId: string | null;
  createdAt: Iso;
  queuedAt: Iso;
  claimedAt: Iso | null;
  log: DraftLogEntry[];
};

export type DraftForReview = DraftRow & {
  payload: RecipeFormValue;
  inferred: string[];
  current: RecipeFormValue | null;
  currentSlug: string | null;
};

export type Invite = {
  id: string;
  token: string;
  email: string | null;
  expiresAt: Iso;
  usedAt: Iso | null;
  revokedAt: Iso | null;
  /** Decided by Postgres' clock, the one `claimInvite` uses. */
  expired: boolean;
};

export type Member = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  role: Role;
  isMaster: boolean;
  joinedAt: Iso;
};

export type TagRow = { id: string; facet: Facet; slug: string; label: string; uses: number };

export type QueueSummary = { queued: number; ready: number; failed: number };

export type Ok = { ok: boolean };
export type MemberResult = { ok: true } | { ok: false; reason: "master" | "missing" };
export type TagResult =
  | { ok: true }
  | { ok: false; reason: "slug" | "duplicate" | "in-use" | "missing"; uses?: number };
/** `message` is already Polish copy, ready to show. */
export type AccountResult = { ok: boolean; message: string };

/* ─────────────────────────────── Routes ─────────────────────────────── */

/**
 * Every endpoint: `"METHOD /path"` → request body (or query) and response.
 * `:param` segments are path parameters. `admin` marks requireAdmin; the rest
 * need any signed-in user.
 */
export type Api = {
  "GET /api/v1/me": { body: never; res: Me };

  "GET /api/v1/home": {
    body: never;
    res: { recent: SearchPage; stats: DashboardStats; proposals: Proposal[] };
  };
  "POST /api/v1/home/reroll": { body: never; res: { n: number } };

  /** Query string is the /search URL contract (search-params.ts) plus `cursor`. */
  "GET /api/v1/search": { body: never; res: SearchPage };
  /** `?q=` — eight rows, empty for an empty query. */
  "GET /api/v1/search/suggest": { body: never; res: { recipes: RecipeCard[] } };
  "GET /api/v1/tags": { body: never; res: FacetGroup[] };

  "GET /api/v1/recipes/by-slug/:slug": {
    body: never;
    res: { recipe: RecipeDetail; cookLog: CookLogSummary };
  };
  /** admin */
  "POST /api/v1/recipes": { body: RecipeInput; res: SaveResult };
  /** admin */
  "PUT /api/v1/recipes/:id": { body: RecipeInput; res: SaveResult };
  /** admin. `ok: false` = already gone. */
  "DELETE /api/v1/recipes/:id": { body: never; res: Ok };
  /** admin. The undo; fails quietly once the grace window closes. */
  "POST /api/v1/recipes/:id/restore": { body: never; res: Ok };
  /** admin */
  "POST /api/v1/recipes/:id/cook-log": { body: never; res: { entryId: string } };
  /** admin. Undo of the above, own entries within the grace window only. */
  "DELETE /api/v1/cook-log/:entryId": { body: never; res: Ok };
  /** admin. Re-import from the Recipe's Source URL (OR-46). */
  "POST /api/v1/recipes/:id/reimport": { body: never; res: Ok };
  /** admin. Drop an uploaded-then-abandoned blob. */
  "POST /api/v1/images/delete": { body: { url: string }; res: Ok };

  /** admin */
  "GET /api/v1/drafts": { body: never; res: DraftRow[] };
  /** admin */
  "POST /api/v1/drafts": { body: { sourceUrl: string }; res: ParkResult };
  /** admin. What the toast poller reads. */
  "GET /api/v1/drafts/pulse": { body: never; res: { drafts: DraftPulse[] } };
  /** admin. 404 unless `ready` and its payload still parses. */
  "GET /api/v1/drafts/:id": {
    body: never;
    res: { draft: DraftForReview; tags: FacetGroup[] };
  };
  /** admin. `recipeId` set on a re-import: update in place. */
  "POST /api/v1/drafts/:id/approve": {
    body: { input: RecipeInput; recipeId?: string };
    res: SaveResult;
  };
  /** admin */
  "POST /api/v1/drafts/:id/retry": { body: never; res: Ok };
  /** admin */
  "POST /api/v1/drafts/:id/discard": { body: never; res: Ok };

  /** admin */
  "GET /api/v1/settings": {
    body: never;
    res: { invites: Invite[]; members: Member[]; tags: TagRow[]; queue: QueueSummary };
  };
  /** admin */
  "POST /api/v1/settings/invites": { body: { email?: string | null }; res: Ok };
  /** admin */
  "DELETE /api/v1/settings/invites/:id": { body: never; res: Ok };
  /** admin */
  "PATCH /api/v1/settings/members/:id": { body: { role: "admin" | "member" }; res: MemberResult };
  /** admin */
  "DELETE /api/v1/settings/members/:id": { body: never; res: MemberResult };
  /** admin */
  "POST /api/v1/settings/tags": { body: { facet: Facet; slug: string; label: string }; res: TagResult };
  /** admin */
  "PATCH /api/v1/settings/tags/:id": { body: { label: string }; res: TagResult };
  /** admin */
  "DELETE /api/v1/settings/tags/:id": { body: never; res: TagResult };

  "PATCH /api/v1/account/name": { body: { name: string }; res: AccountResult };
  /** Empty `currentPassword` = "I have none yet" (Google-only account). */
  "POST /api/v1/account/password": {
    body: { currentPassword: string; newPassword: string };
    res: AccountResult;
  };
};

export type Endpoint = keyof Api;
