# A native Android app, sideloaded from GitHub Releases

Amends ADR-0001 and PRD §2, which ruled out native apps. The household cooks
from phones, and a phone browser keeps losing the session, dims the screen
mid-recipe and buries the app behind a tab. We are adding an Android app built
with Expo (React Native), with full parity: cooking view, editor, Draft review
and the Master's settings. iOS stays out — Apple's £79/year developer fee
breaks the £0 constraint and nobody in the household needs it.

The APK is built and attached to a GitHub Release; installing it is a sideload
("install unknown apps"). No Play Store: its one-off fee is small but it adds
review, a listing and a privacy policy for an app with five users.

The repo becomes a pnpm workspace:

- `apps/web` — the Next.js app, unchanged in role. Vercel's Root Directory is
  `apps/web`.
- `apps/mobile` — the Expo app.
- `packages/core` — `@openrecipe/core`: pure TypeScript both apps share (the
  recipe schema, quantities, formatting, the Draft status model, `copy`).
  No database, no Node built-ins, no Next. Exported as source, no build step.

## What changes in ADR-0001

ADR-0001 said mutations are Server Actions and that we write no hand-rolled
endpoints for CRUD. A React Native client cannot call a Server Action, so the
mobile app talks to JSON Route Handlers under `/api/v1/*`. They are thin by
rule: check the session, parse with the same Zod schema, call the same `lib/`
function the Server Action calls, revalidate the same paths, return JSON. Logic
that lives in a handler and not in `lib/` is a bug — two front doors, one house.

Auth is the same Better Auth instance with the `@better-auth/expo` plugin; the
app keeps its session in `expo-secure-store` and sends it on every request.

## Consequences

- **Still £0.** Expo's local `gradle` build or a GitHub Actions runner produces
  the APK; GitHub Releases hosts it.
- **Two clients, one API surface to keep in step.** A new Server Action now
  usually wants a `/api/v1` twin. The web keeps Server Actions — they are not
  migrated to fetch.
- **Updates are manual.** A new APK means a new Release and a tap to install;
  the app should tell the user when its version is behind.
- **Pantry Check stays per-device** (ADR-0004): the app keeps its own ticks on
  the phone, as the browser does.
- **No LLM calls from either client** (ADR-0002/0006) — importing still parks a
  link and lets the Worker do the rest.
