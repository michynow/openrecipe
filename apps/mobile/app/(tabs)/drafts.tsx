import { copy } from "@openrecipe/core/copy";
import { useLocalSearchParams } from "expo-router";
import { ActivityIndicator, FlatList, RefreshControl, Text, View } from "react-native";

import { DraftItem } from "../../components/drafts/draft-item";
import { ParkForm } from "../../components/drafts/park-form";
import { ArcadeButton } from "../../components/ui/button";
import { AdminGateView, useAdminGate } from "../../components/ui/admin-gate";
import { Screen } from "../../components/ui/screen";
import { useDrafts } from "../../lib/hooks/drafts";

/** Park a link, then watch the kitchen work on it. Admin only: a Member gets "not found". */
export default function Drafts() {
  const { url, shared } = useLocalSearchParams<{ url?: string; shared?: string }>();
  const gate = useAdminGate();
  const drafts = useDrafts(gate.ok);
  const active = drafts.data?.some((d) => d.status === "queued" || d.status === "processing");

  if (!gate.ok) return <AdminGateView gate={gate} />;

  return (
    <Screen>
      <FlatList
        data={drafts.data ?? []}
        keyExtractor={(d) => d.id}
        renderItem={({ item }) => <DraftItem draft={item} />}
        contentContainerClassName="gap-4 p-4"
        refreshControl={<RefreshControl refreshing={drafts.isRefetching} onRefresh={() => drafts.refetch()} />}
        ListHeaderComponent={
          <View className="gap-4 pb-2">
            <ParkForm prefill={url} nonce={shared} />
            <View className="flex-row items-center justify-between">
              <Text className="font-display text-2xl uppercase text-text">{copy.imports.draftsTitle}</Text>
              {active ? (
                <View className="flex-row items-center gap-2" accessibilityLiveRegion="polite">
                  <View className="h-3 w-3 rounded-full border-2 border-line bg-leaf" />
                  <Text className="font-bold text-sm uppercase text-text">{copy.imports.progress.live}</Text>
                </View>
              ) : null}
            </View>
          </View>
        }
        ListEmptyComponent={
          drafts.isPending ? (
            <ActivityIndicator />
          ) : drafts.isError ? (
            <View className="items-center gap-3 py-6">
              <Text className="text-center font-bold text-accent">{copy.common.somethingFailed}</Text>
              <ArcadeButton label={copy.common.retry} onPress={() => drafts.refetch()} />
            </View>
          ) : (
            <Text className="rounded-card border-2 border-dashed border-line p-6 text-center font-body text-muted">
              {copy.imports.draftsEmpty}
            </Text>
          )
        }
      />
    </Screen>
  );
}
