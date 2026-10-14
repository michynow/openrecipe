# Phase 3 · Spec B — Import queue, share intent, toasts, settings, account, navigation

Branch `feat/mobile`. Spec A (Recipe editor, image upload, delete/undo, Draft
review) works in the same checkout at the same time.

The user installs the dependencies before you start; the command is at the top
of `docs/mobile/phase3-a.md`. Yours is **`expo-share-intent` v8** (SDK 57).
**It needs a native rebuild**, and it does not run in Expo Go. You can't run
the rebuild yourself, so your verification is typecheck, tests and
`expo export`. The user rebuilds with
`npx expo prebuild --clean && npx expo run:android` in `apps/mobile`.

Read first:
- `AGENTS.md`
- `docs/adr/0007-native-android-app.md`
- `packages/core/src/api.ts`
- the expo-share-intent README and its `example/expo-router` folder on GitHub
  (achorein/expo-share-intent), for the current Expo Router wiring
- the web reference:
  - `apps/web/components/`: `park-url-form.tsx`, `draft-list.tsx`,
    `draft-toasts.tsx`, `account-forms.tsx`, `copy-invite-link.tsx`,
    `confirm-button.tsx`, `site-header.tsx`
  - `apps/web/app/(app)/settings/page.tsx`
  - `apps/web/app/(app)/account/page.tsx`
  - `apps/web/app/(app)/drafts/page.tsx`
- the mobile app as it stands

## Rules (both specs)

- **No installs, no `package.json` edits, no commit/stash/reset/checkout.**
  The orchestrator commits after a Haiku review.
- **Touch only the files under "You own".** Everything else is read-only,
  including `apps/web/**`, everything in `packages/core/**` except
  `copy.ts`, all of A's files, the existing `components/ui/*` (except your new
  `toast.tsx`), and `lib/{api,auth,url,image,image-source,theme,palette,query-client,sign-out}.*`.
- **Copy:** all user-facing text comes from `@openrecipe/core/copy` (Polish).
  **You are the only owner of `copy.ts` additions.** Add keys only where a
  string truly does not exist. A will list any strings it is missing in its
  report, and the orchestrator adds them after.
- **Look:** snack arcade, using the kit in `components/ui`. Tokens only, no
  hex. The announcer is MC Kiełbas. Never write "Bożenka".
- **Reuse core:** `drafts` (`finishedSince`, `DraftPulse`, statuses,
  `canTransition`), `format` (dates, counts, relative days), `tags`
  (`FACETS`), `api` types. Do not reimplement them.
- **Roles:** Drafts, park, share intent and Settings are admin-only, as are the
  Home "Dodaj przepis" button and the pulse polling. A Member never sees these
  entry points; the server refuses them anyway. Account is for everyone.
- Done means all of these pass:
  - `npx -y pnpm@10.33.2 -r typecheck`
  - `npx -y pnpm@10.33.2 -r test`
  - `npx -y pnpm@10.33.2 -r lint`
  - `cd apps/mobile && npx expo export --platform android --output-dir <tmp>`

  Do not leave `expo start` running.

## You own

| Path | What |
|---|---|
| `apps/mobile/app.json` | plugins: `expo-share-intent` (and `expo-image-picker` if A asks for a camera permission) |
| `apps/mobile/app/_layout.tsx` | ShareIntentProvider, toast host, AppState → `focusManager`, add A's routes and yours to the signed-in `Stack.Protected` group |
| `apps/mobile/app/(tabs)/_layout.tsx` | Drafts and Settings tabs (admin only), Home header: "Dodaj przepis" (admin) and account (everyone) |
| `apps/mobile/app/(tabs)/drafts.tsx` | park form plus Draft list |
| `apps/mobile/app/(tabs)/settings.tsx` | Invites, Members, Tags, queue summary |
| `apps/mobile/app/account.tsx` | name, password, sign out |
| `apps/mobile/components/drafts/**`, `components/settings/**`, `components/account/**` | screen parts |
| `apps/mobile/components/ui/toast.tsx` | **new** global toast host plus `showToast` |
| `apps/mobile/lib/hooks/drafts.ts` | every Draft hook (A imports four of them) |
| `apps/mobile/lib/hooks/admin.ts` | settings and account hooks |
| `apps/mobile/lib/share-intent.ts` + `.test.ts` | pure: pull an http(s) URL out of shared text |
| `apps/mobile/lib/pulse.ts` + `.test.ts` | pure: which pulses become which toasts (over core `finishedSince`) |
| `packages/core/src/copy.ts` | additions only, as above |

A owns `components/editor/**`, `app/editor/**`, `app/drafts/[id].tsx`, the
admin actions on `app/recipe/[slug].tsx`, `lib/hooks/editor.ts` and
`lib/upload.*`.

## Interfaces A depends on (build these exactly, early)

```ts
// lib/hooks/drafts.ts
export function useDrafts()                     // GET /api/v1/drafts, key ["drafts"]
export function useParkUrl()                    // mutate(sourceUrl) → ParkResult; invalidates ["drafts"], ["home"]
export function useDraft(id: string)            // GET /api/v1/drafts/:id → { draft, tags }, key ["draft", id]
export function useApproveDraft(id: string)     // mutate({ input, recipeId? }) → SaveResult; on ok invalidates ["drafts"], ["home"], ["search"], ["recipe"]
export function useRetryDraft()                 // mutate(id) → { ok }; invalidates ["drafts"], ["draft", id]
export function useDiscardDraft()               // mutate(id) → { ok }; invalidates ["drafts"], ["draft", id]
export function useDraftPulse(enabled: boolean) // GET /api/v1/drafts/pulse, refetchInterval 5 s while focused
// components/ui/toast.tsx
export function ToastHost(): JSX.Element        // mounted once in the root layout
export function showToast(t: { message: string; action?: { label: string; onPress: () => void }; kielbas?: boolean; durationMs?: number }): void
```

`showToast` is a module-level store (a listener set plus state), so it is
callable outside React, after a mutation.

Toast look:
- MC Kiełbas (`Kielbas talking`) in a dialogue-box toast above the tab bar.
- Default duration 6 s, or 8 s when there is an action (the web's undo window).
- One toast at a time, with new ones queued.
- Announce it for accessibility (`accessibilityLiveRegion="polite"`).

## Work

### 1. Navigation

- **Tabs:** Start, Szukaj, **Szkice** (admin), **Ustawienia** (admin). Hide
  the admin tabs for Members with `href: null`. Use pixel icons from the kit
  and labels from `copy.nav`.
- **Home header-right:**
  - "Dodaj przepis" (`copy.nav.addShort`), admin only → `/editor/new` (A's
    route).
  - An account button for everyone → `/account`. This replaces the bare
    sign-out text; sign-out moves to the account screen and still uses
    `lib/sign-out.ts`.
- **Root layout:**
  - Add `editor/new`, `editor/[slug]`, `drafts/[id]` and `account` to the
    signed-in `Stack.Protected` group. Keep the rest of the gate exactly as it
    is: always-mounted Stack, cookie fallback, splash.
  - Wire TanStack's `focusManager` to `AppState`, so polling and refetches
    pause in the background.

### 2. Park a URL and the Draft list — `(tabs)/drafts.tsx`

Mirror the web's drafts page:

**Park form** (`copy.imports.parkTitle`, `parkIntro`, `parkAction`):
- Validate http(s) on the client. The server validates with core
  `sourceUrlSchema`; show its error.
- Map the `ParkResult` the way `park-url-form.tsx` does:
  - `alreadyParked` → message.
  - `existingSlug` → `copy.imports.alreadyImported` with an "open it" link to
    `/recipe/[slug]`.
  - otherwise → `copy.imports.parked`.

**List:**
- Each row: status chip (status colours from the web's `StatusChip`, using
  tokens), source host, and elapsed time while queued or processing (tick
  every second only while visible).
- Progress stage labels come from `copy`.
- The log is expandable: `DraftLog` with time and message, links tappable,
  http(s) only.
- Ready rows → `/drafts/[id]` (A's review screen).
- Failed or limited rows: Retry. Every open row: Discard, with an `Alert`
  confirm.
- Pull to refresh. While anything is queued or processing, refetch every 5 s.
- Empty state from `copy`. A Member opening the route by deep link gets the
  not-found state.

### 3. Android share intent — "share a page from Chrome to OpenRecipe"

- **`app.json`:** add the plugin:

  ```json
  ["expo-share-intent", { "androidIntentFilters": ["text/*"] }]
  ```

  Text covers shared URLs. Keep the existing plugins and scheme.
- **Wiring:** follow the README's **Expo Router** section and its
  `example/expo-router` folder. `ShareIntentProvider` wraps the root, outermost
  provider first. Do whatever the example does about `+native-intent` or route
  redirection on a share cold start.
- **Flow:**
  - A share arrives with text.
  - `lib/share-intent.ts` `extractUrl(text)` finds the first http(s) URL.
    Chrome sends "Title\nhttps://…" or just the URL.
  - Signed-in admin: open the Drafts tab with the park form **prefilled** and
    MC Kiełbas announcing it. One tap on "Odłóż na później" parks it. The tap is
    deliberate, so an accidental share can't queue anything.
  - Then `resetShareIntent()`.
  - Not an admin or not signed in: a toast in existing copy terms, and
    nothing is parked. If no URL is found, a toast as well.
- **Expo Go:** pass `disabled` per the README when running in Expo Go
  (`Constants.executionEnvironment === "storeClient"`), so Expo Go keeps
  working for the rest of the app.

### 4. Draft-finished toasts — `lib/pulse.ts` plus root layout

Mirror `draft-toasts.tsx`:
- Admin only, foreground only (via `focusManager`).
- Poll `GET /api/v1/drafts/pulse` every 5 s.
- Compare consecutive pulses with core `finishedSince(before, after)`. The
  first poll is a baseline, not news.
- `ready` → `copy.imports.toastReady(title)`, action → `/drafts/[id]`.
- `failed` → `copy.imports.toastFailed`, action
  `copy.imports.toastOpenDrafts` → `/drafts`.
- Skip toasts for the Draft that is currently open in review.

Test the pure mapping in `lib/pulse.test.ts`.

### 5. Settings — `(tabs)/settings.tsx` (admin), mirroring the web settings page

- **Invites:**
  - Mint, with optional email.
  - List the last 20 with state chips (`copy.settings.inviteState`, plus
    "active").
  - Share the link with RN `Share.share({ message: \`${API_URL}/join/${token}\` })`.
    The web builds it from `location.origin`; on the phone `API_URL` is the
    web origin. The invite itself is redeemed on the web.
  - Revoke, with confirm.
- **Members:**
  - List name, email, role and joined date.
  - Change role between admin and member with `copy.settings.saveRole`. The
    Master is fixed and shows `copy.settings.master`.
  - Remove, with `copy.settings.removeMemberConfirm`.
  - Map `MemberResult` refusals to copy.
- **Tags per Facet** (`FACETS` order, Facet labels from copy):
  - Add (slug and label, with the slug hint).
  - Rename (label only, `tagSlugFixed`).
  - Delete. When the tag is in use, delete is disabled and shows
    `tagInUse` with its count.
  - Map every `TagResult.reason` (`slug`, `duplicate`, `in-use`, `missing`)
    to copy. Add the missing keys yourself; you own `copy.ts`.
  - Invalidate `["tags"]` after changes, since the editor's picker reads it.
- **Queue summary** (`copy.settings.queue*`).

### 6. Account — `app/account.tsx` (everyone)

- Name: `PATCH /api/v1/account/name`.
- Password: current and new, with min 8 checked on the client too. An empty
  current password means "set one" for Google-only accounts, as on the web.
- Show the returned `AccountResult.message` inline (already Polish).
- Sign out uses `signOut()` from `lib/sign-out.ts`.
- A password change revokes other sessions (server). This phone's session
  stays valid.

## API

Everything exists in `/api/v1`. There are no server changes for you. If
something is missing, report it; don't touch `apps/web`.

## Check

- `lib/share-intent.test.ts`:
  - URL alone;
  - "Title\nURL";
  - text with no URL → null;
  - a `javascript:` or `intent:` link → null;
  - trailing punctuation trimmed.
- `lib/pulse.test.ts`: baseline poll gives no toasts; ready and failed
  transitions give the right toasts; the currently open Draft is skipped.
- In your report:
  - the exact `app.json` diff;
  - that a rebuild is required;
  - any interface you changed;
  - copy keys you added.
- A Haiku review follows. Keep the diff free of drive-by refactors.
