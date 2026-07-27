import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import * as schema from "./schema.ts";

/**
 * The one database client. Used from Server Components, Server Actions, and the
 * laptop-side Worker — the neon-http driver is stateless, so there is no pool to
 * manage and nothing to tear down between serverless invocations.
 *
 * Fails loudly at import time rather than producing a client that throws on first
 * query, so a missing environment variable surfaces at boot, not mid-request.
 */
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.",
  );
}

export const db = drizzle(neon(connectionString), { schema });

export { schema };
