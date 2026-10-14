import { copy } from "@openrecipe/core/copy";
import { useRouter } from "expo-router";
import { RefreshControl, ScrollView, Text, View } from "react-native";

import { Proposals } from "../../components/home/proposals";
import { StatTiles } from "../../components/home/stat-tiles";
import { ArcadeButton } from "../../components/ui/button";
import { RecipeGrid, RecipeGridSkeleton } from "../../components/ui/recipe-card";
import { Screen } from "../../components/ui/screen";
import { useHome, useReroll } from "../../lib/hooks/discovery";

export default function Home() {
  const router = useRouter();
  const home = useHome();
  const reroll = useReroll();

  return (
    <Screen>
      <ScrollView
        contentContainerClassName="gap-6 p-4"
        refreshControl={<RefreshControl refreshing={home.isRefetching && !reroll.isPending} onRefresh={() => home.refetch()} />}
      >
        {home.isError && !home.data ? (
          <View className="items-center gap-3 py-10">
            <Text className="text-center font-bold text-accent">{copy.common.somethingFailed}</Text>
            <ArcadeButton label={copy.common.retry} onPress={() => home.refetch()} />
          </View>
        ) : !home.data ? (
          <>
            <View className="h-20 rounded-card bg-fill" />
            <RecipeGridSkeleton />
          </>
        ) : (
          <>
            <StatTiles stats={home.data.stats} />
            <Proposals
              proposals={home.data.proposals}
              rerolling={reroll.isPending}
              onReroll={() => reroll.mutate()}
            />
            {reroll.isError && !reroll.isPending ? (
              <Text accessibilityRole="alert" className="text-center font-bold text-sm text-accent">
                {copy.common.somethingFailed}
              </Text>
            ) : null}
            <View className="flex-row items-baseline justify-between gap-3">
              <Text className="font-display text-2xl uppercase text-text">{copy.library.recent}</Text>
              {home.data.recent.nextCursor ? (
                <Text
                  accessibilityRole="link"
                  onPress={() => router.navigate("/search")}
                  className="font-bold text-sm text-accent underline"
                >
                  {copy.library.seeAll}
                </Text>
              ) : null}
            </View>
            {home.data.recent.recipes.length === 0 ? (
              <Text className="rounded-card border-2 border-dashed border-line p-6 text-center font-body text-muted">
                {copy.library.empty}
              </Text>
            ) : (
              <RecipeGrid recipes={home.data.recent.recipes} />
            )}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
