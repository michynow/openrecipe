import { and, eq, sql } from "drizzle-orm";

import { db } from "./db/index.ts";
import { proposalReroll } from "./db/schema.ts";
import type { RecipeCardData } from "../components/recipe-card.tsx";

/**
 * Today's Proposals (OR-48).
 *
 * A Proposal is derived, never stored: a query result seeded by (day, slot,
 * reroll count), not a row. That is what makes it hold still all day for
 * everyone without a job to write it, and reset itself tomorrow without a job to
 * clear it.
 *
 * The seed is hashed against each Recipe's id — `order by md5(id || seed)` — so
 * the order is stable for a given seed and completely different for the next
 * one. Cheap, and no random() to make the same page disagree with itself between
 * two renders.
 */

/** The three slots the dashboard offers, by Tag slug. PRD §7.3. */
export const PROPOSAL_SLOTS = ["breakfast", "lunch", "dinner"] as const;

export type ProposalSlot = (typeof PROPOSAL_SLOTS)[number];

export type Proposal = {
  slot: ProposalSlot;
  recipe: RecipeCardData | null;
  /** True when nothing carried this slot's Tag and the pick came from the pool. */
  wildcard: boolean;
};

/** The day, in the household's terms rather than UTC's. */
export function today(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Warsaw",
  }).format(now);
}

/**
 * How many times this person has rerolled today. No row means none — the common
 * case writes nothing.
 */
export async function getRerollCount(userId: string): Promise<number> {
  const [row] = await db
    .select({ n: proposalReroll.n })
    .from(proposalReroll)
    .where(
      and(
        eq(proposalReroll.userId, userId),
        eq(proposalReroll.day, today()),
      ),
    )
    .limit(1);

  return row?.n ?? 0;
}

/**
 * Bump this person's counter for today and return the new value.
 *
 * One statement: the insert creates the row on the first reroll of the day, and
 * the conflict clause increments it on every one after. Two taps in the same
 * moment cannot lose each other the way a read-then-write would.
 */
export async function bumpReroll(userId: string): Promise<number> {
  const [row] = await db
    .insert(proposalReroll)
    .values({ userId, day: today(), n: 1 })
    .onConflictDoUpdate({
      target: [proposalReroll.userId, proposalReroll.day],
      set: { n: sql`${proposalReroll.n} + 1` },
    })
    .returning({ n: proposalReroll.n });

  return row?.n ?? 0;
}

type Row = {
  slug: string;
  title: string;
  image_url: string | null;
  total_minutes: number | null;
  /** Polish labels, already resolved — a card renders labels, never slugs. */
  tag_labels: string[] | null;
};

const toCard = (row: Row): RecipeCardData => ({
  slug: row.slug,
  title: row.title,
  imageUrl: row.image_url,
  totalMinutes: row.total_minutes,
  tagLabels: row.tag_labels ?? [],
});

/**
 * One slot's pick.
 *
 * Excludes anything in the Cook Log from the last seven days — a suggestion you
 * cooked on Tuesday is not a suggestion. Recipes carrying no Meal Slot Tag at
 * all form the fallback pool, so a library that nobody has tagged still gets
 * Proposals rather than three empty cards.
 */
async function pickFor(slot: ProposalSlot, seed: string): Promise<Proposal> {
  const tagged = await db.execute(sql`
    select r.slug, r.title, r.image_url, r.total_minutes,
           coalesce(json_agg(t2.label) filter (where t2.id is not null), '[]') as tag_labels
      from recipe r
      join recipe_tag rt on rt.recipe_id = r.id
      join tag t on t.id = rt.tag_id and t.slug = ${slot}
      left join recipe_tag rt2 on rt2.recipe_id = r.id
      left join tag t2 on t2.id = rt2.tag_id
     where r.deleted_at is null
       and not exists (select 1 from cook_log cl
                        where cl.recipe_id = r.id
                          and cl.cooked_at > now() - interval '7 days')
     group by r.id
     order by md5(r.id::text || ${seed})
     limit 1`);

  const row = (tagged.rows ?? [])[0] as Row | undefined;
  if (row) return { slot, recipe: toCard(row), wildcard: false };

  const wildcard = await db.execute(sql`
    select r.slug, r.title, r.image_url, r.total_minutes, '[]'::json as tag_labels
      from recipe r
     where r.deleted_at is null
       and not exists (select 1 from cook_log cl
                        where cl.recipe_id = r.id
                          and cl.cooked_at > now() - interval '7 days')
       and not exists (select 1 from recipe_tag rt
                        join tag t on t.id = rt.tag_id
                       where rt.recipe_id = r.id and t.facet = 'meal_slot')
     order by md5(r.id::text || ${seed})
     limit 1`);

  const fallback = (wildcard.rows ?? [])[0] as Row | undefined;

  return {
    slot,
    recipe: fallback ? toCard(fallback) : null,
    wildcard: Boolean(fallback),
  };
}

/**
 * All three slots for one person.
 *
 * The reroll count joins the seed, so rerolling changes what *you* see and
 * nothing about what anyone else does.
 */
export async function getProposals(userId: string): Promise<Proposal[]> {
  const rerolls = await getRerollCount(userId);
  const day = today();

  return Promise.all(
    PROPOSAL_SLOTS.map((slot) => pickFor(slot, `${day}:${slot}:${rerolls}`)),
  );
}
