/**
 * The seeded Tag taxonomy. PRD §6.
 *
 * `slug` is English and is what code, queries and the Worker's prompt reference.
 * `label` is Polish and is the only part ever rendered. Rewording a label must
 * never break a query — that is why there are two columns (ADR-0005).
 *
 * The Master can add Tags at runtime (OR-50), so this is the starting set, not a
 * closed universe. Nothing should import it to *validate* a Tag; read the table.
 */

export const FACETS = ["meal_slot", "cuisine", "diet", "effort", "vibe"] as const;

export type Facet = (typeof FACETS)[number];

export type SeedTag = { facet: Facet; slug: string; label: string };

/** A Tag as everything that renders one needs (components/tag-chip.tsx). */
export type ChipTag = { slug: string; label: string; facet: Facet };

/**
 * Tags in FACETS order — meal, cuisine, diet, effort, vibe — so like sits with
 * like on a card or a Recipe page. Stable, so the order within a Facet holds.
 */
export function byFacet<T extends { facet: string }>(tags: readonly T[]): T[] {
  const rank = (facet: string) => {
    const i = FACETS.indexOf(facet as Facet);
    return i === -1 ? FACETS.length : i;
  };
  return [...tags].sort((a, b) => rank(a.facet) - rank(b.facet));
}

export const SEED_TAGS: readonly SeedTag[] = [
  // Meal Slot — the only Facet with behaviour attached: it drives Proposals.
  // Polish meal structure puts the main meal at obiad, hence the dinner mapping.
  { facet: "meal_slot", slug: "breakfast", label: "Śniadanie" },
  { facet: "meal_slot", slug: "brunch", label: "Brunch" },
  { facet: "meal_slot", slug: "lunch", label: "Obiad" },
  { facet: "meal_slot", slug: "dinner", label: "Kolacja" },
  { facet: "meal_slot", slug: "snack", label: "Przekąska" },
  { facet: "meal_slot", slug: "dessert", label: "Deser" },
  { facet: "meal_slot", slug: "drink", label: "Napój" },
  { facet: "meal_slot", slug: "side", label: "Dodatek" },
  { facet: "meal_slot", slug: "sauce", label: "Sos" },

  { facet: "cuisine", slug: "polish", label: "Polska" },
  { facet: "cuisine", slug: "italian", label: "Włoska" },
  { facet: "cuisine", slug: "french", label: "Francuska" },
  { facet: "cuisine", slug: "greek", label: "Grecka" },
  { facet: "cuisine", slug: "mexican", label: "Meksykańska" },
  { facet: "cuisine", slug: "asian", label: "Azjatycka" },
  { facet: "cuisine", slug: "japanese", label: "Japońska" },
  { facet: "cuisine", slug: "thai", label: "Tajska" },
  { facet: "cuisine", slug: "indian", label: "Indyjska" },
  { facet: "cuisine", slug: "middle-eastern", label: "Bliskowschodnia" },
  { facet: "cuisine", slug: "american", label: "Amerykańska" },
  { facet: "cuisine", slug: "mediterranean", label: "Śródziemnomorska" },

  { facet: "diet", slug: "vegetarian", label: "Wegetariańskie" },
  { facet: "diet", slug: "vegan", label: "Wegańskie" },
  { facet: "diet", slug: "gluten-free", label: "Bezglutenowe" },
  { facet: "diet", slug: "dairy-free", label: "Bez laktozy" },
  { facet: "diet", slug: "high-protein", label: "Wysokobiałkowe" },
  { facet: "diet", slug: "low-carb", label: "Niskowęglowodanowe" },

  { facet: "effort", slug: "under-15", label: "Do 15 minut" },
  { facet: "effort", slug: "under-30", label: "Do 30 minut" },
  { facet: "effort", slug: "one-pan", label: "Jedna patelnia" },
  { facet: "effort", slug: "no-cook", label: "Bez gotowania" },
  { facet: "effort", slug: "slow-cooked", label: "Długo duszone" },
  { facet: "effort", slug: "meal-prep", label: "Na zapas" },
  { facet: "effort", slug: "batch-cook", label: "Duża porcja" },

  { facet: "vibe", slug: "spicy", label: "Ostre" },
  { facet: "vibe", slug: "sweet", label: "Słodkie" },
  { facet: "vibe", slug: "savoury", label: "Wytrawne" },
  { facet: "vibe", slug: "creamy", label: "Kremowe" },
  { facet: "vibe", slug: "fresh", label: "Świeże" },
  { facet: "vibe", slug: "comfort", label: "Comfort food" },
  { facet: "vibe", slug: "fast-food", label: "Fast food" },
  { facet: "vibe", slug: "healthy", label: "Zdrowe" },
  { facet: "vibe", slug: "fancy", label: "Na wypas" },
  { facet: "vibe", slug: "boozy", label: "Z alkoholem" },
  { facet: "vibe", slug: "hangover-cure", label: "Na kaca" },
];

/** Max Tags on one Recipe. Mirrored in Zod and by a database trigger. */
export const MAX_TAGS_PER_RECIPE = 5;
