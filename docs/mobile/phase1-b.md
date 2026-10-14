# Phase 1 · Spec B — Expo app scaffold + Better Auth Expo plugin

Branch `feat/mobile`. Read first: `AGENTS.md` (this Next.js is newer than your
training data — check `node_modules/next/dist/docs/` before touching Next
code), `docs/adr/0007-native-android-app.md`, `packages/core/src/api.ts` (the
API contract — read-only for you), `apps/web/lib/auth.ts`.

Another implementer (Spec A) works in the same checkout at the same time,
writing `apps/web/app/api/v1/**`.

## Rules of the shared checkout

- **You are the only one who runs `pnpm install` / `pnpm add`.** Use pnpm
  **10.33.2** (root `packageManager`). The global `pnpm` on this machine is 9.x
  and rewrites the lockfile wrongly — use `npx -y pnpm@10.33.2 …` or corepack.
- **Touch only the files listed under "You own".** Read-only for you:
  `apps/web/app/**`, `apps/web/lib/**` except `auth.ts`, `apps/web/proxy.ts`,
  `packages/core/**` (if `api.ts` needs a change, write it in your report;
  A owns it).
- Commit only your own files (`git add <paths>`, never `git add -A`). Every
  commit message ends with
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Do not push.

## You own

| Path | What |
|---|---|
| `apps/web/lib/auth.ts` | add `expo()` plugin + trusted origins |
| `apps/web/package.json` | only via `pnpm --filter web add @better-auth/expo@<same as better-auth>` |
| `apps/mobile/**` | the whole Expo app (new) |
| `pnpm-workspace.yaml`, `pnpm-lock.yaml`, root `package.json` | workspace settings, `mobile` script |
| `.gitignore` | Expo/Android ignores |
| `.github/workflows/ci.yml` | only if mobile typecheck should run in CI (keep CI green) |

## 1. Server: Better Auth Expo plugin (`apps/web/lib/auth.ts`)

Check the current docs (https://www.better-auth.com/docs/integrations/expo)
against the installed `better-auth` version (1.6.25 at time of writing — pin
`@better-auth/expo` to the same version, in both web and mobile).

- `import { expo } from "@better-auth/expo";` and `plugins: [expo()]`.
- `trustedOrigins`: keep the existing Vercel hosts, add `"openrecipe://"`.
  In development only (`process.env.NODE_ENV === "development"`), also the
  `exp://` patterns the docs suggest. Never in production.
- Keep everything else (comments included). The Worker imports `lib/auth.ts`'s
  siblings under plain Node — `@better-auth/expo` must not pull React Native
  into the server bundle (it shouldn't; the server entry is separate — verify
  `pnpm --filter web build` and `pnpm --filter web test`).

## 2. Workspace + Expo requirements

Verify against current Expo docs (https://docs.expo.dev/guides/monorepos/) at
the time you start; what was true when this was written:

- Expo detects the monorepo from `pnpm-workspace.yaml` (already lists
  `apps/*`, `packages/*`).
- SDK 54+ supports pnpm's isolated linker; if a native build or Metro resolve
  fails, set `nodeLinker: hoisted` in `pnpm-workspace.yaml`. Try isolated first;
  if you switch to hoisted, re-verify the web build and the Worker
  (`node apps/web/scripts/worker.ts` must still type-strip — packages resolved
  through `node_modules` are NOT type-stripped by Node, but `@openrecipe/core`
  is a workspace symlink and Node resolves it to its real path, so it is fine
  either way; just check).
- SDK 52+: no manual `metro.config.js` monorepo settings
  (`watchFolders`, `nodeModulesPaths`…) — use `expo/metro-config` defaults.
  Package `exports` are on by default (SDK 53+); `@openrecipe/core` relies on
  them (`"./*": "./src/*.ts"`) and on `.ts`-suffixed relative imports inside
  core — confirm Metro resolves `import { copy } from "@openrecipe/core/copy"`
  in a real bundle (`npx expo export --platform android` is a good offline check).
- One React per app. The web pins `react@19.2.4`; the Expo SDK pins its own.
  Different versions in different apps are fine under the isolated linker; a
  duplicate *inside* mobile is not — check `pnpm why --depth=10 react-native`
  and `react`.
- SDK 55+ requires the New Architecture (default). Fine.

## 3. Scaffold `apps/mobile`

- Latest **stable** Expo SDK (check https://expo.dev/changelog, not a beta),
  TypeScript, **Expo Router**. Generate with `create-expo-app` into
  `apps/mobile`, then strip the template's demo screens. Package name in
  `package.json`: `mobile`.
- `app.json`/`app.config.ts`: `name: "OpenRecipe"`, `slug: "openrecipe"`,
  `scheme: "openrecipe"`, `android.package: "app.openrecipe.android"`,
  no iOS config beyond what the template forces (iOS is a non-goal).
- **NativeWind** (Tailwind for RN) per its current Expo guide; a
  `tailwind.config` with the palette tokens copied from
  `apps/web/app/globals.css` as a starting point (names only need to match
  roughly — Phase 2 does the look; see the snack-arcade direction in PRD.md).
- **TanStack Query** (`QueryClientProvider` in the root layout).
- `expo-secure-store`, `expo-network`, `better-auth` + `@better-auth/expo`
  (same version as web), and what the expo client docs list.
- Depend on `@openrecipe/core: "workspace:*"`; use its `copy` for every string
  (Polish UI, ADR-0005 — no hard-coded user-facing text).
- Scripts: `start`, `android`, `typecheck` (`tsc --noEmit`), `lint` if the
  template has one. Root `package.json`: add `"mobile": "pnpm --filter mobile start"`.
- `.gitignore`: `.expo/`, `apps/mobile/android/`, `apps/mobile/ios/`,
  `*.apk`, `*.aab` (prebuild output is generated, not committed).
- Worker CI installs `--filter web...` already, so mobile deps don't slow it.

## 4. Auth client + login

- `apps/mobile/lib/auth.ts`: `createAuthClient` from `better-auth/react` with
  `baseURL` = `process.env.EXPO_PUBLIC_API_URL` (document in
  `apps/mobile/.env.example`: production
  `https://openrecipe-red.vercel.app`, or a LAN IP for a dev server), plugin
  `expoClient({ scheme: "openrecipe", storagePrefix: "openrecipe", storage: SecureStore })`.
- `app/login.tsx`: email + password → `authClient.signIn.email`. Errors shown
  with `copy` strings (reuse the web login's: see
  `apps/web/components/login-form.tsx`). Google: a disabled button with
  `// TODO(phase2): Google via authClient.signIn.social({ provider: "google", callbackURL: "/" })`.
- Root layout gate: `authClient.useSession()`; no session → `<Redirect href="/login" />`;
  signed in → a placeholder home that calls `GET /api/v1/me` through the API
  client and shows the name and role (proves cookie → Route Handler works end
  to end once A lands). Sign-out button.

## 5. Typed API client — `apps/mobile/lib/api.ts`

```ts
import type { Api, Endpoint } from "@openrecipe/core/api";
export async function api<E extends Endpoint>(
  endpoint: E,
  opts?: { params?: Record<string, string>; query?: Record<string, string | string[]>; body?: Api[E]["body"] },
): Promise<Api[E]["res"]>
```

- Split `"METHOD /path"`, substitute `:param`s (encodeURIComponent), append
  `query` (repeat keys for arrays — matches the `/search` URL contract).
- Headers: `Cookie: authClient.getCookie()`, `Content-Type: application/json`
  **always** (A's handlers reject mutations without it — CSRF guard),
  `credentials: "omit"`.
- Non-2xx → throw `ApiError` carrying status and the `{error}` code; on 401,
  also clear the session so the layout gate sends the user to login.
- Export thin TanStack hooks only for what the placeholder home uses (`useMe`).
  The rest come in Phase 2 with the screens — don't pre-build them.
- Test: `apps/mobile/lib/api.test.ts` under `node --test` for the pure URL
  builder (split method/path, params, repeated query keys) — put that pure
  function in its own file with no RN imports so plain Node can load it.

## Done when

- `npx -y pnpm@10.33.2 install` clean; lockfile committed.
- `pnpm -r typecheck`, `pnpm -r test`, `pnpm lint`, `pnpm --filter web build`
  pass (if A's in-progress files break web, report it rather than editing them).
- `cd apps/mobile && npx expo export --platform android` succeeds (proves Metro
  resolves the workspace and `@openrecipe/core`). Building an APK
  (`npx expo prebuild` + `./gradlew assembleRelease`, or `eas build --local`) is
  a stretch goal — report whether the Android SDK/JDK exist on this machine
  rather than installing system toolchains.
- Do not start long-running dev servers (`expo start`) and leave them running.
- Report: Expo SDK version chosen, linker mode, any Metro/pnpm workarounds, and
  anything `api.ts` should change.
- Commits: (1) server expo plugin, (2) scaffold, (3) auth + login, (4) API client.
