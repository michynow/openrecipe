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
import type { ShoppingList } from "./shopping-list.ts";
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
    /** Section heading (ADR-0008); lines arrive contiguous, ungrouped first. */
    section: string | null;
    substitutes: { item: string; note: string | null }[];
  }[];
  tags: ChipTag[];
};

export type CookLogSummary = { times: number; lastCookedAt: Iso | null };

export type FacetGroup = { facet: Facet; tags: { slug: string; label: string }[] };

export type SaveResult =
  | { ok: true; slug: string; id: string }
  /** `reason` is for code to branch on; `errors` are Polish, for people. */
  | { ok: false; errors: string[]; reason?: "not-ready" };

export type ParkResult =
  | { ok: true; id: string; alreadyQueued: boolean }
  | { ok: true; id: null; alreadyQueued: false; existingSlug: string }
  | { ok: false; error: string };

export type DraftRow = {
  id: string;
  sourceUrl: string;
  /** The Recipe title, once the Worker has written one. */
  title: string | null;
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
export type {
  ShoppingList,
  ShoppingListGroup,
  ShoppingListItem,
  ShoppingListRecipe,
} from "./shopping-list.ts";

/** Every Shopping List mutation answers with the fresh list. `ok: false` = the Recipe is gone. */
export type ShoppingListResult = { ok: boolean; list: ShoppingList };

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
    /** `shoppingListServings`: the servings it is on the Shopping List at, or null. */
    res: { recipe: RecipeDetail; cookLog: CookLogSummary; shoppingListServings: number | null };
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
  /**
   * admin. Upload a Recipe image: the body is the raw bytes (not JSON), with
   * Content-Type image/jpeg|png|webp, at most IMAGE_RULES.maxBytes. Returns the
   * Blob URL to put in the form's `imageUrl`. The phone calls it with its own
   * fetch, not `api()`, which always sends JSON.
   */
  "POST /api/v1/images": { body: never; res: { url: string } };
  /** admin. Drop an uploaded-then-abandoned blob. */
  "POST /api/v1/images/delete": { body: { url: string }; res: Ok };

  /** admin. Register this device for "Draft finished" pushes; a token moves to the caller. */
  "POST /api/v1/push-tokens": { body: { token: string }; res: Ok };
  /** user (so sign-out works after a demotion). Only deletes the caller's own token. */
  "POST /api/v1/push-tokens/delete": { body: { token: string }; res: Ok };

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

  /** The household Shopping List (ADR-0009). Any signed-in user, Members included. */
  "GET /api/v1/shopping-list": { body: never; res: ShoppingList };
  /**
   * Put a Recipe on the list (or replace its servings and exclusions if it is
   * already there). `excludedLineIds`: the lines ticked in this device's Pantry Check.
   */
  "POST /api/v1/shopping-list/recipes": {
    body: { recipeId: string; servings: number; excludedLineIds?: string[] };
    res: ShoppingListResult;
  };
  "PATCH /api/v1/shopping-list/recipes/:recipeId": { body: { servings: number }; res: ShoppingListResult };
  "DELETE /api/v1/shopping-list/recipes/:recipeId": { body: never; res: ShoppingListResult };
  /**
   * `key` from the ShoppingListItem on screen. The server stores its own merged
   * quantity with the tick; `ok: false` = no current row has that key.
   */
  "POST /api/v1/shopping-list/ticks": {
    body: { key: string; ticked: boolean };
    res: ShoppingListResult;
  };
  /** "ticked": drop ticked rows from the list; "all": empty it. */
  "POST /api/v1/shopping-list/clear": { body: { scope: "ticked" | "all" }; res: ShoppingListResult };

  "PATCH /api/v1/account/name": { body: { name: string }; res: AccountResult };
  /** Empty `currentPassword` = "I have none yet" (Google-only account). */
  "POST /api/v1/account/password": {
    body: { currentPassword: string; newPassword: string };
    res: AccountResult;
  };
};

export type Endpoint = keyof Api;
