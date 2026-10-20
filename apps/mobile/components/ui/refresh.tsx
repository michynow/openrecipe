import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useState } from "react";
import { RefreshControl, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { useTokens } from "../../lib/theme";

/**
 * Pull-to-refresh without the platform's spinner: the gesture stays, the
 * Material circle (or the iOS wheel) goes, and a thin bar at the top of the
 * screen shows the refetch instead — see RefreshBar.
 *
 * Android has no "hide the circle" switch. Its position and the pull distance
 * that triggers a refresh are set separately, though (SwipeRefreshLayout), so
 * parking the circle far above the screen hides it and the pull still works.
 */
const OFFSCREEN = -1000;

function quietRefresh(refreshing: boolean, onRefresh: () => void) {
  return (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={() => {
        // The only feedback that the pull landed, with no circle to see.
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onRefresh();
      }}
      progressViewOffset={OFFSCREEN}
      colors={["transparent"]}
      progressBackgroundColor="transparent"
      tintColor="transparent"
    />
  );
}

/**
 * The pull, and whether a pull is still being answered. Tracked here rather
 * than read off the query's `isRefetching`, which is also true for background
 * polls — the Drafts screen polls every few seconds, and a bar for each poll
 * would never go away.
 */
export function usePullRefresh(refetch: () => Promise<unknown>) {
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    refetch().finally(() => setRefreshing(false));
  }, [refetch]);
  return { refreshing, control: quietRefresh(refreshing, onRefresh) };
}

/**
 * A 4px gold-on-ink stripe sweeping across the top of the screen while
 * `active`. Overlays the content (place it last inside <Screen>), so nothing
 * shifts when it comes and goes.
 */
export function RefreshBar({ active }: { active: boolean }) {
  const { color } = useTokens();
  const [width, setWidth] = useState(0);
  const x = useSharedValue(0);

  useEffect(() => {
    if (!active || width === 0) return;
    x.value = 0;
    x.value = withRepeat(withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.quad) }), -1, false);
    return () => cancelAnimation(x);
  }, [active, width, x]);

  const segment = width * 0.35;
  const sweep = useAnimatedStyle(() => ({
    transform: [{ translateX: -segment + x.value * (width + segment) }],
  }));

  if (!active) return null;
  return (
    <View
      pointerEvents="none"
      accessibilityRole="progressbar"
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      className="absolute inset-x-0 top-0 h-1 overflow-hidden bg-line/40"
    >
      {/* Plain style, not className: an Animated view is not one NativeWind styles reliably. */}
      <Animated.View style={[{ width: segment, height: "100%", borderRadius: 2, backgroundColor: color.gold }, sweep]} />
    </View>
  );
}
