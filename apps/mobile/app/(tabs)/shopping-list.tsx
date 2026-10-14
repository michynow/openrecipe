import { copy } from "@openrecipe/core/copy";
import { buildShoppingListText } from "@openrecipe/core/shopping-list";
import { Alert, RefreshControl, ScrollView, Share, Text, View } from "react-native";

import { ItemsCard } from "../../components/shopping-list/items-card";
import { RecipesCard } from "../../components/shopping-list/recipes-card";
import { ArcadeButton } from "../../components/ui/button";
import { Screen } from "../../components/ui/screen";
import { StateView } from "../../components/ui/state-view";
import { useClearShoppingList, useShoppingList } from "../../lib/hooks/shopping-list";

/** The household list (ADR-0009): everyone signed in, Members included. Needs the network. */
export default function ShoppingListScreen() {
  const query = useShoppingList();
  const clear = useClearShoppingList();
  const list = query.data;

  if (query.isPending) return <StateView />;
  if (!list || query.isError) {
    return (
      <StateView
        title={copy.common.somethingFailed}
        action={{ label: copy.common.retry, onPress: () => query.refetch() }}
      />
    );
  }

  const anyTicked = list.groups.some((g) => g.rows.some((r) => r.ticked));
  const empty = list.groups.length === 0 && list.recipes.length === 0;

  return (
    <Screen>
      <ScrollView
        contentContainerClassName="gap-4 p-4 pb-12"
        refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => query.refetch()} />}
      >
        {empty ? (
          <Text className="rounded-card border-2 border-dashed border-line p-6 text-center font-body text-muted">
            {copy.shoppingList.empty}
          </Text>
        ) : (
          <>
            <RecipesCard recipes={list.recipes} />
            <ItemsCard groups={list.groups} />
            <View className="gap-3">
              <ArcadeButton
                tone="accent"
                label={copy.shoppingList.share}
                onPress={() => Share.share({ message: buildShoppingListText(list) }).catch(() => {})}
              />
              <ArcadeButton
                tone="surface"
                label={copy.shoppingList.clearTicked}
                disabled={!anyTicked || clear.isPending}
                onPress={() => clear.mutate("ticked")}
              />
              <ArcadeButton
                tone="surface"
                label={copy.shoppingList.clearAll}
                disabled={clear.isPending}
                onPress={() =>
                  Alert.alert(copy.shoppingList.clearAll, copy.shoppingList.clearAllConfirm, [
                    { text: copy.editor.cancel, style: "cancel" },
                    { text: copy.shoppingList.clearAll, style: "destructive", onPress: () => clear.mutate("all") },
                  ])
                }
              />
            </View>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
