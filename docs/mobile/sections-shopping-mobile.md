# Sections + Shopping List · Spec M — all mobile UI

Branch `feat/mobile`. Spec W (`docs/mobile/sections-shopping-web.md`) builds
the same two features in `apps/web` at the same time, in the same checkout.
No file is shared between you.

The foundation is done and committed: database, migration, core logic, the
`/api/v1` routes and their contract in `packages/core/src/api.ts`, and **every
Polish string**. You build screens, components and hooks only. No new native
module, so no rebuild: Expo Go / the existing dev build is enough.

Read first:
- `AGENTS.md`
- `CONTEXT.md` — the glossary is binding: **Section**, **Shopping List**,
  **Shopping List Item**, **Shopping Export**, **Pantry Check**, **Member**.
- `docs/adr/0007-native-android-app.md`, `0008-ingredient-sections-are-a-column.md`,
  `0009-household-shopping-list.md`
- `PRD.md` §7.5, §7.9, §10 (theme)
- `packages/core/src/sections.ts`, `shopping-list.ts`, `shopping-export.ts`,
  `copy.ts` (`editor.*Section*`, `shoppingList.*`, `nav.shoppingList*`,
  `help.pages.shoppingList`), `api.ts`
- the web reference for behaviour: `apps/web/app/(app)/shopping-list/actions.ts`
  and `apps/web/lib/shopping-list.ts` (read-only)

## Rules

- **No installs, no `package.json` edits, no commit/stash/reset/checkout, no
  prebuild.** The orchestrator reviews and commits.
- **Touch only the files under "You own".** Everything else is read-only:
  `packages/core/**` (including `copy.ts`), `apps/web/**`, `app/_layout.tsx`,
  `components/ui/*`, and `lib/{api,auth,url,image,theme,palette,query-client,sign-out,pantry}.*`.
- **Copy:** every user-facing string comes from `@openrecipe/core/copy`. All keys
  for both features already exist. **Nobody adds to `copy.ts`** — if a string is
  truly missing, use the nearest key and list the gap in your report; the
  orchestrator adds it.
- **Look:** snack arcade — a cartoon 2D game you cook from (PRD §10). Use the kit
  in `components/ui` (`Card`, `ArcadeButton`, `Icon` — the new `cart` icon is
  there — `IngredientSprite`, `StateView`, `showToast`, `HelpButton`) and
  NativeWind token classes; colours you need in JS come from `useTokens()`.
  **No hex literal in a component.** The announcer is **MC Kiełbas**; **never
  write "Bożenka"** anywhere.
- **Reuse core, never reimplement:** `groupSections`, `moveLine`,
  `setLineSection`, `renameSection`, `removeSection`, `addSection`,
  `sectionNames`, `hasSections`; `buildShoppingListText`;
  `formatScaledQuantity`; `count`/`plural` from `format`. The server merges the
  list — never merge on the phone.
- **Roles:** the Shopping List tab and "Dodaj do listy zakupów" are for
  **everyone signed in, Members included** (ADR-0009). Editing Sections lives in
  the editor, which stays Admin-only as today.

### Known gotchas (each has bitten this app before)

- **Hermes has no `Intl.PluralRules` and no `Intl.RelativeTimeFormat`.** Never
  call them, nor anything that needs them. Plurals and counts go through core
  `format` (`count`, `plural`), which is hand-rolled for exactly this reason.
- **The root layout always renders the `Stack`** and gates screens with
  `Stack.Protected` — **never a `<Redirect>`**. You should not need to touch
  `app/_layout.tsx` at all (a tab lives inside `(tabs)`, already protected). If
  you think you must, stop and report instead.
- **No `flex-1` inside an auto-height parent** — inside a `ScrollView`, a
  `Card`, or a row with no fixed height it collapses to zero. Use it only where
  the parent has a definite height (a screen root).
- **Admin-only screens use the existing `useAdminGate`/`AdminGateView`.** Nothing
  in this spec is admin-only except what already is (the editor); do not gate
  the Shopping List.
- **Every request and mutation goes through `lib/api.ts`** (`api("POST
  /api/v1/shopping-list/ticks", { body })`) — it sends the cookie, the JSON
  header the server's CSRF guard requires, and signs out on 401. No raw `fetch`.

Done means all of these pass:

- `npx -y pnpm@10.33.2 -r typecheck`
- `npx -y pnpm@10.33.2 -r test`
- `npx -y pnpm@10.33.2 -r lint`
- `cd apps/mobile && npx expo export --platform android --output-dir <tmp>`

Do not leave `expo start` running.

## You own

| Path | What |
|---|---|
| `apps/mobile/components/editor/ingredient-lines.tsx` | Section editing (below) |
| `apps/mobile/components/recipe/cooking-panel.tsx` | grouped read view + the add-to-list control |
| `apps/mobile/components/recipe/add-to-shopping-list.tsx` | **new** |
| `apps/mobile/components/shopping-list/**` | **new** list screen parts |
| `apps/mobile/app/(tabs)/shopping-list.tsx` | **new** tab screen |
| `apps/mobile/app/(tabs)/_layout.tsx` | the new tab, visible to everyone |
| `apps/mobile/lib/hooks/shopping-list.ts` | **new**: every Shopping List query and mutation |

`recipe-editor.tsx`, `reimport-diff.tsx`, `app/drafts/[id].tsx` and
`app/recipe/[slug].tsx` need no change: the editor is one component for
create, edit and Draft review, and core `lineText` already prints "Sos: …" in
the diff. Touch them only if the compiler makes you, and say so.

## Feature 1 — Sections

### Read view (`components/recipe/cooking-panel.tsx`)

- Render `groupSections(recipe.ingredientLines)`. The ungrouped run (section
  `null`) has no heading and comes first. Each Section gets a heading
  (`font-display`, the Section's own text — Recipe data, not copy) above its
  lines.
- Pantry Check ticks (`usePantry`), Substitutes sheet, scaling and sprites stay
  per line, keyed by line id, unchanged.
- No Sections (`hasSections` false) → looks exactly as today.
- The Shopping Export (`buildShoppingExport`) already heads Sections; pass the
  lines as now. Its button label is `copy.recipe.export` ("Wyślij, czego
  brakuje") — the single-Recipe export, not the Shopping List.

### Editor (`components/editor/ingredient-lines.tsx`)

`values` is the flat, normalised `RecipeFormValue["ingredientLines"]`. Render
`groupSections(values)`; use `items[].index` for everything index-based
(`ingredientLines.${index}.item` error keys, field registry refs).

- **Heading per named group:** an `Input` with the Section name
  (`accessibilityLabel` `copy.editor.sectionName`) committed on blur/submit
  with `renameSection(values, old, next)` — renaming onto an existing name
  merges, emptying it ungroups; a `RowButton` `copy.editor.removeSection`
  (hint `copy.editor.removeSectionHint`) → `removeSection(values, name)`; and an
  "add ingredient here" button calling `addSection(values, name, blank)` (it
  appends a blank line to that Section).
- **Reorder:** the existing ↑ ↓ `RowButton`s now call
  `moveLine(values, index, index ± 1)` instead of `move`. Moving past a
  heading moves the line into that Section, so ↑/↓ reach every position in
  every Section.
- **Move to Section:** a row action `copy.editor.moveToSection` opening a small
  picker (a modal or bottom sheet in the style of `substitutes-sheet.tsx`)
  listing `copy.editor.noSection` then `sectionNames(values)` →
  `setLineSection(values, index, choice)`.
- **"Dodaj część"** (`copy.editor.addSection`) beside "Dodaj składnik": an inline
  `Input` (`copy.editor.sectionName`, placeholder `copy.editor.sectionPlaceholder`)
  and a confirm button → `addSection(values, name, blank)`; empty does nothing.
  With no Sections yet, show `copy.editor.sectionsHint` under it, muted.
- Pasted lines arrive ungrouped (`section: null`), as now.

## Feature 2 — Shopping List

Endpoints (contract in `packages/core/src/api.ts`; all mutations answer
`ShoppingListResult = { ok, list }`):

```
GET    /api/v1/shopping-list                         → ShoppingList
POST   /api/v1/shopping-list/recipes                 { recipeId, servings, excludedLineIds? }
PATCH  /api/v1/shopping-list/recipes/:recipeId       { servings }
DELETE /api/v1/shopping-list/recipes/:recipeId
POST   /api/v1/shopping-list/ticks                   { key, quantity, ticked }
POST   /api/v1/shopping-list/clear                   { scope: "ticked" | "all" }
GET    /api/v1/recipes/by-slug/:slug                 → now also { shoppingListServings: number | null }
```

### Hooks (`lib/hooks/shopping-list.ts`)

- `useShoppingList()` — `useQuery({ queryKey: ["shopping-list"], ... })`.
- `useAddToShoppingList()`, `useSetShoppingListServings()`,
  `useRemoveFromShoppingList()`, `useTickShoppingItem()`, `useClearShoppingList()`
  — `useMutation`s through `api(...)`. On success:
  `qc.setQueryData(["shopping-list"], res.list)` and
  `qc.invalidateQueries({ queryKey: ["recipe"] })` (the Recipe page's
  `shoppingListServings`). `ok: false` → `showToast` `copy.common.somethingFailed`.
- Ticking is optimistic: `onMutate` flips `ticked` on that `key` in the cached
  list, `onError` restores the snapshot.

### Recipe screen entry (`cooking-panel.tsx`, `add-to-shopping-list.tsx`)

- `CookingPanel` already has `servings` (stepper) and `checked` (Pantry
  Check). It renders `<AddToShoppingList recipeId servings checked
  onList={shoppingListServings} />` near the export button. Read
  `shoppingListServings` from the same `useRecipe(slug)` data the screen
  already has (`recipe.data.shoppingListServings`) — pass it as a prop from the
  screen if `CookingPanel` only gets `recipe`; if that forces a change to
  `app/recipe/[slug].tsx`, it is allowed for that one prop.
- `ArcadeButton` with `Icon cart` + `copy.shoppingList.add`. When `onList !==
  null`: a badge `copy.shoppingList.onList` + `count(onList, copy.units.servings)`,
  and the button reads `copy.shoppingList.update`.
- `checked.length > 0` → `copy.shoppingList.pantryNote` under it; send `checked`
  as `excludedLineIds`.
- Success: `showToast` with `copy.shoppingList.added` and an action
  `copy.shoppingList.open` → `router.push("/shopping-list")`. Haptic on success,
  like the cook-log button.

### The tab (`app/(tabs)/shopping-list.tsx`, `app/(tabs)/_layout.tsx`, `components/shopping-list/**`)

- `_layout.tsx`: a `Tabs.Screen name="shopping-list"` after `search`, title
  `copy.nav.shoppingListShort`, `tabBarIcon: tabIcon("cart")`,
  `headerRight: help("shoppingList")`, **no `href` gating** — Members see it.
  The route file name makes the pathname `/shopping-list`, the same as the web.
- Screen: `useShoppingList()`. Loading → `StateView`; error →
  `StateView` with `copy.common.retry`; the list needs the network (it is
  shared), so offline is an error state, not a stale cache.
- **Recipes** `Card` (`copy.shoppingList.recipes`): title (press → `/recipe/{slug}`),
  a −/+ stepper (`copy.recipe.fewerServings` / `moreServings`, 1–99) →
  `useSetShoppingListServings`, `copy.shoppingList.skipped(n)` when
  `skipped > 0`, remove (`copy.shoppingList.remove`).
- **Items** `Card` (`copy.shoppingList.items`): per `group`, a product heading
  (`IngredientSprite` + `group.item`) and its rows. Row: a large tick target
  (`accessibilityRole="checkbox"`, `accessibilityState={{ checked }}`, label
  `copy.shoppingList.tick`/`untick` + item) → `useTickShoppingItem({ key,
  quantity, ticked: !row.ticked })`; amount `formatScaledQuantity(row.quantity, 1)`
  + unit in the mono font, or `copy.shoppingList.toTaste` when null; under it
  `copy.shoppingList.from` + source titles. Ticked rows: struck through and
  muted, **in place**.
- **Actions:** `copy.shoppingList.share` → `Share.share({ message:
  buildShoppingListText(list) })`; `copy.shoppingList.clearTicked` (disabled
  when nothing is ticked); `copy.shoppingList.clearAll` behind an `Alert`
  confirm with `copy.shoppingList.clearAllConfirm`.
- **Empty:** a dashed empty-slot card with `copy.shoppingList.empty`.
- Pull-to-refresh refetches (other household members tick too).

## Report

What you built, any file outside "You own" you had to touch and why, any copy
key you were missing, and the four verification commands' output.
