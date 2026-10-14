import { copy } from "@openrecipe/core/copy";
import { count } from "@openrecipe/core/format";
import type { ShoppingList } from "@openrecipe/core/shopping-list";
import { useRouter, type Href } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { useRemoveFromShoppingList, useSetShoppingListServings } from "../../lib/hooks/shopping-list";
import { Card } from "../ui/card";

function Stepper({ label, glyph, disabled, onPress }: { label: string; glyph: string; disabled: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      className={`size-11 items-center justify-center rounded-xl border-2 border-ink bg-surface active:bg-fill ${disabled ? "opacity-30" : ""}`}
    >
      <Text className="text-xl font-bold text-text">{glyph}</Text>
    </Pressable>
  );
}

/** The Recipes on the list, each with its own servings. */
export function RecipesCard({ recipes }: { recipes: ShoppingList["recipes"] }) {
  const router = useRouter();
  const setServings = useSetShoppingListServings();
  const remove = useRemoveFromShoppingList();
  // One change at a time: the stepper reads servings from the last answer, so a
  // second tap before it lands would send the same number again.
  const busy = setServings.isPending || remove.isPending;
  return (
    <Card className="gap-3 p-4">
      <Text accessibilityRole="header" className="font-display text-xl uppercase text-text">
        {copy.shoppingList.recipes}
      </Text>
      {recipes.map((r, i) => (
        <View key={r.recipeId} className={`gap-2 ${i > 0 ? "border-t-2 border-line/10 pt-3" : ""}`}>
          <Pressable accessibilityRole="link" onPress={() => router.push(`/recipe/${r.slug}` as Href)}>
            <Text className="font-bold text-base text-text underline">{r.title}</Text>
          </Pressable>
          {r.skipped > 0 && <Text className="text-sm text-muted">{copy.shoppingList.skipped(r.skipped)}</Text>}
          <View className="flex-row flex-wrap items-center gap-2">
            <Stepper
              label={copy.recipe.fewerServings}
              glyph="−"
              disabled={busy || r.servings <= 1}
              onPress={() => setServings.mutate({ recipeId: r.recipeId, servings: r.servings - 1 })}
            />
            <Text accessibilityLiveRegion="polite" className="min-w-24 text-center font-bold text-text">
              {count(r.servings, copy.units.servings)}
            </Text>
            <Stepper
              label={copy.recipe.moreServings}
              glyph="+"
              disabled={busy || r.servings >= 99}
              onPress={() => setServings.mutate({ recipeId: r.recipeId, servings: r.servings + 1 })}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${copy.shoppingList.remove}: ${r.title}`}
              onPress={() => remove.mutate(r.recipeId)}
              disabled={busy}
              className="ml-auto min-h-11 justify-center rounded-input border-2 border-line bg-surface px-3"
            >
              <Text className="font-bold text-sm text-accent2">{copy.shoppingList.remove}</Text>
            </Pressable>
          </View>
        </View>
      ))}
    </Card>
  );
}
