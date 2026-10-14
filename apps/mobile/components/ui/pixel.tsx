import { ICON_GRIDS, type IconName } from "@openrecipe/core/icons";
import { SPRITES, spriteFor } from "@openrecipe/core/ingredient-sprites";
import { PIXEL_SIZE, pixelPath, spriteLayers } from "@openrecipe/core/pixel";
import Svg, { Path } from "react-native-svg";

import { useTokens, type Tone } from "../../lib/theme";

/** A multi-colour sprite: core's `spriteLayers`, one Path per palette letter. */
export function PixelArt({ rows, size = 40 }: { rows: readonly string[]; size?: number }) {
  const { px } = useTokens();
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${PIXEL_SIZE} ${PIXEL_SIZE}`}>
      {spriteLayers(rows).map(({ char, d }) => (
        <Path key={char} d={d} fill={px[char]} />
      ))}
    </Svg>
  );
}

export function IngredientSprite({ item, size = 40 }: { item: string; size?: number }) {
  return <PixelArt rows={SPRITES[spriteFor(item)]} size={size} />;
}

/** One-colour pixel icon: the "#" cells of core's GRIDS in a tone. */
export function Icon({ name, size = 20, tone = "text" }: { name: IconName; size?: number; tone?: Tone }) {
  const { color } = useTokens();
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${PIXEL_SIZE} ${PIXEL_SIZE}`}>
      <Path d={pixelPath(ICON_GRIDS[name], "#")} fill={color[tone]} />
    </Svg>
  );
}
