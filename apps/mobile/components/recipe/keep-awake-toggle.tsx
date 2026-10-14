import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { useEffect, useState } from "react";
import { Switch, Text, View } from "react-native";

import { copy } from "@openrecipe/core/copy";

import { useTokens } from "../../lib/theme";

const TAG = "recipe-cooking";

/** Off by default; always released on unmount so the screen can sleep again. */
export function KeepAwakeToggle() {
  const [on, setOn] = useState(false);
  const { color } = useTokens();

  useEffect(() => {
    if (!on) return;
    // Release only after the activate settles: a deactivate that overtakes it
    // would be undone by the late activate, and the screen would never sleep.
    const activated = activateKeepAwakeAsync(TAG).catch(() => {});
    return () => {
      activated.then(() => deactivateKeepAwake(TAG)).catch(() => {});
    };
  }, [on]);

  return (
    <View className="flex-row items-center justify-between gap-3">
      <View className="flex-1">
        <Text className="font-display text-base text-text">{copy.recipe.wakeLock}</Text>
        {on && <Text className="text-sm text-muted">{copy.recipe.wakeLockOn}</Text>}
      </View>
      <Switch
        value={on}
        onValueChange={setOn}
        accessibilityLabel={copy.recipe.wakeLock}
        trackColor={{ false: color.fill, true: color.accent }}
        thumbColor={color.surface}
      />
    </View>
  );
}
