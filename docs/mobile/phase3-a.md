# Phase 3 · Spec A — Recipe editor, image upload, delete/undo, Draft review

## Before anyone starts: the user runs these (from the repo root)

```bash
npx -y pnpm@10.33.2 --filter mobile add "expo-image-picker@~57.0.20" "expo-image-manipulator@~57.0.21" expo-share-intent@^8.0.1
```

Where the versions come from:

- **expo-image-picker / expo-image-manipulator:** Expo SDK 57's
  `bundledNativeModules.json`, which is what `npx expo install` would choose.
- **expo-share-intent:** v8 is the line for SDK 57 per its compatibility table.
  Its peer dependencies are `expo ^57`, `expo-constants`, `expo-linking`, all
  already installed. It does not run in Expo Go.

**A native rebuild is needed.** After Spec B adds the plugins to `app.json`,
run this once in `apps/mobile`:

```bash
npx expo prebuild --clean && npx expo run:android
```

`apps/mobile/android/` is generated output and stays uncommitted. Until the
rebuild, the old dev client will crash on the new native modules, so the
implementers can only verify with typecheck, test and `expo export`.

---

Branch `feat/mobile`. Spec B (import queue, share intent, toasts, settings,
account, navigation) works in the same checkout at the same time.

Read first:
- `AGENTS.md`
- `docs/adr/0007-native-android-app.md`
- `packages/core/src/api.ts` (the contract, including the new
  `POST /api/v1/images`)
- the web reference, `apps/web/components/`:
  - `recipe-editor.tsx`, `ingredient-lines-editor.tsx`, `line-list-editor.tsx`
  - `tag-picker.tsx`, `image-field.tsx`
  - `new-recipe-form.tsx`, `edit-recipe-form.tsx`
  - `delete-recipe-dialog.tsx`, `draft-review-form.tsx`
  - `reimport-diff.tsx`, `reimport-button.tsx`
- the mobile app as it stands, especially `components/ui/*` and `lib/*`

## Rules (both specs)

- **No installs, no `package.json` edits, no commit/stash/reset/checkout.**
  The orchestrator commits after a Haiku review.
- **Touch only the files under "You own".** Everything else is read-only,
  including `apps/web/**`, `packages/core/**`, all of B's files, and the
  existing `components/ui/*`, `lib/{api,auth,url,image,image-source,theme,palette,query-client,sign-out}.*`.
- **Copy:** all user-facing text comes from `@openrecipe/core/copy` (Polish).
  **Spec B is the only owner of `copy.ts` additions.** You reuse existing keys.
  The editor's strings already exist (`copy.editor.*`, `copy.validation.*`,
  `copy.imports.*`, `copy.common.*`). If you truly need a new one, use the
  nearest existing key for now and list the missing string in your report.
- **Look:** snack arcade, using the kit in `components/ui`. Tokens only, no
  hex. The announcer is MC Kiełbas. Never write "Bożenka".
- **Reuse core, do not reimplement:**
  - `recipe-schema`: `recipeSchema`, `emptyRecipe`, `toFormValue`,
    `IMAGE_RULES`, `checkImage`, `MAX_TAGS`
  - `form-errors`: `toFieldErrors`, `firstErrorField`
  - `inferred`: `guessedFields`
  - `import/diff`: `diffRecipes`, `patchFor`, `isTaken`, `lineText`
  - `drafts`
- **Admin-only UI.** Every entry point in this spec renders only when
  `useMe().data?.isAdmin` is true. The server already refuses Members; the UI
  must not offer what will fail.
- Done means all of these pass:
  - `npx -y pnpm@10.33.2 -r typecheck`
  - `npx -y pnpm@10.33.2 -r test`
  - `npx -y pnpm@10.33.2 -r lint`
  - `cd apps/mobile && npx expo export --platform android --output-dir <tmp>`

  Do not leave `expo start` running.

## You own

| Path | What |
|---|---|
| `apps/mobile/components/editor/**` | `RecipeEditor` and its parts (fields, ingredient lines, list editor, tag picker, image field, guessed chip, reimport diff) |
| `apps/mobile/app/editor/new.tsx` | new Recipe (prefill `sourceUrl` from `?source=`, like the web) |
| `apps/mobile/app/editor/[slug].tsx` | edit Recipe |
| `apps/mobile/app/drafts/[id].tsx` | Draft review |
| `apps/mobile/app/recipe/[slug].tsx` | **add** admin actions only: Edytuj, Usuń, Importuj ponownie |
| `apps/mobile/lib/hooks/editor.ts` | Recipe mutations and image upload |
| `apps/mobile/lib/upload.ts` + `upload.test.ts` | pure helpers for the upload (RN-free, node-testable) |

B owns the shell (`app/_layout.tsx`, `app/(tabs)/**`), `app.json`,
`lib/hooks/drafts.ts`, `components/ui/toast.tsx`, the drafts list, settings,
account and `copy.ts`.

## What you use from B (do not edit; import by these names)

```ts
// lib/hooks/drafts.ts
useDraft(id: string)                 // GET /api/v1/drafts/:id → { draft, tags }, key ["draft", id]
useApproveDraft(id: string)          // mutate({ input, recipeId? }) → SaveResult; invalidates drafts, home, search, recipe
useRetryDraft()                      // mutate(id) → { ok }
useDiscardDraft()                    // mutate(id) → { ok }
// components/ui/toast.tsx — global host, mounted by B in the root layout
showToast(t: { message: string; action?: { label: string; onPress: () => void }; kielbas?: boolean; durationMs?: number }): void
```

The routes `/drafts` (a tab, the list) and `/account` are B's. After a reimport
or a park, navigate to `/drafts`.

## What B uses from you

- The routes `/editor/new`, `/editor/[slug]` and `/drafts/[id]`. B links to
  them: the Home header's "Dodaj przepis" button, and taps on a ready Draft.
- B adds your three routes to the signed-in `Stack.Protected` group in the
  root layout. Don't edit the layout.

## Work

### 1. `RecipeEditor` — one form for new, edit and Draft review (as on the web)

Props mirror the web's `RecipeEditor`:

```ts
{
  initial?: RecipeFormValue;
  tagGroups: FacetGroup[];
  onSubmit: (v: RecipeFormValue) => Promise<SaveResult>;
  heading: string;
  inferred?: string[];
  banner?: ReactNode | ((h: { value; apply(patch) }) => ReactNode);
  submitLabel?: string;
  extraActions?: ReactNode;
}
```

Fields:
- **Title.**
- **Servings, minutes, kcal:** numeric keyboard. Empty means `null`, matching
  how the web's schema treats empty strings.
- **Source URL.**
- **Image:** see §2.
- **Ingredient lines:** quantity, unit, item, note. Substitutes ride along
  untouched, as on the web.
- **Steps and tips:** list editors.
- **Tags:** `TagChip`s grouped by Facet, a closed list from `tagGroups`, at
  most `MAX_TAGS` (5). Disable the rest at the cap and show the web's hint.

**Reordering is up/down buttons, not drag.** Why:
- Drag needs gesture-handler, a new native dependency and a rebuild.
- Drag fights the ScrollView on long lists.
- Buttons are accessible (labelled from copy) and a long press can't misfire
  while cooking.

Each row gets ↑ ↓ ✕ plus "add line". The first row's ↑ and the last row's ↓
are disabled.

Validation runs exactly like the web:
- `recipeSchema.safeParse` on submit.
- `toFieldErrors` puts messages under the fields.
- `firstErrorField` scrolls to the first error (keep a ref per field and use
  the ScrollView's `scrollTo`).
- Validate a single field on blur, without flagging fields not touched yet.
- Server `{ ok:false, errors }` shows as a list at the top.

Guarding:
- Use a double-submit guard ref. The web found that state alone lets three
  saves through.
- When the form is dirty, leaving prompts first: use `usePreventRemove` or a
  `beforeRemove` listener with an `Alert` built from the web's
  unsaved-changes copy.

Guessed fields: `guessedFields(inferred)` marks fields with the
"zgadywane" chip (`copy.imports.guessed`). Tapping it shows
`copy.imports.guessedHint` in a small popover or `Alert`, mirroring the web's
`GuessedChip`.

### 2. Image (OR-22) — pick, resize, upload

1. Pick with `expo-image-picker` `launchImageLibraryAsync({ mediaTypes: ["images"], quality: 1 })`.
   This uses the Android system photo picker, so no permission is needed. A
   camera option is welcome but optional; if you add one, tell B the
   permission string to put in `app.json`.
2. Resize with `expo-image-manipulator`: fit to 1200 px wide (core
   `MAX_IMAGE_WIDTH` lives in web `lib/image-resize.ts`, so copy the constant
   1200 with a comment). Never upscale. Encode WebP at 0.85.
3. Check with core `checkImage({ type, size })` before uploading. Show its
   message on failure.
4. Upload with **`POST /api/v1/images`**: body is the raw bytes,
   `Content-Type: image/webp`, `Cookie: getCookie()`, `credentials: "omit"`,
   to `${API_URL}/api/v1/images` → `{ url }`. Do not use `api()`: it always
   sends JSON. Get the bytes with `fetch(localUri).then(r => r.arrayBuffer())`.
   - The orchestrator already built and committed this endpoint
     (`apps/web/app/api/v1/images/route.ts`). It is admin-only, accepts
     jpeg/png/webp up to `IMAGE_RULES.maxBytes` and puts to the private Blob
     store.
   - The web's `/api/blob/upload` client-upload protocol is **not** used on the
     phone.
5. Show progress (a spinner is fine) and let the user cancel or remove.
   Removing or replacing an image uploaded in this session (not yet saved)
   calls `POST /api/v1/images/delete`. That is the web's rule: images the
   Recipe already had are deleted by the server on save, never here.
6. Preview with `recipeImage(url)` from `lib/image`.

Put the pure parts in `lib/upload.ts` with a node test: the fit-width maths and
the "was this uploaded in this session" bookkeeping.

### 3. Screens

- **`/editor/new`:** `useTags()`, then `POST /api/v1/recipes`. On success,
  replace the route with `/recipe/[slug]` and invalidate `home` and `search`.
- **`/editor/[slug]`:** `useRecipe(slug)`, then `toFormValue(recipe)`, then
  `PUT /api/v1/recipes/:id`. On success, go back and invalidate
  `["recipe", slug]`, `home` and `search`. A 404 gets the not-found state, as
  on the Recipe screen.
- **`/drafts/[id]`:** `useDraft(id)`. Banner: "Zrobione z linku" plus the
  source URL (http(s) only, as on the Recipe screen). Editor prefilled with
  `draft.payload`, `inferred={draft.inferred}`.
  - **Approve:** `submitLabel = copy.imports.approve`, calls
    `useApproveDraft(id)` with `recipeId: draft.recipeId ?? undefined`. On
    success go to `/recipe/[slug]` and `showToast` with MC Kiełbas. On
    `{ ok:false }` with `copy.imports.notReady`, show it and offer a way back
    to `/drafts`.
  - **Retry and Discard** go in `extraActions`, each with an `Alert` confirm
    for discard.
  - **Re-import** (`draft.current` is set): the banner render prop shows the
    diff from `diffRecipes(draft.current, draft.payload)`. Each row has
    "take this one" (`apply(patchFor(field, payload))`, disabled when
    `isTaken`). The editor starts from `draft.current`, **not** the payload,
    exactly as the web does (`draft-review-form.tsx`). Ingredient lines
    render with `lineText`.
  - A 404 (not `ready` anymore) gets a friendly state using
    `copy.imports.notReady`.
- **`/recipe/[slug]`, admin only:** a header-right menu (an `ActionSheet`-like
  `Modal` from the kit, or three icon buttons) with:
  - **Edytuj** → `/editor/[slug]`.
  - **Usuń** → an `Alert` confirm that names the Recipe, as the web's
    `delete-recipe-dialog.tsx` does with its copy. Then
    `DELETE /api/v1/recipes/:id`, then `router.back()`, then
    `showToast({ message: <web's deleted copy>, action: { label: copy.common.undo, onPress: restore } })`.
    Restore calls `POST /api/v1/recipes/:id/restore` and on success reopens
    the Recipe. It fails quietly after the server's grace window, like the
    web. Invalidate `home`, `search` and `["recipe"]`.
  - **Importuj ponownie:** only when `sourceUrl` is set. It calls
    `POST /api/v1/recipes/:id/reimport` (confirm first, as the web's
    `reimport-button.tsx` does), then `showToast` and navigates to `/drafts`.

### 4. Hooks — `lib/hooks/editor.ts`

`useCreateRecipe`, `useUpdateRecipe(id)`, `useDeleteRecipe`,
`useRestoreRecipe`, `useReimport`, `uploadImage(localUri)`,
`deleteUploadedImage(url)`. All use `api()` except the upload. Each
invalidates what the matching web action revalidates.

## API

There are no new endpoints for you to write. `POST /api/v1/images` is done.
Everything else exists. If something is missing, report it; do not touch
`apps/web` or `packages/core`.

## Check

- `lib/upload.test.ts`, as described above.
- In your report:
  - what you verified, on the emulator if the user rebuilt, otherwise via
    export;
  - any interface from B you needed differently;
  - any missing copy strings.
- A Haiku review follows. Keep the diff free of drive-by refactors.
