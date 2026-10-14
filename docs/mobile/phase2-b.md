# Phase 2 · Spec B — Recipe screen, Pantry Check, offline cache

Branch `feat/mobile`. Spec A (shell, look, Home, Search, shared UI kit) runs in
the same checkout at the same time. Dependencies are installed by the user
before you start (the command is at the top of `docs/mobile/phase2-a.md`). For
this spec that means expo-keep-awake, @react-native-async-storage/async-storage,
@tanstack/react-query-persist-client, @tanstack/query-async-storage-persister
and expo-haptics.

Read first:
- `AGENTS.md`
- `docs/adr/0004-pantry-check-is-browser-only.md` and `0007-native-android-app.md`
- PRD §7.5 (the Recipe/cooking view)
- `packages/core/src/api.ts`
- `apps/mobile/**`

## Rules (both specs)

- **No installs, no `package.json` edits.** If you need something more, stop
  and say so in your report.
- **Do not commit, stash, reset or checkout.** The orchestrator commits after a
  Haiku review.
- **Touch only the files under "You own".** Read-only for you: `apps/web/**`,
  `packages/core/**`, `apps/mobile/lib/{api,auth,url}.ts`, and all of A's files
  (`app/_layout.tsx`, `app/(tabs)/**`, `components/ui/**`, `lib/theme.ts`,
  `lib/palette.js`, `lib/image.ts`, tailwind and css).
- **Every user-facing string comes from `@openrecipe/core/copy`.** The cooking
  view's strings already exist (`copy.recipe.*`, `copy.common.offline`,
  `copy.units`, plurals in `format`). Do not edit `copy.ts`. If a string is
  truly missing, list it in your report and A or the orchestrator will add it.
- **The announcer is MC Kiełbas.** Never write "Bożenka".
- **No hex in components.** Use NativeWind classes, or `useTokens()` from A's
  `lib/theme.ts` for SVG props.
- **Reuse core, do not reimplement.** That covers `quantity`
  (`formatScaledQuantity`, `scaleQuantity`), `format` (`count`, `plural`,
  `formatDuration`, `formatDate`), `pantry` (`pantryKey`, `parsePantry`,
  `pantryEntry`, `today`), `ingredient-sprites`, `blob`, and
  `shopping-export` (if you add the share button).
- Done means all of these pass:
  - `npx -y pnpm@10.33.2 -r typecheck`
  - `npx -y pnpm@10.33.2 -r test`
  - `npx -y pnpm@10.33.2 -r lint`
  - `cd apps/mobile && npx expo export --platform android`

  Do not leave `expo start` running.

## You own

| Path | What |
|---|---|
| `apps/mobile/app/recipe/[slug].tsx` | the Recipe screen (a stack route, outside the tabs) |
| `apps/mobile/components/recipe/**` | its parts |
| `apps/mobile/lib/hooks/recipe.ts` | `useRecipe`, `useLogCooked`, `useUndoCooked` |
| `apps/mobile/lib/pantry.ts` | AsyncStorage glue over core `pantry` |
| `apps/mobile/lib/query-client.ts` | `queryClient` and `persistOptions` (A mounts them) |
| `apps/mobile/lib/persist.ts` + `persist.test.ts` | pure: which queries persist (RN-free, node-testable) |

## What you use from A (do not edit; import by these names)

```ts
import { IngredientSprite, Icon, PixelArt } from "../components/ui/pixel";   // react-native-svg
import { TagChip } from "../components/ui/tag-chip";
import { ArcadeButton } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Kielbas, DialogueBox } from "../components/ui/kielbas";
import { useTokens, type Tone } from "../lib/theme";
import { recipeImage } from "../lib/image";   // { uri, headers: { Cookie } } for expo-image, or null
```

The props are in phase2-a.md under "Interfaces B depends on". A writes them
early. If one isn't there yet, build against the documented signature anyway;
typecheck is judged when both of you are done.

## What A uses from you

`lib/query-client.ts` must export exactly:

```ts
export const queryClient: QueryClient;
export const persistOptions: Omit<PersistQueryClientOptions, "queryClient">;
```

The Recipe route file must exist at `app/recipe/[slug].tsx`. A links to it
with `router.push({ pathname: "/recipe/[slug]", params: { slug } })`.

## Work

### 1. Data — `lib/hooks/recipe.ts`

- `useRecipe(slug)`: key `["recipe", slug]`, calls
  `api("GET /api/v1/recipes/by-slug/:slug", { params: { slug } })`.
  A 404 (`ApiError.status === 404`) gets the web's not-found state
  (`copy.common`/`app/not-found.tsx` wording). Do not show a crash.
- `useLogCooked(recipeId)` calls `POST /api/v1/recipes/:id/cook-log`.
  `useUndoCooked()` calls `DELETE /api/v1/cook-log/:entryId`. Both invalidate
  `["home"]` (stats).
- **Cook log is admin-only on the server.** Show the button only when
  `useMe().data?.isAdmin`, exactly as the web does
  (`apps/web/app/(app)/recipes/[slug]/page.tsx`). Members see the count
  read-only.

### 2. Recipe screen — mirror `apps/web/app/(app)/recipes/[slug]/page.tsx` and `components/cooking-panel.tsx`

- **Hero image:** `expo-image` with `recipeImage(url)`, or the web's
  placeholder tile when there is none. Below it: title, time (`formatDuration`),
  kcal, author, and tags (`TagChip`).
- **Servings stepper:** −/+ with `copy.recipe.fewerServings` and
  `copy.recipe.moreServings` (labels), range 1–99. It is display state only;
  the Recipe never changes.
- **Ingredient lines:** `IngredientSprite`, then the amount via
  `formatScaledQuantity(line.quantity, servings / recipe.servings)` plus
  `line.unit` (as `cooking-panel.tsx` does), then the item and note.
- **Pantry ticks:** tap a row to tick it ("already have it"), struck through
  and dimmed, with a light haptic. The header shows the count, as on the web.
- **Substitutes:** a button on lines that have substitutes opens a bottom sheet
  (RN `Modal`, `animationType="slide"`, transparent backdrop, tap-out to close,
  Android back closes it). Mirror `components/substitutes-sheet.tsx` (the
  lack → works layout, the empty state `copy.recipe.noSubstitutes`, sprites).
- **Steps:** numbered, large readable text for cooking at arm's length.
  **Tips** underneath.
- **Keep-awake toggle:** `copy.recipe.wakeLock` (with the `wakeLockOn` hint)
  using `expo-keep-awake`'s `activateKeepAwakeAsync` /
  `deactivateKeepAwake` with a tag. Off by default. Always release it on
  unmount.
- **Cook log** (mirror `components/cook-log-button.tsx`): show times and
  last-cooked date. "Ugotowane!" (`copy.recipe.cooked`) updates optimistically.
  An **undo** is offered for 8 s (the web's `UNDO_WINDOW_MS`). On failure, roll
  back and show `copy.common.somethingFailed`. Make it juicy: a bounce, a
  haptic, and MC Kiełbas reacting via `Kielbas talking` is welcome. No new copy.
- Optional (the web has it): shopping-list share via RN's built-in `Share` with
  `buildShoppingExport`. Do it only if everything else is done.

### 3. Pantry — `lib/pantry.ts` (ADR-0004: on this device only, today only)

- Read and write with AsyncStorage under core's `pantryKey(recipeId)`. Write
  `pantryEntry(checked)`; read with `parsePantry(raw, today())`. This is the
  same format as the web's localStorage. Nothing goes to the server.
- Hook: `usePantry(recipeId, lineIds) → { checked: string[], toggle(id) }`.
  It loads once, updates optimistically, and drops ticks for lines that no
  longer exist (as the web does).
- A write failure must never crash cooking: catch it and keep the in-memory
  state.
- Verify that `today()` (`toLocaleDateString("sv-SE")`) returns
  `YYYY-MM-DD` on Hermes in Expo Go. If it doesn't, report it (core is
  read-only for you; the orchestrator will fix it).

### 4. Offline — `lib/query-client.ts`, `lib/persist.ts`

- Use `createAsyncStoragePersister({ storage: AsyncStorage })`.
  `persistOptions` gets `maxAge` 7 days, a `buster` (app version), and
  `dehydrateOptions.shouldDehydrateQuery`, which keeps only successful
  `["recipe", …]` queries.
- To bound the cache, keep only the most recent 20 recipes: set `gcTime` on
  recipe queries and prune the rest.
- The filter and pruning logic goes in `lib/persist.ts` as pure functions,
  with a `node --test` file next to it.
- `queryClient` defaults: `gcTime` 24 h, `retry` 1, and
  `networkMode: "offlineFirst"`, so cached recipes render with no network.
- Opening a previously viewed Recipe in airplane mode must show it, servings
  and pantry included. Members do not get cook log offline: the mutation fails,
  so show the error and roll back.

## Endpoints

Everything you need already exists: `GET /recipes/by-slug/:slug`,
`POST /recipes/:id/cook-log`, `DELETE /cook-log/:entryId` and `GET /me`. No
API or contract changes in this phase. If something is missing, report it.

## Check

- `lib/persist.test.ts` must cover: persists recipe queries; skips others;
  skips errored ones; prunes to the newest 20.
- In your report, include what you verified in Expo Go if the user runs it
  (offline reopen, keep-awake, pantry surviving an app restart, ticks resetting
  the next day), otherwise just `expo export`. Also list any interface from A
  you needed differently.
- A Haiku review follows. Keep the diff free of drive-by refactors.
