import { SPRITES, spriteFor } from "@/lib/ingredient-sprites";
import { PIXEL_SIZE, spriteLayers } from "@/lib/pixel";

/**
 * An Ingredient Line's pixel-art sprite, picked from its item name. Decorative:
 * the item's name is always next to it, so it is aria-hidden.
 */
export function IngredientSprite({ item, className = "size-9" }: { item: string; className?: string }) {
  const layers = spriteLayers(SPRITES[spriteFor(item)]);
  return (
    <svg
      viewBox={`0 0 ${PIXEL_SIZE} ${PIXEL_SIZE}`}
      shapeRendering="crispEdges"
      aria-hidden
      className={`shrink-0 ${className}`}
    >
      {layers.map(({ char, d }) => (
        <path key={char} d={d} style={{ fill: `var(--px-${char})` }} />
      ))}
    </svg>
  );
}
