import { Icon, type IconName } from "@/components/icons";
import type { Facet } from "@/lib/db/tags";

/**
 * A Tag as a sticker: its Facet's colour and icon, then the label. The colour
 * groups (all diets green, all cuisines blue) and the icon says the same for
 * anyone who cannot tell the colours apart — the label carries the meaning.
 */
const FACET_STYLE: Record<Facet, { icon: IconName; className: string }> = {
  meal_slot: { icon: "cutlery", className: "bg-facet-meal" },
  cuisine: { icon: "globe", className: "bg-facet-cuisine" },
  diet: { icon: "leaf", className: "bg-facet-diet" },
  effort: { icon: "bolt", className: "bg-facet-effort" },
  vibe: { icon: "heart", className: "bg-facet-vibe" },
};

export function TagChip({ label, facet }: { label: string; facet: Facet }) {
  // A Facet added later without a style still renders, just plain.
  const style = FACET_STYLE[facet] ?? { icon: "tags" as const, className: "bg-fill" };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-input border-2 border-line px-2.5 py-1 text-sm font-extrabold text-ink ${style.className}`}
    >
      <Icon name={style.icon} className="size-4 shrink-0" />
      {label}
    </span>
  );
}
