import type { IconName } from "@openrecipe/core/icons";
import * as Haptics from "expo-haptics";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import type { Tone } from "../../lib/theme";
import { Icon } from "./pixel";

const FACE: Record<"gold" | "accent" | "surface", { bg: string; text: string; tone: Tone }> = {
  gold: { bg: "bg-gold", text: "text-ink", tone: "ink" },
  accent: { bg: "bg-accent", text: "text-accent-ink", tone: "accent-ink" },
  surface: { bg: "bg-surface", text: "text-text", tone: "text" },
};

/** Chunky button: ink outline on a 4px ink lip; the face drops onto the lip when pressed. */
export function ArcadeButton({
  label,
  onPress,
  tone = "gold",
  icon,
  disabled,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  tone?: "gold" | "accent" | "surface";
  icon?: IconName;
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  const [down, setDown] = useState(false);
  const face = FACE[tone];
  return (
    <View className={`rounded-input bg-line pb-1 ${disabled ? "opacity-50" : ""}`}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityState={{ disabled: !!disabled }}
        disabled={disabled}
        onPressIn={() => {
          setDown(true);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        }}
        onPressOut={() => setDown(false)}
        onPress={onPress}
        style={{ transform: [{ translateY: down ? 3 : 0 }] }}
        className={`min-h-11 flex-row items-center justify-center gap-2 rounded-input border-2 border-line px-4 py-2 ${face.bg}`}
      >
        {icon ? <Icon name={icon} size={18} tone={face.tone} /> : null}
        <Text className={`font-display text-base uppercase ${face.text}`}>{label}</Text>
      </Pressable>
    </View>
  );
}
