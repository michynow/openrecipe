# Single Next.js app, no NestJS

The brief asked for NestJS on the back end, and we rejected it. On Vercel Hobby, Nest
means booting a full HTTP application per cold start, behind either a second deployment
or a catch-all rewrite, just to reach the same Neon database the Next.js app already
holds a connection to. For a one-household app with a handful of endpoints, its module
and DI structure buys organisation we don't need at a cost we'd pay on every request.

So: one Next.js App Router project. Server Actions for mutations, Route Handlers for the
import and settings endpoints, Drizzle ORM against Neon. One repo, one deploy, one auth
session, one type system end to end.

## Consequences

- No DI container. Shared logic lives in plain modules under `lib/`, imported directly.
- If this app ever grows a second consumer (a real mobile client), the Route Handlers are
  already HTTP endpoints — the migration path is additive, not a rewrite.
