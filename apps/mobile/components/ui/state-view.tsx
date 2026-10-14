import { copy } from "@openrecipe/core/copy";
import { useRouter } from "expo-router";
import { ActivityIndicator, Text, View } from "react-native";

import { ArcadeButton } from "./button";

/** Loading (no title) / not-found / failed, for any screen. */
export function StateView({
  title,
  body,
  action,
}: {
  title?: string;
  body?: string;
  action?: { label: string; onPress: () => void };
}) {
  return (
    <View className="flex-1 items-center justify-center gap-3 bg-bg px-6">
      {title ? (
        <Text className="text-center font-display text-4xl uppercase text-text">{title}</Text>
      ) : (
        <ActivityIndicator />
      )}
      {body ? <Text className="text-center text-sm text-muted">{body}</Text> : null}
      {action ? <ArcadeButton label={action.label} onPress={action.onPress} /> : null}
    </View>
  );
}

/** The one "not found": unknown ids, deleted Recipes, and admin screens a Member reaches. */
export function NotFound() {
  const router = useRouter();
  return (
    <StateView
      title={copy.common.notFoundTitle}
      body={copy.common.notFoundBody}
      action={{ label: copy.common.backHome, onPress: () => router.replace("/") }}
    />
  );
}
