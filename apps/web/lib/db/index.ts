import { neon } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";

import * as schema from "./schema.ts";

/**
 * The one database client. Used from Server Components, Server Actions, and the
 * laptop-side Worker — the neon-http driver is stateless, so there is no pool to
 * manage and nothing to tear down between serverless invocations.
 *
 * Initialised lazily on first use, NOT at import time.
 *
 * The first version of this threw during module evaluation when DATABASE_URL was
 * missing, on the reasoning that a config error should surface at boot. That was
 * wrong: `next build` collects page data for every route, which evaluates this
 * module without ever running a query, so a build with no secrets configured
 * failed outright. CI has no database and should not need one to typecheck and
 * compile.
 *
 * The failure is still loud and still names the fix — it just waits until someone
 * actually tries to query.
 */

let client: NeonHttpDatabase<typeof schema> | null = null;

function connect(): NeonHttpDatabase<typeof schema> {
  if (client) return client;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.",
    );
  }

  client = drizzle(neon(connectionString), { schema });
  return client;
}

export const db = new Proxy({} as NeonHttpDatabase<typeof schema>, {
  get(_target, property) {
    const instance = connect();
    const value = instance[property as keyof typeof instance];
    // Methods need their receiver bound, or `this` is the proxy target.
    return typeof value === "function" ? value.bind(instance) : value;
  },
});

export { schema };
