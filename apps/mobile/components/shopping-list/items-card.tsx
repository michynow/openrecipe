import { copy } from "@openrecipe/core/copy";
import { rowAmount, type ShoppingList } from "@openrecipe/core/shopping-list";
import * as Haptics from "expo-haptics";
import { Pressable, Text, View } from "react-native";

import { useTokens } from "../../lib/theme";
import { useTickShoppingItem } from "../../lib/hooks/shopping-list";
import { Card } from "../ui/card";
import { IngredientSprite } from "../ui/pixel";

/** The merged items, one product heading each. Ticked rows stay in place, struck through. */
export function ItemsCard({ groups }: { groups: ShoppingList["groups"] }) {
  const { px } = useTokens();
  const tick = useTickShoppingItem();
  return (
    <Card className="gap-3 p-4">
      <Text accessibilityRole="header" className="font-display text-xl uppercase text-text">
        {copy.shoppingList.items}
      </Text>
      {groups.map((group, gi) => (
        <View key={group.item} className={gi > 0 ? "border-t-2 border-line/10 pt-3" : ""}>
          <View className="flex-row items-center gap-2 pb-1">
            <View style={{ backgroundColor: px.w }} className="size-10 items-center justify-center rounded-lg border-2 border-ink">
              <IngredientSprite item={group.item} size={30} />
            </View>
            <Text className="flex-1 font-display text-lg text-text">{group.item}</Text>
          </View>
          {group.rows.map((row) => {
            const amount = rowAmount(row);
            return (
              <Pressable
                key={row.key}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: row.ticked }}
                accessibilityLabel={`${row.ticked ? copy.shoppingList.untick : copy.shoppingList.tick}: ${amount} ${group.item}`}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  tick.mutate({ key: row.key, ticked: !row.ticked });
                }}
                className={`min-h-12 flex-row items-center gap-3 py-1 ${row.ticked ? "opacity-50" : ""}`}
              >
                <View
                  className={`size-8 items-center justify-center rounded-lg border-2 border-ink ${row.ticked ? "bg-gold" : "bg-surface"}`}
                >
                  {row.ticked && <Text className="font-display text-base text-ink">✓</Text>}
                </View>
                <View className="flex-1">
                  <Text style={{ fontVariant: ["tabular-nums"] }} className={`text-base font-bold text-text ${row.ticked ? "line-through" : ""}`}>{amount}</Text>
                  <Text className="text-sm text-muted">
                    {copy.shoppingList.from} {row.sources.map((s) => s.title).join(", ")}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </Card>
  );
}
