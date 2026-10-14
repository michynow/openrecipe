import { copy } from "@openrecipe/core/copy";
import { Pressable, Text, View } from "react-native";

import { useMe } from "../lib/api";
import { authClient } from "../lib/auth";

// Placeholder: proves cookie -> /api/v1 end to end. Phase 2 replaces it.
export default function Home() {
  const me = useMe();
  return (
    <View className="flex-1 justify-center gap-4 bg-bg p-6">
      <Text className="text-2xl font-bold text-text">{copy.app.name}</Text>
      {me.data ? (
        <Text className="text-text">
          {me.data.name} · {me.data.role}
        </Text>
      ) : me.isError ? (
        <Text className="text-accent">{copy.common.somethingFailed}</Text>
      ) : null}
      <Pressable
        onPress={() => authClient.signOut()}
        className="items-center rounded-input border-2 border-line bg-gold py-3"
      >
        <Text className="font-bold text-ink">{copy.nav.signOut}</Text>
      </Pressable>
    </View>
  );
}
