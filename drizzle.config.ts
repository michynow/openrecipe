import { defineConfig } from "drizzle-kit";

/**
 * Migrations are generated as SQL files and committed. Nothing is ever pushed
 * straight at the database — `drizzle-kit push` is deliberately not wired up,
 * because a schema drift you cannot read in a diff is a schema drift you cannot
 * reason about later.
 */
export default defineConfig({
  dialect: "postgresql",
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    // Only db:migrate needs this. db:generate works offline, from the schema alone.
    url: process.env.DATABASE_URL!,
  },
  strict: true,
  verbose: true,
});
