import { copy } from "@openrecipe/core/copy";
import type { IconName } from "@openrecipe/core/icons";
import type { HelpTopic } from "@openrecipe/core/help";
import { Tabs, useRouter, type Href } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { HelpButton } from "../../components/ui/help-button";
import { Icon } from "../../components/ui/pixel";
import { useIsAdmin } from "../../lib/hooks/admin";
import { useTokens } from "../../lib/theme";

const tabIcon = (name: IconName) =>
  function TabIcon({ focused }: { focused: boolean }) {
    return <Icon name={name} size={24} tone={focused ? "accent" : "muted"} />;
  };

const help = (topic: HelpTopic) => () => (
  <View className="mr-3">
    <HelpButton topic={topic} />
  </View>
);

/** Home's header: add a Recipe (admin) and the account screen (everyone). */
function HomeHeaderRight({ admin }: { admin: boolean }) {
  const router = useRouter();
  return (
    <View className="mr-3 flex-row items-center gap-2">
      <HelpButton topic="dashboard" />
      {admin ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={copy.nav.add}
          onPress={() => router.push("/editor/new" as Href)}
          className="min-h-11 flex-row items-center gap-1.5 rounded-input border-2 border-line bg-accent px-3"
        >
          <Icon name="edit" size={16} tone="accent-ink" />
          <Text className="font-display text-sm uppercase text-accent-ink">{copy.nav.addShort}</Text>
        </Pressable>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={copy.nav.account}
        onPress={() => router.push("/account" as Href)}
        className="min-h-11 justify-center rounded-input border-2 border-ink bg-gold px-3"
      >
        <Text className="font-bold text-sm text-ink">{copy.nav.account}</Text>
      </Pressable>
    </View>
  );
}

export default function TabsLayout() {
  const { color } = useTokens();
  const admin = useIsAdmin().data === true;
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: color.gold },
        headerTintColor: color.ink,
        headerTitleStyle: { fontFamily: "Baloo2_800ExtraBold", color: color.ink },
        headerShadowVisible: false,
        sceneStyle: { backgroundColor: color.bg },
        tabBarStyle: { backgroundColor: color.surface, borderTopWidth: 3, borderTopColor: color.line },
        tabBarActiveTintColor: color.accent,
        tabBarInactiveTintColor: color.muted,
        tabBarLabelStyle: { fontFamily: "Nunito_800ExtraBold" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: copy.nav.dashboard,
          tabBarIcon: tabIcon("ingredients"),
          headerRight: () => <HomeHeaderRight admin={admin} />,
        }}
      />
      <Tabs.Screen name="search" options={{ title: copy.nav.search, tabBarIcon: tabIcon("tags"), headerRight: help("search") }} />
      {/* Members never see these; the server refuses them anyway. */}
      <Tabs.Screen
        name="drafts"
        options={{ title: copy.nav.drafts, tabBarIcon: tabIcon("link"), href: admin ? undefined : null, headerRight: help("drafts") }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: copy.nav.settings, tabBarIcon: tabIcon("basics"), href: admin ? undefined : null, headerRight: help("settings") }}
      />
    </Tabs>
  );
}
