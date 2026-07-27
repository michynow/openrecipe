/**
 * The database schema, in TypeScript. Source of truth for `drizzle-kit generate`.
 *
 * Deliberately free of anything Next-only — no `next/headers`, no `server-only`.
 * The Worker is a plain Node script on a laptop and imports this file directly;
 * the database is the interface between the two. See ADR-0002.
 *
 * Tables arrive with the tickets that need them:
 *   OR-11  user, session, account, verification (Better Auth) + role
 *   OR-14  invite
 *   OR-17  recipe, ingredient_line, tag, recipe_tag
 *   OR-32  cook_log
 *   OR-38  draft
 *   OR-48  proposal_reroll
 */

export {};
