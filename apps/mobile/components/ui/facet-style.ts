import type { IconName } from "@openrecipe/core/icons";
import type { Facet } from "@openrecipe/core/tags";

/** Mirrors FACET_STYLE in apps/web/components/tag-chip.tsx. Classes are literal so Tailwind sees them. */
export const FACET_STYLE: Record<Facet, { icon: IconName; className: string }> = {
  meal_slot: { icon: "cutlery", className: "bg-facet-meal" },
  cuisine: { icon: "globe", className: "bg-facet-cuisine" },
  diet: { icon: "leaf", className: "bg-facet-diet" },
  effort: { icon: "bolt", className: "bg-facet-effort" },
  vibe: { icon: "heart", className: "bg-facet-vibe" },
};

/** A Facet added later without a style still renders, just plain. */
export const facetStyle = (facet: string) =>
  FACET_STYLE[facet as Facet] ?? { icon: "tags" as IconName, className: "bg-fill" };
