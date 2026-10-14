import { copy } from "@openrecipe/core/copy";
import { count } from "@openrecipe/core/format";
import * as Haptics from "expo-haptics";
import { useRouter, type Href } from "expo-router";
import { Text, View } from "react-native";

import { useAddToShoppingList } from "../../lib/hooks/shopping-list";
import { ArcadeButton } from "../ui/button";
import { showToast } from "../ui/toast";

/** Put this Recipe on the household list at the chosen servings; Pantry ticks are left off. */
export function AddToShoppingList({
  recipeId,
  servings,
  checked,
  onList,
}: {
  recipeId: string;
  servings: number;
  checked: string[];
  onList: number | null;
}) {
  const router = useRouter();
  const add = useAddToShoppingList();
  return (
    <View className="gap-2">
      {onList !== null && (
        <Text className="font-bold text-sm text-leaf">
          {copy.shoppingList.onList} · {count(onList, copy.units.servings)}
        </Text>
      )}
      <ArcadeButton
        tone="surface"
        icon="cart"
        label={onList !== null ? copy.shoppingList.update : copy.shoppingList.add}
        disabled={add.isPending}
        onPress={() =>
          add.mutate(
            { recipeId, servings, excludedLineIds: checked },
            {
              onSuccess: (res) => {
                if (!res.ok) return;
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
                showToast({
                  message: copy.shoppingList.added,
                  action: { label: copy.shoppingList.open, onPress: () => router.push("/shopping-list" as Href) },
                });
              },
            },
          )
        }
      />
      {checked.length > 0 && <Text className="text-sm text-muted">{copy.shoppingList.pantryNote}</Text>}
    </View>
  );
}
