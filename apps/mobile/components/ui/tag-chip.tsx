import { TAG_SPRITES } from "@openrecipe/core/tag-sprites";
import type { ChipTag } from "@openrecipe/core/tags";
import { Text, View } from "react-native";

import { facetStyle } from "./facet-style";
import { Icon, PixelArt } from "./pixel";

const SIZE = {
  md: { chip: "gap-1.5 px-2 py-0.5", art: 22, text: "text-sm" },
  sm: { chip: "gap-1 px-1.5", art: 16, text: "text-xs" },
};

/** A Tag as a sticker: its pixel sprite (or its Facet's icon) on its Facet's colour, then the label. */
export function TagChip({ tag, size = "md" }: { tag: ChipTag; size?: "md" | "sm" }) {
  const style = facetStyle(tag.facet);
  const sprite = TAG_SPRITES[tag.slug];
  const s = SIZE[size];
  return (
    <View
      className={`max-w-full flex-row items-center self-start rounded-input border-2 border-line ${s.chip} ${style.className}`}
    >
      {sprite ? <PixelArt rows={sprite} size={s.art} /> : <Icon name={style.icon} size={s.art} tone="ink" />}
      <Text numberOfLines={1} className={`shrink font-bold text-ink ${s.text}`}>
        {tag.label}
      </Text>
    </View>
  );
}
