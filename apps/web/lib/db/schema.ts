import {
  boolean,
  date,
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

import type { DraftLogEntry } from "@openrecipe/core/drafts";

/**
 * The database schema, in TypeScript. Source of truth for `drizzle-kit generate`.
 *
 * Deliberately free of anything Next-only — no `next/headers`, no `server-only`.
 * The Worker is a plain Node script on a laptop and imports this file directly;
 * the database is the interface between the two. See ADR-0002.
 *
 * Every table in PRD §6 now exists.
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

  /**
   * 'master' | 'admin' | 'member'. Admins grant 'admin' from Settings; 'master'
   * is stamped at sign-up and only ever honoured for MASTER_EMAIL (lib/roles.ts).
   */
  role: text("role").notNull().default("member"),

  /**
   * Set when the Master removes a Member (OR-50). The row stays: recipe.author_id
   * points at it, and attribution outlives membership. Sessions and credentials
   * are deleted alongside, and getCurrentUser refuses a stamped row — which also
   * closes the Google path, where signing in again would otherwise relink to the
   * same account by email.
   */
  removedAt: timestamp("removed_at"),

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

/* ─────────────────────────── Invites (OR-14) ─────────────────────────── */

/**
 * The only way an account comes into existence. Single-use, expiring, minted by
 * the Master and delivered by hand — there is no email provider by design.
 *
 * `usedAt` is the mutex. Claiming is a conditional UPDATE that only succeeds while
 * it is still null, so two parallel requests cannot both win.
 */
export const invite = pgTable(
  "invite",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    token: text("token").notNull().unique(),

    /** Optional pre-binding: when set, only this address may use the link. */
    email: text("email"),

    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),

    /** Non-null means consumed. Also the claim lock. */
    usedAt: timestamp("used_at", { withTimezone: true }),
    usedById: text("used_by_id").references(() => user.id, {
      onDelete: "set null",
    }),

    /** Master-only in practice; the column records who, not who may. */
    createdById: text("created_by_id")
      .notNull()
      .references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    /** Set when the Master revokes an unused Invite. */
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => [index("invite_created_at_idx").on(table.createdAt)],
);

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
    // `recipe_title_trgm_idx` also exists, over immutable_unaccent(lower(title)).
    // It is not declared here on purpose: drizzle-kit cannot express an index over
    // a function call, so it lives in drizzle/0004_search_trigram_indexes.sql. Do
    // not add it here — the snapshot has never seen it, and generate would emit a
    // second CREATE INDEX for an index that is already there.
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
  // `ingredient_line_item_trgm_idx` is the other half of the search foundation and
  // is likewise hand-written — see the note on `recipe` above.
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

/* ─────────────────────────── Cook Log (OR-32) ─────────────────────────── */

/**
 * "I made this." The only behavioural data in the system — it feeds the
 * dashboard's counts and keeps Proposals off anything cooked in the last week.
 *
 * There is deliberately no unique constraint on (recipe, user, day). Cooking the
 * same thing for lunch and again for dinner is a real event, and a constraint
 * would turn it into an error the user cannot explain. The button is what
 * discourages the accidental double-tap, not the database.
 *
 * `userId` is `text` for the same reason as `recipe.authorId`: Better Auth issues
 * text ids. PRD §6 says uuid, written before that was known.
 */
export const cookLog = pgTable(
  "cook_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    recipeId: uuid("recipe_id")
      .notNull()
      .references(() => recipe.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    cookedAt: timestamp("cooked_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // "How often was this cooked" — one Recipe, every entry.
    index("cook_log_recipe_idx").on(table.recipeId),
    // "What was cooked this week" and "keep Proposals off the last 7 days" scan by
    // date across every Recipe, so the recipe index is no help to them (Phase 5).
    index("cook_log_cooked_at_idx").on(table.cookedAt),
  ],
);

/* ───────────────────────────── Draft (OR-38) ──────────────────────────── */

/**
 * The import queue and the draft store, in one table. Status is the only
 * difference between "a URL somebody parked" and "a Recipe waiting for review",
 * so parking a link costs no second table and the review screen has one place to
 * read from.
 *
 * This table is the interface between the app and the Worker (ADR-0002): the app
 * only ever writes `queued`, the Worker only ever moves rows out of it. Neither
 * calls the other. The legal moves live in lib/drafts.ts, next to the code that
 * enforces them.
 *
 * `createdBy` is `text` for the same reason as `recipe.authorId`: Better Auth
 * issues text ids. PRD §6 says uuid, written before that was known.
 */
export const draft = pgTable(
  "draft",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceUrl: text("source_url").notNull(),

    /** One of DRAFT_STATUSES. See lib/drafts.ts for what may follow what. */
    status: text("status").notNull().default("queued"),

    /**
     * The full Recipe shape the Worker produced, editable before approval.
     * Null until then. Validated against the shared Zod schema on the way in and
     * on the way out — jsonb keeps its shape honest about as well as a text
     * column does.
     */
    payload: jsonb("payload"),

    /**
     * Field names the model worked out rather than read off the page (OR-42),
     * e.g. ["servings", "totalMinutes"]. Review highlights them, because a
     * guessed serving count is exactly the kind of thing that looks right and
     * is not. Empty when everything came from structured data.
     */
    inferred: jsonb("inferred").$type<string[]>(),

    /**
     * Where the Worker is inside `processing` — one of DRAFT_STAGES. The Drafts
     * screen draws its progress bar from this, so a parked link is not a black
     * box between "queued" and "ready". Null outside `processing`.
     */
    stage: text("stage"),

    /**
     * What happened to this Draft, oldest first: parked, woken, fetched, what
     * the model did, why it failed. Written by the app and the Worker alike and
     * shown expandable on the Drafts screen, so "Nie wyszło" always comes with
     * the story. Entries are DraftLogEntry (lib/drafts.ts).
     */
    log: jsonb("log").$type<DraftLogEntry[]>().notNull().default([]),

    /** Why it failed, in Polish, for the Drafts screen. Null unless failed. */
    error: text("error"),

    /**
     * Set on approve, and set upfront when re-importing over an existing Recipe
     * so the review screen can diff against it (OR-46).
     *
     * `set null` rather than cascade: deleting a Recipe should not silently erase
     * the record that it was once imported from somewhere.
     */
    recipeId: uuid("recipe_id").references(() => recipe.id, {
      onDelete: "set null",
    }),

    createdBy: text("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),

    /**
     * When it last entered `queued` — on park, and again on retry or reclaim.
     * The queue timeout counts from here, not from createdAt, or a retried
     * month-old link would expire the moment it was requeued.
     *
     * While `limited`, it is the retry time instead — when the model limit
     * resets — and the Worker's claim treats it the same way: not before this.
     */
    queuedAt: timestamp("queued_at", { withTimezone: true })
      .notNull()
      .defaultNow(),

    /**
     * When the Worker picked this row up. Not in PRD §6, and needed: the Worker
     * runs on a laptop that gets closed mid-run, and without a claim time a row
     * left in `processing` is indistinguishable from one being worked on right
     * now. This is what makes the reclaim in lib/drafts.ts possible.
     */
    claimedAt: timestamp("claimed_at", { withTimezone: true }),

    /** When it reached a terminal status. Null while it is still moving. */
    processedAt: timestamp("processed_at", { withTimezone: true }),
  },
  (table) => [
    /**
     * The Worker's claim query is `where status = 'queued' order by created_at`,
     * and the Drafts screen groups by status. Both are served by this.
     */
    index("draft_status_idx").on(table.status, table.createdAt),
  ],
);

/* ─────────────────────── Proposal reroll (OR-48) ──────────────────────── */

/**
 * How many times one person has rerolled today's Proposals.
 *
 * A row exists only while somebody is rerolling: no row means zero, so the
 * common case — everyone taking the day's first suggestion — writes nothing at
 * all. Yesterday's rows are harmless and need no cleanup job; the day is part of
 * the key, so they simply stop being read.
 *
 * In the database rather than in a URL parameter so a reroll survives a refresh
 * and follows you from laptop to phone (PRD §7.3, resolved 2026-07-27).
 */
export const proposalReroll = pgTable(
  "proposal_reroll",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** The local day the count belongs to, as a date rather than a timestamp. */
    day: date("day").notNull(),
    n: integer("n").notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.userId, table.day] })],
);

/**
 * FCM registration tokens for the Android app, one row per device. Only Admins
 * register (Drafts are Admin-only). Unique on the token: a phone that signs in
 * as someone else is reassigned, not duplicated.
 */
export const pushToken = pgTable("push_token", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
