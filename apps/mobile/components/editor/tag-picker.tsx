import { copy } from "@openrecipe/core/copy";
import type { FacetGroup } from "@openrecipe/core/api";
import { MAX_TAGS } from "@openrecipe/core/recipe-schema";
import { useContext, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { TagChip } from "../ui/tag-chip";
import { ErrorText, FieldRegistry } from "./fields";

/** Up to MAX_TAGS Tags from a closed list, grouped by Facet. */
export function TagPicker({
  groups,
  selected,
  onChange,
  error,
}: {
  groups: FacetGroup[];
  selected: string[];
  onChange: (next: string[]) => void;
  error?: string;
}) {
  const reg = useContext(FieldRegistry);
  // Not a validation error, so transient: said when a tap on a full list does nothing.
  const [capHit, setCapHit] = useState(false);
  const full = selected.length >= MAX_TAGS;

  function toggle(slug: string) {
    if (selected.includes(slug)) {
      setCapHit(false);
      onChange(selected.filter((s) => s !== slug));
    } else if (full) {
      setCapHit(true);
    } else {
      setCapHit(false);
      onChange([...selected, slug]);
    }
  }

  return (
    <View ref={reg("tagSlugs")} className="gap-3">
      {groups.map((group) => (
        <View key={group.facet} className="gap-1.5">
          <Text className="font-bold text-sm uppercase text-text">{copy.editor.facets[group.facet] ?? group.facet}</Text>
          <View className="flex-row flex-wrap gap-2">
            {group.tags.map((tag) => {
              const on = selected.includes(tag.slug);
              return (
                <Pressable
                  key={tag.slug}
                  accessibilityRole="checkbox"
                  accessibilityLabel={tag.label}
                  accessibilityState={{ checked: on, disabled: full && !on }}
                  onPress={() => toggle(tag.slug)}
                  className={`min-h-11 justify-center rounded-input border-2 p-0.5 ${
                    on ? "border-accent bg-accent/15" : "border-transparent"
                  } ${full && !on ? "opacity-40" : ""}`}
                >
                  <TagChip tag={{ ...tag, facet: group.facet }} />
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}
      {capHit && (
        <Text accessibilityLiveRegion="polite" className="font-bold text-sm text-accent2">
          {copy.editor.tagsFull}
        </Text>
      )}
      <ErrorText>{error}</ErrorText>
    </View>
  );
}
