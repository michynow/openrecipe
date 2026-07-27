import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
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

/* ─────────────────────────── Recipes (OR-17) ─────────────────────────── */

/**
 * A Recipe.
 *
 * Steps and Tips are jsonb string arrays rather than tables: they have no
 * identity, no attributes of their own, and are always edited as a whole block.
 * Ingredient Lines are rows, because they get ticked, reordered, and carry
 * Substitutes — identity where it is needed, JSON where it is not.
 *
 * Note `authorId` is `text`, not `uuid`: Better Auth issues text ids, so the
 * foreign key has to match. PRD §6 says uuid, written before that was known.
 */
export const recipe = pgTable(
  "recipe",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Generated from the title, collision-suffixed. Never changes on rename. */
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),

    /** Blob URL, or null. Null is a first-class state — plenty of Recipes have no photo. */
    imageUrl: text("image_url"),

    /** What the stored quantities produce. Required. */
    servings: integer("servings").notNull(),
    totalMinutes: integer("total_minutes"),
    kcalPerServing: integer("kcal_per_serving"),

    /** Provenance for imported Recipes, and what re-import diffs against. */
    sourceUrl: text("source_url"),

    /** Immutable once set. Attribution, not permission — anyone may edit anything. */
    authorId: text("author_id")
      .notNull()
      .references(() => user.id),
    /** Set on edit when the editor differs from the author. */
    updatedById: text("updated_by_id").references(() => user.id),

    /** string[] — ordered, one short line each. */
    steps: jsonb("steps").$type<string[]>().notNull().default([]),
    tips: jsonb("tips").$type<string[]>().notNull().default([]),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    /** Soft delete. Every read path must filter this out. */
    deletedAt: timestamp("deleted_at"),
  },
  (table) => [
    // Keyset pagination order (OR-35). Partial, because deleted rows are never listed.
    index("recipe_created_at_id_idx").on(table.createdAt, table.id),
  ],
);

/** One row of the ingredients list. */
export const ingredientLine = pgTable(
  "ingredient_line",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    recipeId: uuid("recipe_id")
      .notNull()
      .references(() => recipe.id, { onDelete: "cascade" }),

    /** Display order. Reordering rewrites this, which is why ticks key on id. */
    position: integer("position").notNull(),

    /**
     * numeric, not a float: 0.1 + 0.2 must not drift in a measurement. Null means
     * "do smaku" — a real state, not missing data, and it never gets scaled.
     */
    quantity: numeric("quantity"),
    unit: text("unit"),
    item: text("item").notNull(),
    note: text("note"),

    /** [{ item, note }] — Worker-generated and stored, never fetched live (ADR-0002). */
    substitutes: jsonb("substitutes")
      .$type<{ item: string; note: string | null }[]>()
      .notNull()
      .default([]),
  },
  (table) => [index("ingredient_line_recipe_idx").on(table.recipeId)],
);

/**
 * A curated Tag. `slug` is English and is what code, queries and the Worker's
 * prompt reference; `label` is Polish and is the only part ever rendered. That
 * split is why there are two text columns — a reworded label breaks nothing.
 */
export const tag = pgTable(
  "tag",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** meal_slot | cuisine | diet | effort | vibe */
    facet: text("facet").notNull(),
    slug: text("slug").notNull().unique(),
    label: text("label").notNull(),
  },
  (table) => [index("tag_facet_idx").on(table.facet)],
);

/**
 * At most 5 per Recipe. Enforced in Zod, in the picker, and by a database trigger
 * added in the same migration — the trigger is the one that cannot be bypassed.
 */
export const recipeTag = pgTable(
  "recipe_tag",
  {
    recipeId: uuid("recipe_id")
      .notNull()
      .references(() => recipe.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tag.id, { onDelete: "restrict" }),
  },
  (table) => [
    primaryKey({ columns: [table.recipeId, table.tagId] }),
    index("recipe_tag_tag_idx").on(table.tagId),
  ],
);
