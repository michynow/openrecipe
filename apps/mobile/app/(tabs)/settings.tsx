import { copy } from "@openrecipe/core/copy";
import { useRouter } from "expo-router";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";

import { InvitesSection } from "../../components/settings/invites";
import { MembersSection } from "../../components/settings/members";
import { HEADING } from "../../components/settings/styles";
import { TagsSection } from "../../components/settings/tags";
import { ArcadeButton } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { AdminGateView, useAdminGate } from "../../components/ui/admin-gate";
import { RefreshBar, usePullRefresh } from "../../components/ui/refresh";
import { Screen } from "../../components/ui/screen";
import { useSettings } from "../../lib/hooks/admin";

/** The admins' screen: Invites, Members, Tags and the import queue. A Member gets "not found". */
export default function Settings() {
  const router = useRouter();
  const gate = useAdminGate();
  const settings = useSettings(gate.ok);
  const pull = usePullRefresh(settings.refetch);

  if (!gate.ok) return <AdminGateView gate={gate} />;

  const data = settings.data;
  return (
    <Screen>
      <ScrollView
        contentContainerClassName="gap-5 p-4 pb-12"
        keyboardShouldPersistTaps="handled"
        refreshControl={pull.control}
      >
        {!data ? (
          settings.isError ? (
            <View className="items-center gap-3 py-10">
              <Text className="text-center font-bold text-accent">{copy.common.somethingFailed}</Text>
              <ArcadeButton label={copy.common.retry} onPress={() => settings.refetch()} />
            </View>
          ) : (
            <ActivityIndicator />
          )
        ) : (
          <>
            <InvitesSection invites={data.invites} />
            <MembersSection members={data.members} />
            <TagsSection tags={data.tags} />
            <Card className="gap-3 p-4">
              <Text className={HEADING}>{copy.settings.queue}</Text>
              <View className="flex-row flex-wrap gap-5">
                <Stat n={data.queue.queued} label={copy.settings.queueQueued} tone="text-text" />
                <Stat n={data.queue.ready} label={copy.settings.queueReady} tone="text-accent" />
                <Stat n={data.queue.failed} label={copy.settings.queueFailed} tone="text-accent2" />
              </View>
              <ArcadeButton label={copy.nav.drafts} tone="surface" onPress={() => router.navigate("/drafts" as never)} />
            </Card>
          </>
        )}
      </ScrollView>
      <RefreshBar active={pull.refreshing} />
    </Screen>
  );
}

function Stat({ n, label, tone }: { n: number; label: string; tone: string }) {
  return (
    <View>
      <Text className={`font-display text-3xl ${tone}`}>{n}</Text>
      <Text className="font-body text-sm text-muted">{label}</Text>
    </View>
  );
}
