import {
  boolean,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * The database schema, in TypeScript. Source of truth for `drizzle-kit generate`.
 *
 * Deliberately free of anything Next-only — no `next/headers`, no `server-only`.
 * The Worker is a plain Node script on a laptop and imports this file directly;
 * the database is the interface between the two. See ADR-0002.
 *
 * Tables still to come:
 *   OR-14  invite
 *   OR-17  recipe, ingredient_line, tag, recipe_tag
 *   OR-32  cook_log
 *   OR-38  draft
 *   OR-48  proposal_reroll
 */

/**
 * Better Auth owns the shape of these four tables. Column names and types match
 * what its Drizzle adapter expects — do not rename them to taste, or auth breaks
 * in ways that only surface at sign-in.
 *
 * The one addition is `role`. It is derived from MASTER_EMAIL at sign-in and is
 * never accepted as input from a request (OR-12).
 */
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),

  /** 'master' | 'member'. Never grantable through the UI. */
  role: text("role").notNull().default("member"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  token: text("token").notNull().unique(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/**
 * One row per sign-in method. A password account and a Google account for the same
 * person both point at one `user` row — that is account linking, and it is the
 * entire reason for choosing Better Auth (ADR-0003).
 */
export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),

    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    idToken: text("id_token"),

    /** Hashed by Better Auth. Only ever populated for the credential provider. */
    password: text("password"),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    // One account per provider per external id — stops a double callback creating two.
    uniqueIndex("account_provider_account_idx").on(
      table.providerId,
      table.accountId,
    ),
  ],
);

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
