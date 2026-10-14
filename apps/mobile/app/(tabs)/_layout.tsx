import { copy } from "@openrecipe/core/copy";
import type { IconName } from "@openrecipe/core/icons";
import { Tabs } from "expo-router";
import { Pressable, Text } from "react-native";

import { Icon } from "../../components/ui/pixel";
import { signOut } from "../../lib/sign-out";
import { useTokens } from "../../lib/theme";

const tabIcon = (name: IconName) =>
  function TabIcon({ focused }: { focused: boolean }) {
    return <Icon name={name} size={24} tone={focused ? "accent" : "muted"} />;
  };

export default function TabsLayout() {
  const { color } = useTokens();
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
          // Sign out lives here until the Phase 3 account screen.
          headerRight: () => (
            <Pressable
              accessibilityRole="button"
              onPress={() => signOut()}
              className="mr-3 min-h-11 justify-center px-2"
            >
              <Text className="font-bold text-sm text-ink">{copy.nav.signOut}</Text>
            </Pressable>
          ),
        }}
      />
      <Tabs.Screen name="search" options={{ title: copy.nav.search, tabBarIcon: tabIcon("tags") }} />
    </Tabs>
  );
}
