# Sections + Shopping List · Spec W — all web UI

Branch `feat/mobile`. Spec M (`docs/mobile/sections-shopping-mobile.md`) builds
the same two features in `apps/mobile` at the same time, in the same checkout.
No file is shared between you.

The foundation is done and committed: database, migration, core logic, `lib/`,
Server Actions, `/api/v1`, and **every Polish string**. You build screens and
components only.

Read first:
- `AGENTS.md` — this Next.js (16) is not the one you know. Before touching any
  page, Server Action call or `params`, read the matching guide in
  `apps/web/node_modules/next/dist/docs/`. `params` is a Promise.
- `CONTEXT.md` — the glossary is binding: **Section**, **Shopping List**,
  **Shopping List Item**, **Shopping Export**, **Pantry Check**, **Member**.
- `docs/adr/0008-ingredient-sections-are-a-column.md`
- `docs/adr/0009-household-shopping-list.md`
- `PRD.md` §7.5, §7.9, §10 (theme)
- `packages/core/src/sections.ts`, `shopping-list.ts`, `shopping-export.ts`,
  `copy.ts` (`editor.*Section*`, `shoppingList.*`, `nav.shoppingList`),
  `api.ts` (`ShoppingList`, `ShoppingListResult`)
- `apps/web/app/(app)/shopping-list/actions.ts`, `apps/web/lib/shopping-list.ts`

## Rules

- **No installs, no `package.json` edits, no commit/stash/reset/checkout.** The
  orchestrator reviews and commits.
- **Touch only the files under "You own".** Everything else is read-only:
  `packages/core/**` (including `copy.ts`), `apps/mobile/**`, `apps/web/lib/**`,
  `apps/web/app/api/**`, `apps/web/app/(app)/shopping-list/actions.ts`.
- **Copy:** every user-facing string comes from `@openrecipe/core/copy`. All keys
  for both features already exist. **Nobody adds to `copy.ts`** — if a string is
  truly missing, use the nearest existing key and list the gap in your report;
  the orchestrator adds it.
- **Look:** snack arcade — a cartoon 2D game you cook from (PRD §10). Reuse the
  existing kit: `SectionCard`, `RowButton`, `GripButton` (`components/section-card.tsx`),
  `ConfirmButton`, `Icon` (`components/icons.tsx`; the new `cart` icon is there),
  `IngredientSprite`, the button/lip classes already used on the Recipe page.
  Tailwind tokens only (`bg-surface`, `border-line`, `text-accent`, `bg-fill`,
  `bg-gold`, …) — **no hex literal in a component**. The announcer is
  **MC Kiełbas**; **never write "Bożenka"** anywhere.
- **Reuse core, never reimplement:** `groupSections`, `moveLine`,
  `setLineSection`, `renameSection`, `removeSection`, `addSection`,
  `sectionNames`, `hasSections` (sections); `buildShoppingListText`
  (shopping-list); `formatScaledQuantity` (quantity); `count` (format).
- **Roles:** the Shopping List and "Dodaj do listy zakupów" are for **everyone
  signed in, Members included** (ADR-0009). Editing Sections is part of the
  editor, which stays Admin-only as today.
- Done means all of these pass:
  - `pnpm -r typecheck`
  - `pnpm -r test`
  - `pnpm lint`
  - `pnpm --filter web build`

  No dev server, no `db:migrate`.

## You own

| Path | What |
|---|---|
| `apps/web/components/ingredient-lines-editor.tsx` | Section editing (below) |
| `apps/web/components/cooking-panel.tsx` | grouped read view + the add-to-list control |
| `apps/web/components/add-to-shopping-list.tsx` | **new** client component |
| `apps/web/components/shopping-list.tsx` | **new** client component, the whole list screen |
| `apps/web/app/(app)/shopping-list/page.tsx` | **new** Server Component |
| `apps/web/app/(app)/recipes/[slug]/page.tsx` | read `getShoppingListServings`, pass it to `CookingPanel` |
| `apps/web/components/site-header.tsx` | "Lista zakupów" link, for everyone |
| `apps/web/app/globals.css` | only if a new class needs the game look |

`recipe-editor.tsx`, `draft-review-form.tsx` and `reimport-diff.tsx` need no
change: the editor is one component for create, edit and Draft review, so
Section editing in `ingredient-lines-editor.tsx` reaches all three, and
`lineText` already prints "Sos: …" in the diff. Touch them only if the compiler
makes you, and say so.

## Feature 1 — Sections

### Read view (`cooking-panel.tsx`)

- Render `groupSections(lines)`. The ungrouped run (section `null`) has no
  heading and comes first. Each Section gets a heading — display font, the
  Section's own text (it is Recipe data, not copy) — above its lines.
- Ticks (Pantry Check), Substitutes sheet, scaling and sprites stay per line,
  unchanged. Keys stay line ids.
- When `hasSections(lines)` is false the list looks exactly as it does today.
- The Shopping Export already heads Sections (core); pass the lines as now.
- The export button label is now `copy.recipe.export` ("Wyślij, czego
  brakuje") — it is the single-Recipe export, not the Shopping List.

### Editor (`ingredient-lines-editor.tsx`)

`values` is a flat `RecipeFormValue["ingredientLines"]` that is always
normalised (ungrouped first, each Section contiguous). Keep it one flat
`<ol>` — `useSortable` needs each line to be one direct `<li>` with its flat
index. Draw the Section heading **inside the first `<li>` of its group**, above
that line's fields (use `groupSections(values)` to know which index starts a
group, and `items[].index` for error keys `ingredientLines.${index}.item`).

- **Heading row** (first line of each named group): an input holding the
  Section name (`aria-label` `copy.editor.sectionName`), committed on blur/Enter
  with `renameSection(values, old, next)` — renaming onto an existing name
  merges, emptying it ungroups; a `RowButton` `copy.editor.removeSection`
  (`title`/hint `copy.editor.removeSectionHint`) → `removeSection(values, name)`;
  and a small "+ `copy.editor.addIngredient`" that calls
  `addSection(values, name, blankLine)` (appends a blank line to that Section).
- **Each line** gets a "move to Section" `<select>` labelled
  `copy.editor.moveToSection`: options `copy.editor.noSection` (value `""`) then
  `sectionNames(values)`. Change → `setLineSection(values, index, value || null)`.
- **Reorder:** the grip and ArrowUp/ArrowDown keep working through
  `useSortable`; replace `reorder(values, from, to)` with
  `moveLine(values, from, to)`. Crossing a heading moves the line into that
  Section — that is how lines move between Sections by drag.
- **"Dodaj część"** (`copy.editor.addSection`) next to "Dodaj składnik": opens
  an inline input (`copy.editor.sectionName`, placeholder
  `copy.editor.sectionPlaceholder`); confirming calls
  `addSection(values, name, blankLine)` and focuses the new line's item field.
  An empty name does nothing.
- When there are no Sections yet, show `copy.editor.sectionsHint` as a muted
  hint by the "Dodaj część" button.
- **Paste block:** pasted lines arrive ungrouped (`section: null`) — already so.
- Focus management, delete, error display: unchanged.

## Feature 2 — Shopping List

Server Actions (all return `ShoppingListResult = { ok, list }`; render
`result.list`, do not refetch; `ok: false` → `copy.common.somethingFailed`
toast and show the returned list):

```ts
addToShoppingListAction({ recipeId, servings, excludedLineIds })
setShoppingListServingsAction(recipeId, servings)
removeFromShoppingListAction(recipeId)
tickShoppingItemAction({ key, quantity, ticked })
clearShoppingListAction("ticked" | "all")
```

Server reads: `getShoppingList()` and `getShoppingListServings(recipeId)` from
`@/lib/shopping-list`.

### Recipe page entry (`recipes/[slug]/page.tsx`, `cooking-panel.tsx`, `add-to-shopping-list.tsx`)

- The page calls `getShoppingListServings(recipe.id)` alongside `getCookLog`
  and passes `shoppingListServings: number | null` to `CookingPanel`.
- `CookingPanel` renders `<AddToShoppingList recipeId servings={servings}
  checked={checked} onList={shoppingListServings} />` next to the export
  controls. `servings` is the stepper's current value; `checked` is the Pantry
  Check's ticked line ids.
- Button: `Icon cart` + `copy.shoppingList.add`. When `onList !== null`, show a
  badge `copy.shoppingList.onList` with `count(onList, copy.units.servings)`, and
  the button says `copy.shoppingList.update` (re-adding replaces servings and
  exclusions).
- When `checked.length > 0`, show `copy.shoppingList.pantryNote` under it —
  ticked lines stay off the list (ADR-0009). Send them as `excludedLineIds`.
- After success: a toast/inline confirmation `copy.shoppingList.added` with a
  link `copy.shoppingList.open` → `/shopping-list`. Pending: disable the button.

### `/shopping-list` (`page.tsx` + `shopping-list.tsx`)

- `page.tsx`: Server Component; `requireUser()` (Members allowed); reads
  `getShoppingList()`; renders the `<h1>` `copy.shoppingList.title` and
  `<ShoppingList initial={list} />`. Follow the other `(app)` pages for layout
  and metadata. The `?` help button picks topic `shoppingList` from the path by
  itself (`helpTopic`); its lines are in `copy.help.pages.shoppingList`.
- `shopping-list.tsx` (client): holds the list in state, applies each action's
  returned list; ticks are optimistic (`useOptimistic` or local state, rolled
  back on `ok: false`).
  - **Recipes** (`SectionCard`, `copy.shoppingList.recipes`): per recipe — title
    linking to `/recipes/{slug}`, a −/+ stepper (`copy.recipe.fewerServings`,
    `copy.recipe.moreServings`, 1–99) → `setShoppingListServingsAction`,
    `copy.shoppingList.skipped(n)` when `skipped > 0`, and a `RowButton`
    `copy.shoppingList.remove` → `removeFromShoppingListAction`.
  - **Items** (`SectionCard`, `copy.shoppingList.items`): one block per
    `group` (product heading `group.item` with `IngredientSprite`), its rows
    below. Row: a real checkbox (`aria-label` `copy.shoppingList.tick` /
    `untick` + item) → `tickShoppingItemAction({ key: row.key, quantity:
    row.quantity, ticked: !row.ticked })`; amount `formatScaledQuantity(row.quantity, 1)`
    + `row.unit` in mono, or `copy.shoppingList.toTaste` when `quantity` is null;
    sources under it: `copy.shoppingList.from` + titles, each a link. A group
    with one row may sit on one line. Ticked rows: struck through, muted, in
    place (no reordering under the thumb).
  - **Actions:** `copy.shoppingList.share` → `navigator.share({ text:
    buildShoppingListText(list) })`, falling back to clipboard + `copy.recipe.copied`
    exactly as `cooking-panel.tsx` does; `copy.shoppingList.clearTicked`
    (disabled when nothing is ticked); `ConfirmButton` `copy.shoppingList.clearAll`
    with `copy.shoppingList.clearAllConfirm`.
  - **Empty:** dashed empty-slot card with `copy.shoppingList.empty`.
- `site-header.tsx`: a `/shopping-list` link, `copy.nav.shoppingList`, for every
  signed-in user (not inside the admin-only group).

## Report

What you built, any file you had to touch outside "You own" and why, any copy
key you were missing, and the four verification commands' output.
