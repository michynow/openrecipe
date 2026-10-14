import type { ReactNode } from "react";
import { View } from "react-native";

/** Sticker panel: ink outline and a hard 5px offset shadow (web: rounded-card + border). */
export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <View className="mb-[5px] mr-[5px]">
      <View className="absolute inset-0 left-[5px] top-[5px] rounded-card bg-line" />
      <View className={`overflow-hidden rounded-card border-[3px] border-line bg-surface ${className}`}>
        {children}
      </View>
    </View>
  );
}
