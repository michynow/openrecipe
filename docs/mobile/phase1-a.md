# Phase 1 · Spec A — `/api/v1` JSON Route Handlers

Branch `feat/mobile`. Read first: `AGENTS.md` (this Next.js is newer than your
training data — check `node_modules/next/dist/docs/01-app/` for Route Handlers,
`after`, `revalidatePath` before writing), `docs/adr/0007-native-android-app.md`,
`packages/core/src/api.ts` (**the contract — implement exactly this**).

Another implementer (Spec B) works in the same checkout at the same time.

## Rules of the shared checkout

- **Do not run `pnpm install` / `pnpm add` / anything that writes
  `pnpm-lock.yaml` or any `package.json`.** You need no new dependencies
  (zod, next, better-auth are already there). If you think you do, stop and say so.
- **Touch only the files listed under "You own".** Everything else is read-only
  for you — in particular `apps/web/lib/auth.ts`, `apps/web/package.json`,
  `apps/mobile/**`, `pnpm-workspace.yaml`, root `package.json` belong to B.
- Commit only your own files (`git add <paths>`, never `git add -A`). Every
  commit message ends with
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Do not push.

## You own

| Path | What |
|---|---|
| `apps/web/app/api/v1/**` | all new Route Handlers (list below) |
| `apps/web/lib/api.ts` | tiny shared helper for handlers (new) |
| `apps/web/lib/api.test.ts` | its test (new) |
| `apps/web/lib/invites.ts` | add `listInvites()` (extracted from settings page) |
| `apps/web/app/(app)/settings/page.tsx` | use `listInvites()` instead of its inline query |
| `apps/web/proxy.ts` | stop redirecting `/api/v1/*` to /login |
| `packages/core/src/api.ts` | the contract; you may correct it, B only reads it |

## The rule

Each handler is a thin twin of an existing Server Action or page read. Do **not**
move or change logic in `lib/`. Pattern, in order:

1. Guard: `requireUser()` or `requireAdmin()` from `@/lib/session` — same one the
   action/page uses. Map the throw to `401 {error:"unauthorised"}` /
   `403 {error:"forbidden"}` (the web pages 404 for Members; the API says 403).
2. Mutations: refuse unless `Content-Type` is `application/json` → `400`. This
   is our CSRF guard (Server Actions get an Origin check for free; Route
   Handlers do not). A cross-site form cannot send JSON without a CORS preflight,
   which we never answer.
3. Parse params/body with Zod → `400 {error:"bad-request", issues}`. Recipe
   bodies are **not** re-validated here: `createRecipe`/`updateRecipe` validate
   with `recipeSchema` themselves and return `{ok:false, errors}` — pass that
   through as 200, like the action.
4. Call the same `lib/` function(s) the action calls.
5. `revalidatePath` exactly the paths the action revalidates (so the web stays
   fresh after a mobile edit), and `after(() => wakeKitchen(id))` where the
   action does.
6. `Response.json(data)` where `data` satisfies `Api["<endpoint>"]["res"]`.
   Dates serialise to ISO strings on their own via `JSON.stringify`.

### `apps/web/lib/api.ts` (keep it ~40 lines)

```ts
import type { Api, Endpoint } from "@openrecipe/core/api";
export function ok<E extends Endpoint>(_e: E, data: Wire<Api[E]["res"]>): Response
export function fail(status: 400|401|403|404, error: ApiErrorCode, issues?): Response
export async function guard(kind: "user" | "admin"): Promise<CurrentUser | Response>
export async function jsonBody<T>(request: Request, schema: ZodType<T>): Promise<T | Response>
```

`Wire<T>` = T with `Date` allowed where the contract says `Iso`, so the lib's
`Date`-typed results typecheck against the contract (e.g.
`type Wire<T> = T extends Iso ? Iso | Date : T extends object ? {[K in keyof T]: Wire<T[K]>} : T`).
The `_e` argument is only there so each handler names its endpoint and the
compiler checks the shape — that is the contract test.

`guard` catches the `requireUser`/`requireAdmin` throw (messages start with
`Unauthorised` / `Forbidden`). Returning a `Response` from a helper and
`if (x instanceof Response) return x;` in the handler is fine — no middleware
framework.

## Sessions from the phone

Nothing new on the server for this spec. The Expo client (Spec B) stores Better
Auth's session cookie in SecureStore and sends it as a `Cookie` header with
`credentials: "omit"`. `getCurrentUser()` reads `headers()`, which in a Route
Handler are the request's headers, so `requireUser()` works unchanged for
browser cookie and phone alike. No bearer plugin.

`proxy.ts` currently redirects any request without a session cookie to
`/login` (HTML 307) — wrong for an API client. Add `api/v1` to the matcher's
negative lookahead (next to `api/auth`); the handlers authorise themselves.

## Endpoints → files → lib calls

All under `apps/web/app/api/v1/`. Dynamic params are `Promise`s in this Next
(`{ params }: { params: Promise<{ id: string }> }`) — check the docs.

| Endpoint (see `api.ts`) | File | Guard | Calls | Revalidate / after |
|---|---|---|---|---|
| GET `/me` | `me/route.ts` | user | `requireUser()` result | — |
| GET `/home` | `home/route.ts` | user | `searchRecipes({limit:8})`, `getDashboardStats()`, `getProposals(user.id)`; zero `draftsWaiting` for non-admins (as `app/(app)/page.tsx`) | — |
| POST `/home/reroll` | `home/reroll/route.ts` | user | `bumpReroll(user.id)` | `/` |
| GET `/search` | `search/route.ts` | user | `searchRecipes({...parseSearchFilters(url.searchParams), cursor})` (as `loadMoreSearchPage`) | — |
| GET `/search/suggest` | `search/suggest/route.ts` | user | copy of `app/api/search/suggest` logic (limit 8, empty q → `[]`) | — |
| GET `/tags` | `tags/route.ts` | user | `getTagsByFacet()` | — |
| GET `/recipes/by-slug/:slug` | `recipes/by-slug/[slug]/route.ts` | user | `getRecipeBySlug(slug)` → 404 if null; `getCookLog(recipe.id)` | — |
| POST `/recipes` | `recipes/route.ts` | admin | `createRecipe(body, user.id)` | if ok: `/`, `/search`, `/recipes/${slug}` |
| PUT `/recipes/:id` | `recipes/[id]/route.ts` | admin | `updateRecipe(id, body, user.id)` | same as create |
| DELETE `/recipes/:id` | same file | admin | `deleteRecipe(id)` → `{ok: slug!==null}` | if slug: `/`, `/search`, `/recipes/${slug}` |
| POST `/recipes/:id/restore` | `recipes/[id]/restore/route.ts` | admin | `restoreRecipe(id)` | same as delete |
| POST `/recipes/:id/cook-log` | `recipes/[id]/cook-log/route.ts` | admin | `logCooked(id, user.id)` | `/` |
| DELETE `/cook-log/:entryId` | `cook-log/[entryId]/route.ts` | admin | `undoCooked(entryId, user.id)` | if ok: `/` |
| POST `/recipes/:id/reimport` | `recipes/[id]/reimport/route.ts` | admin | `parkReimport(id, user.id)` | if id: `/drafts`, `/`; `after(wakeKitchen(id))` |
| POST `/images/delete` | `images/delete/route.ts` | admin | `deleteBlob(url)` (it ignores foreign URLs) | — |
| GET `/drafts` | `drafts/route.ts` | admin | `listDrafts()` | — |
| POST `/drafts` | same file | admin | `parkUrl(sourceUrl, user.id)` | if ok: `/drafts`, `/`; if `id && !alreadyQueued` → `after(wakeKitchen(id))` |
| GET `/drafts/pulse` | `drafts/pulse/route.ts` | admin | `listDraftPulse()` | — |
| GET `/drafts/:id` | `drafts/[id]/route.ts` | admin | `getDraftForReview(id)` → 404 if null; `getTagsByFacet()` | — |
| POST `/drafts/:id/approve` | `drafts/[id]/approve/route.ts` | admin | as `approveDraftAction`: `recipeId ? updateRecipe : createRecipe`, then `markApproved(id, result.id)` | `/drafts`, `/`, `/search`, `/recipes/${slug}` |
| POST `/drafts/:id/retry` | `drafts/[id]/retry/route.ts` | admin | `retryDraft(id)`, throw → `{ok:false}` (as `move()`) | if ok: `/drafts`; `after(wakeKitchen(id))` |
| POST `/drafts/:id/discard` | `drafts/[id]/discard/route.ts` | admin | `discardDraft(id)`, throw → `{ok:false}` | if ok: `/drafts` |
| GET `/settings` | `settings/route.ts` | admin | `listInvites()`, `listMembers()`, `listTagsWithUse()`, `getQueueSummary()` | — |
| POST `/settings/invites` | `settings/invites/route.ts` | admin | `mintInvite({createdById, email: trimmed or null})` | `/settings` |
| DELETE `/settings/invites/:id` | `settings/invites/[id]/route.ts` | admin | `revokeInvite(id)` | `/settings` |
| PATCH `/settings/members/:id` | `settings/members/[id]/route.ts` | admin | `setMemberRole(id, role)` | `/settings` |
| DELETE `/settings/members/:id` | same file | admin | `removeMember(id)` | `/settings` |
| POST `/settings/tags` | `settings/tags/route.ts` | admin | `addTag(facet, slug, label)` | `/settings`, `/recipes/new`, `/search` |
| PATCH `/settings/tags/:id` | `settings/tags/[id]/route.ts` | admin | `renameTag(id, label)` | `/settings`, `/search` |
| DELETE `/settings/tags/:id` | same file | admin | `deleteTag(id)` | `/settings` |
| PATCH `/account/name` | `account/name/route.ts` | user | as `updateNameAction`: empty → `{ok:false, copy.account.nameRequired}`; `auth.api.updateUser({body:{name}, headers: request.headers})` | `revalidatePath("/", "layout")` |
| POST `/account/password` | `account/password/route.ts` | user | as `changePasswordAction` (len < 8, `setPassword` when current is empty, else `changePassword` with `revokeOtherSessions: true`), `headers: request.headers` | — |

Notes:
- Settings actions currently ignore the lib results; the API returns them
  (`MemberResult`, `TagResult`) so the phone can explain a refusal. Don't change
  the Server Actions.
- `listInvites()`: move the `db.select(...).from(invite)...limit(20)` query out
  of `app/(app)/settings/page.tsx` into `lib/invites.ts` unchanged (keep the
  comment about Postgres' clock), and call it from both places.
- No slug-history redirects exist in this codebase; an unknown slug is a 404.
- Out of scope: image upload (the existing `/api/blob/upload` already accepts
  the cookie; Phase 2 decides how the phone uploads), invite sign-up (`/join`
  stays web-only), `/api/image/*` (already session-checked, phone sends Cookie).
- Leave the existing `/api/search/suggest` and `/api/drafts/pulse` alone; the
  web still uses them.

## Done when

- `pnpm -r typecheck`, `pnpm -r test`, `pnpm lint`, `pnpm --filter web build`
  all pass (B may be mid-change in other files; if their files break the build,
  report it, don't fix them). The build's route list shows every `/api/v1/*` path.
- `apps/web/lib/api.test.ts` (`node:test`, no framework) covers `jsonBody`:
  rejects non-JSON content type, rejects invalid body with `issues`, accepts a
  valid one. If `api.ts` imports `next/*` or `@/lib/session`, put the pure parts
  (`fail`, `jsonBody`) where the test can import them without Next — tests run
  under plain `node --test` with `.ts` relative imports.
- Every row of the table has a handler whose `ok("<endpoint>", …)` call
  typechecks against `api.ts` (this is the contract check).
- Optional manual smoke, if a dev server is already running: `curl -s
  localhost:3000/api/v1/me` → 200 in dev (devMaster), and with `NODE_ENV`
  production semantics a cookie-less call is `401` JSON, not a redirect.
- Commits: one for the helper + proxy + listInvites, then handlers in 2–3
  logical commits.
