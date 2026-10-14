import { PIXEL_SIZE, pixelPath } from "@openrecipe/core/pixel";

import { GRIDS, type IconName } from "@openrecipe/core/icons";

export { ICON_GRIDS, type IconName } from "@openrecipe/core/icons";

/** Grids live in core so the phone draws the same icons (currentColor here). */
export function Icon({ name, className = "size-5" }: { name: IconName; className?: string }) {
  return (
    <svg
      viewBox={`0 0 ${PIXEL_SIZE} ${PIXEL_SIZE}`}
      fill="currentColor"
      shapeRendering="crispEdges"
      aria-hidden
      className={className}
    >
      <path d={pixelPath(GRIDS[name], "#")} />
    </svg>
  );
}
