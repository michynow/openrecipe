import type { RecipeCard as RecipeCardData } from "@openrecipe/core/api";
import { formatDuration } from "@openrecipe/core/format";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { recipeImage } from "../../lib/image";
import { TagChip } from "./tag-chip";

/** A recipe tile: photo (or a designed placeholder), time badge, title, up to two rows of tags. */
export function RecipeCard({ recipe }: { recipe: RecipeCardData }) {
  const router = useRouter();
  const source = recipeImage(recipe.imageUrl);
  const duration = formatDuration(recipe.totalMinutes);

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={recipe.title}
      onPress={() => router.push({ pathname: "/recipe/[slug]", params: { slug: recipe.slug } })}
      className="flex-1 active:opacity-80"
    >
      <View className="flex-1 overflow-hidden rounded-card border-[3px] border-line bg-surface">
        <View className="aspect-[4/3] w-full overflow-hidden bg-fill">
          {source ? (
            <Image source={source} contentFit="cover" style={{ width: "100%", height: "100%" }} />
          ) : (
            <View className="h-full w-full items-center justify-center bg-fill">
              <Text className="font-display text-3xl uppercase text-muted">{recipe.title.slice(0, 2)}</Text>
            </View>
          )}
          {duration ? (
            <View className="absolute bottom-2 right-2 rounded-input border-2 border-line bg-gold px-1.5">
              <Text className="font-bold text-xs leading-6 text-ink">{duration}</Text>
            </View>
          ) : null}
        </View>
        <View className="flex-1 gap-2 p-3">
          <Text numberOfLines={2} className="min-h-[44px] font-display text-lg uppercase leading-snug text-text">
            {recipe.title}
          </Text>
          <View className="h-[60px] flex-row flex-wrap content-start gap-1 overflow-hidden">
            {recipe.tags.map((tag) => (
              <TagChip key={tag.slug} tag={tag} size="sm" />
            ))}
          </View>
        </View>
      </View>
    </Pressable>
  );
}

/** Same footprint as a card, so a loading grid does not reflow. */
export function RecipeCardSkeleton() {
  return (
    <View className="flex-1 overflow-hidden rounded-card border-[3px] border-line bg-surface">
      <View className="aspect-[4/3] w-full bg-fill" />
      <View className="gap-2 p-3">
        <View className="h-11 w-3/4 rounded-input bg-fill" />
        <View className="h-[60px] w-1/2 rounded-input bg-fill" />
      </View>
    </View>
  );
}

/** Two-column grid. An odd last card gets an empty cell so it keeps its width. */
export function RecipeGrid({ recipes }: { recipes: RecipeCardData[] }) {
  const rows: RecipeCardData[][] = [];
  for (let i = 0; i < recipes.length; i += 2) rows.push(recipes.slice(i, i + 2));
  return (
    <View className="gap-3">
      {rows.map((row) => (
        <View key={row[0].slug} className="flex-row gap-3">
          {row.map((r) => (
            <RecipeCard key={r.slug} recipe={r} />
          ))}
          {row.length === 1 ? <View className="flex-1" /> : null}
        </View>
      ))}
    </View>
  );
}

export function RecipeGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <View className="gap-3">
      {Array.from({ length: count / 2 }, (_, i) => (
        <View key={i} className="flex-row gap-3">
          <RecipeCardSkeleton />
          <RecipeCardSkeleton />
        </View>
      ))}
    </View>
  );
}
