import type { FacetGroup } from "@openrecipe/core/api";
import { copy } from "@openrecipe/core/copy";
import { formatDuration } from "@openrecipe/core/format";
import { toggleTag, type SearchFilters } from "@openrecipe/core/search-params";
import { Pressable, Text, View } from "react-native";

const TIME_PRESETS = [undefined, 15, 30, 60] as const;

function Option({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on }}
      onPress={onPress}
      className={`min-h-9 justify-center rounded-input border-2 border-line px-2.5 ${on ? "bg-accent" : "bg-surface"}`}
    >
      <Text className={`font-bold text-sm ${on ? "text-accent-ink" : "text-text"}`}>{label}</Text>
    </Pressable>
  );
}

/** Facet chips, max-time presets and the has-image toggle. Each tap is one query. */
export function SearchFilterPanel({
  filters,
  groups,
  onChange,
}: {
  filters: SearchFilters;
  groups: FacetGroup[];
  onChange: (next: SearchFilters) => void;
}) {
  return (
    <View className="gap-4 rounded-card border-[3px] border-line bg-surface p-3">
      {groups.map((group) => (
        <View key={group.facet} className="gap-1.5">
          <Text className="font-bold text-sm uppercase text-text">{copy.editor.facets[group.facet] ?? group.facet}</Text>
          <View className="flex-row flex-wrap gap-1.5">
            {group.tags.map((tag) => (
              <Option
                key={tag.slug}
                label={tag.label}
                on={filters.tagSlugs.includes(tag.slug)}
                onPress={() => onChange(toggleTag(filters, tag.slug))}
              />
            ))}
          </View>
        </View>
      ))}

      <View className="gap-1.5">
        <Text className="font-bold text-sm uppercase text-text">{copy.search.maxTime}</Text>
        <View className="flex-row flex-wrap gap-1.5">
          {TIME_PRESETS.map((minutes) => (
            <Option
              key={minutes ?? "any"}
              label={minutes === undefined ? copy.search.anyTime : formatDuration(minutes)!}
              on={filters.maxTotalMinutes === minutes}
              onPress={() => onChange({ ...filters, maxTotalMinutes: minutes })}
            />
          ))}
        </View>
      </View>

      <View className="flex-row">
        <Option
          label={copy.search.hasImage}
          on={filters.hasImage}
          onPress={() => onChange({ ...filters, hasImage: !filters.hasImage })}
        />
      </View>
    </View>
  );
}
