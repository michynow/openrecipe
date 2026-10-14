import type { Proposal } from "@openrecipe/core/api";
import { copy } from "@openrecipe/core/copy";
import { Text, View } from "react-native";

import { ArcadeButton } from "../ui/button";
import { Kielbas } from "../ui/kielbas";
import { RecipeCard } from "../ui/recipe-card";

/** Today's Proposals: one card per Meal Slot, and a way to say "something else". */
export function Proposals({
  proposals,
  rerolling,
  onReroll,
}: {
  proposals: Proposal[];
  rerolling: boolean;
  onReroll: () => void;
}) {
  if (!proposals.some((p) => p.recipe)) return null;

  return (
    <View className="gap-3">
      <View className="flex-row items-center justify-between gap-3">
        <Text className="font-display text-2xl uppercase text-text">{copy.dashboard.proposals}</Text>
        <ArcadeButton
          label={rerolling ? copy.common.loading : copy.dashboard.reroll}
          onPress={onReroll}
          disabled={rerolling}
          icon="refresh"
          tone="surface"
        />
      </View>

      {/* While the kitchen re-rolls, MC Kiełbas yaps over the dimmed cards. */}
      <View className="gap-4">
        {rerolling ? (
          <View className="items-center">
            <Kielbas talking size={64} />
          </View>
        ) : null}
        {proposals.map((p) => (
          <View key={p.slot} className={`gap-1.5 ${rerolling ? "opacity-40" : ""}`}>
            <View className="flex-row items-baseline gap-2">
              <Text className="font-bold text-sm uppercase text-text">{copy.mealSlots[p.slot]}</Text>
              {p.wildcard ? <Text className="font-body text-sm text-accent2">{copy.dashboard.wildcard}</Text> : null}
            </View>
            {p.recipe ? (
              <View className="flex-row">
                <RecipeCard recipe={p.recipe} />
              </View>
            ) : (
              <View className="rounded-card border-2 border-dashed border-line p-4">
                <Text className="font-body text-sm text-muted">{copy.dashboard.slotEmpty}</Text>
              </View>
            )}
          </View>
        ))}
      </View>
    </View>
  );
}
