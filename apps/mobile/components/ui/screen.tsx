import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Defs, Path, Pattern, Rect } from "react-native-svg";

import { useTokens } from "../../lib/theme";

/** Custard with a gingham tablecloth: two faint tomato stripes crossing. */
export function Screen({ children }: { children: ReactNode }) {
  const { color } = useTokens();
  return (
    <View className="flex-1 bg-bg">
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" pointerEvents="none">
        <Defs>
          <Pattern id="gingham" width={48} height={48} patternUnits="userSpaceOnUse">
            <Path d="M0 0h24v48H0z" fill={color.accent} fillOpacity={0.07} />
            <Path d="M0 0h48v24H0z" fill={color.accent} fillOpacity={0.07} />
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#gingham)" />
      </Svg>
      {children}
    </View>
  );
}
