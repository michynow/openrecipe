import { Icon, type IconName } from "@/components/icons";
import type { ChipTag, Facet } from "@openrecipe/core/tags";
import { PIXEL_SIZE, spriteLayers } from "@openrecipe/core/pixel";
import { TAG_SPRITES } from "@openrecipe/core/tag-sprites";

/**
 * A Tag as a sticker: its own pixel sprite (a flag, a fried egg, a chili) on
 * its Facet's colour, then the label. The colour groups — all diets green, all
 * cuisines blue — and the label carries the meaning; the sprite is decoration.
 *
 * A Tag the Master added later has no sprite and shows its Facet's icon.
 */
const FACET_STYLE: Record<Facet, { icon: IconName; className: string }> = {
  meal_slot: { icon: "cutlery", className: "bg-facet-meal" },
  cuisine: { icon: "globe", className: "bg-facet-cuisine" },
  diet: { icon: "leaf", className: "bg-facet-diet" },
  effort: { icon: "bolt", className: "bg-facet-effort" },
  vibe: { icon: "heart", className: "bg-facet-vibe" },
};

const SIZE = {
  md: { chip: "gap-1.5 px-2 py-0.5 text-sm", art: "size-6" },
  /** For cards: two rows of these must fit a fixed height. */
  sm: { chip: "gap-1 px-1.5 text-xs leading-6", art: "size-4" },
};

export function TagChip({ tag, size = "md" }: { tag: ChipTag; size?: keyof typeof SIZE }) {
  // A Facet added later without a style still renders, just plain.
  const style = FACET_STYLE[tag.facet] ?? { icon: "tags" as const, className: "bg-fill" };
  const sprite = TAG_SPRITES[tag.slug];
  const { chip, art } = SIZE[size];

  return (
    <span
      className={`inline-flex max-w-full items-center whitespace-nowrap rounded-input border-2 border-line font-extrabold text-ink ${chip} ${style.className}`}
    >
      {sprite ? (
        <svg
          viewBox={`0 0 ${PIXEL_SIZE} ${PIXEL_SIZE}`}
          shapeRendering="crispEdges"
          aria-hidden
          className={`shrink-0 ${art}`}
        >
          {spriteLayers(sprite).map(({ char, d }) => (
            <path key={char} d={d} style={{ fill: `var(--px-${char})` }} />
          ))}
        </svg>
      ) : (
        <Icon name={style.icon} className={`shrink-0 ${art}`} />
      )}
      <span className="truncate">{tag.label}</span>
    </span>
  );
}
