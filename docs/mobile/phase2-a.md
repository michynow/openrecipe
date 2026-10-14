# Phase 2 · Spec A — Shell, look, Home, Search

## Before anyone starts: the user runs this once (from the repo root)

```bash
npx -y pnpm@10.33.2 --filter mobile add react-native-svg@15.15.4 "expo-image@~57.0.5" "expo-keep-awake@~57.0.2" @react-native-async-storage/async-storage@2.2.0 "expo-haptics@~57.0.3" "expo-font@~57.0.4" @expo-google-fonts/baloo-2@^0.4.2 @expo-google-fonts/nunito@^0.4.2 @tanstack/react-query-persist-client@5.104.2 @tanstack/query-async-storage-persister@5.104.2
```

The versions come from Expo SDK 57's `expo/bundledNativeModules.json` (what
`npx expo install` would choose), plus TanStack pinned to the installed
`@tanstack/react-query` 5.104.2. All of these work in Expo Go. Use pnpm 10 (the
global pnpm 9 rewrites the lockfile badly). Expected result: only
`apps/mobile/package.json` and `pnpm-lock.yaml` change.

**Who uses what.** A uses react-native-svg, expo-image, expo-font,
@expo-google-fonts/*, and expo-haptics. B uses expo-keep-awake, async-storage,
the TanStack persister packages, and expo-haptics.

Not installed on purpose:
- No bottom-sheet library: RN `Modal` is enough.
- No FlashList: `FlatList` is enough.
- No gesture-handler: nothing needs it.

---

Branch `feat/mobile`. Spec B (the Recipe screen, Pantry and offline) runs in
the same checkout at the same time.

Read first:
- `AGENTS.md`
- `docs/adr/0007-native-android-app.md` and `0004-pantry-check-is-browser-only.md`
- PRD §7.3–7.4 (Home and Search) and §10 (look)
- `packages/core/src/api.ts` (the contract)
- `apps/mobile/**` as it stands

## Rules (both specs)

- **No installs, no `package.json` edits.** The command above is the whole
  dependency change. If you need something else, stop and say so in your report.
- **Do not commit, stash, reset or checkout.** The orchestrator commits after a
  Haiku review.
- **Touch only the files under "You own".** Everything else is read-only,
  including `apps/web/**`, `packages/core/**` (exception below),
  `apps/mobile/lib/{api,auth,url}.ts`, and B's files.
- **Every user-facing string comes from `@openrecipe/core/copy`** (Polish,
  ADR-0005). The announcer is **MC Kiełbas**. Never write "Bożenka" anywhere,
  and never use an auntie persona.
- **No hex colours in components.** Hex lives in one place, the palette module
  below. Components use NativeWind classes or the theme hook.
- **Reuse core; do not reimplement.** That means `format`, `quantity`,
  `search-params`, `pixel`, `ingredient-sprites`, `tag-sprites`, `icons`,
  `blob` (`imageSrc`), `tags` (`FACETS`, `byFacet`) and `pantry`.
- Done means all of these pass:
  - `npx -y pnpm@10.33.2 -r typecheck`
  - `npx -y pnpm@10.33.2 -r test`
  - `npx -y pnpm@10.33.2 -r lint`
  - `cd apps/mobile && npx expo export --platform android`

  Do not leave `expo start` running.

## You own

| Path | What |
|---|---|
| `apps/mobile/app/_layout.tsx` | root: fonts, theme, persisted query client, auth gate, `Stack` |
| `apps/mobile/app/(tabs)/_layout.tsx` | bottom tabs: Start, Szukaj |
| `apps/mobile/app/(tabs)/index.tsx` | Home |
| `apps/mobile/app/(tabs)/search.tsx` | Search |
| `apps/mobile/app/index.tsx` | **delete** (the placeholder; Home replaces it) |
| `apps/mobile/app/login.tsx` | restyle into the arcade look; logic unchanged |
| `apps/mobile/components/ui/**` | shared UI kit (exports below; B imports these) |
| `apps/mobile/components/home/**`, `components/search/**` | screen parts |
| `apps/mobile/lib/palette.js`, `lib/theme.ts` | the single home of colour values |
| `apps/mobile/tailwind.config.js`, `global.css` | tokens, fonts, dark mode |
| `apps/mobile/lib/image.ts` | authenticated recipe images |
| `apps/mobile/lib/hooks/discovery.ts` | Home and Search queries |
| `packages/core/src/copy.ts` | **only you** may add keys, and only if one is truly missing |

B owns `app/recipe/**`, `components/recipe/**`, `lib/pantry.ts`,
`lib/query-client.ts` and `lib/hooks/recipe.ts`.

## Interfaces B depends on (build these exactly, early)

B imports these by these names and props. Change them only if you also say so
in your report.

```ts
// components/ui/pixel.tsx — react-native-svg; draws core's spriteLayers / icon GRIDS
export function PixelArt(props: { rows: readonly string[]; size?: number }): JSX.Element   // multi-colour sprite, px-* palette
export function IngredientSprite(props: { item: string; size?: number }): JSX.Element     // spriteFor(item) from core
export function Icon(props: { name: IconName; size?: number; tone?: Tone }): JSX.Element  // one-colour GRIDS[name], "#" pixels
// components/ui/tag-chip.tsx
export function TagChip(props: { tag: ChipTag; size?: "md" | "sm" }): JSX.Element
// components/ui/button.tsx — chunky press-in button: thick ink outline, hard shadow that collapses on press, light haptic
export function ArcadeButton(props: { label: string; onPress: () => void; tone?: "gold" | "accent" | "surface"; icon?: IconName; disabled?: boolean; accessibilityLabel?: string }): JSX.Element
// components/ui/card.tsx — surface panel with ink outline and hard shadow (web: section-card / rounded-card)
export function Card(props: { children: React.ReactNode; className?: string }): JSX.Element
// components/ui/kielbas.tsx — MC Kiełbas (port the web SVG in apps/web/components/help-button.tsx `Kielbas`) and a 2D-game dialogue box
export function Kielbas(props: { talking?: boolean; size?: number }): JSX.Element
export function DialogueBox(props: { lines: string[]; onDone?: () => void }): JSX.Element  // typewriter text, ▼ to advance
// lib/theme.ts
export type Tone = "ink" | "text" | "muted" | "accent" | "accent-ink" | "surface";
export function useTokens(): { color: Record<Tone | "bg" | "line" | "fill" | "gold" | "sausage" | "leaf" | "sky" | "accent2", string>; px: Record<string, string> }
// lib/image.ts — uses core imageSrc + API_URL + Cookie header (the private Blob is served by /api/image, which checks the session)
export function recipeImage(url: string | null): { uri: string; headers: { Cookie: string } } | null
```

B gives you `lib/query-client.ts`, which exports `queryClient` and
`persistOptions` (the persister plus a filter). Wrap the app in
`PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}`
from `@tanstack/react-query-persist-client`. **Do not** create your own
`QueryClient`.

B also owns the route `/recipe/[slug]`. Link cards to it with
`router.push({ pathname: "/recipe/[slug]", params: { slug } })`. Typed routes
are on, so this typechecks once B's file exists.

## Work

### 1. Tokens and look ("snack arcade")

What it should feel like: a cartoon 2D game you cook from.
- Custard background with a gingham tablecloth feel.
- A gold HUD header bar.
- Thick ink outlines and hard offset shadows.
- Chunky buttons that press in.
- Baloo 2 for display text, Nunito for body text (`@expo-google-fonts/*`,
  loaded in the root layout; keep the splash screen up until they load).

Mirror the web, don't invent:
- `apps/web/app/globals.css` (all `--color-*` including the `facet-*` ones,
  `--px-*`, radii, the dark block)
- `apps/web/components/*.tsx` (class names show the look)
- the memory note in PRD §10

Implementation:
- `lib/palette.js` (CommonJS, so `tailwind.config.js` can `require` it):
  light colours, dark colours and the px palette. This is the only file with hex.
- `lib/theme.ts` re-exports it typed, plus `useTokens()`, which picks
  light or dark from `useColorScheme()`. Use `useTokens()` for SVG
  `fill`/`stroke`, where classes don't reach.
- `tailwind.config.js` maps the names (`bg`, `surface`, `line`, …,
  `facet-meal` … `facet-vibe`) for classes. Dark mode follows the system
  (`app.json` already has `"userInterfaceStyle": "automatic"`). Use NativeWind's
  `dark:` variant or CSS variables in `global.css`; pick one, apply it everywhere.
- Facet colours on `TagChip` come from the web's `FACET_STYLE` map in
  `apps/web/components/tag-chip.tsx`. Copy the mapping (data, not logic), along
  with each facet's fallback icon.

### 2. Shell

- Root `Stack` with headers styled as the gold HUD. Keep the existing auth gate
  (session → app, none → `/login`).
- **Offline:** the gate must not bounce a signed-in user to `/login` just
  because the network is down. The expo client caches the session in
  SecureStore; check what `useSession()` does offline (airplane mode in Expo
  Go) and handle it.
- Show a thin banner with `copy.common.offline` when `expo-network` says there
  is no connection.
- `(tabs)`: Start (`copy.nav.dashboard`) and Szukaj (`copy.nav.search`), with
  pixel `Icon`s.
- Sign out (`copy.nav.signOut`) lives in the Home header for now. The account
  screen is Phase 3.

### 3. Home — `GET /api/v1/home`, `POST /api/v1/home/reroll`

Mirror `apps/web/app/(app)/page.tsx`, `components/proposals.tsx`,
`components/stat-widgets.tsx` and `components/recipe-card.tsx`:
- **Stat tiles** (scoreboard style). Members get `draftsWaiting: 0`, so hide
  that tile when it is 0.
- **Proposals:** one card per Meal Slot (breakfast, lunch, dinner, labelled
  from `copy.mealSlots`). A wildcard pick shows the web's wildcard hint. An
  empty slot uses the web's empty state.
- **Reroll:** "Coś innego" (the web's copy key) calls the reroll endpoint, then
  invalidates `["home"]`. Use a playful loading state, not a bare spinner.
- **Recent recipes:** a grid of `RecipeCard`s.
- **MC Kiełbas:** greets on Home in a `DialogueBox` with lines from
  `copy.help.pages.dashboard`. It can be dismissed and does not re-appear until
  the app restarts. No new copy is needed.
- Pull to refresh. Skeletons while loading (`fill` blocks). Error state uses
  `copy.common.somethingFailed` with a retry button.

### 4. Search — `GET /api/v1/search`, `GET /api/v1/tags`

Mirror `components/search-filters.tsx`, `search-results.tsx` and
`search-autocomplete.tsx` (the suggest endpoint is optional; skip it if time is
short):
- Text query (debounced about 300 ms).
- Facet filter chips grouped by Facet from `/tags`, a max-time option and a
  has-image toggle, all with the web's labels.
- **The query string is built and parsed only by core
  `search-params`** (`parseSearchFilters` and its builder). The screen state
  *is* that string, and the API query is the same string plus `cursor`. Do not
  hand-roll param names.
- Infinite scroll with `useInfiniteQuery` (`pageParam` = `nextCursor`) and
  `FlatList` `onEndReached`.
- Empty and no-results states from `copy.search`.

### 5. Hooks — `lib/hooks/discovery.ts`

`useHome()` with key `["home"]`, `useReroll()`, `useTags()` with key `["tags"]`
(staleTime 1 h), and `useSearch(qs)` with key `["search", qs]`, infinite. All go
through the existing `api()` from `lib/api.ts`.

## Endpoints

Everything you need already exists in `packages/core/src/api.ts` and
`apps/web/app/api/v1`. No API work in this phase. If something is missing,
report it; do not add it.

## Check

- Add one `node --test` file for any pure helper you write (for example a
  facet-style or tone map, if you put it in its own RN-free module). No
  React Native rendering tests.
- In your report, include screenshots or a description from Expo Go, if the
  user runs it, otherwise just `expo export`. Also list every interface above
  that you changed.
- A Haiku review follows. Keep the diff free of drive-by refactors.
