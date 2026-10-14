import { copy } from "@openrecipe/core/copy";
import { count, formatDate } from "@openrecipe/core/format";
import * as Haptics from "expo-haptics";
import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, Text, View } from "react-native";

import { useLogCooked, useUndoCooked } from "../../lib/hooks/recipe";
import { ArcadeButton } from "../ui/button";
import { Kielbas } from "../ui/kielbas";

/** How long the undo stays on offer; the web's UNDO_WINDOW_MS. */
const UNDO_WINDOW_MS = 8_000;

/**
 * "I made this". Optimistic: the count moves on the tap and rolls back on failure.
 * Open to every signed-in user, Members included; offline it fails and rolls back.
 */
export function CookLog({
  recipeId,
  times,
  lastCookedAt,
}: {
  recipeId: string;
  times: number;
  lastCookedAt: string | null;
}) {
  const [entry, setEntry] = useState<{ id: string; cookedAt: Date } | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [failed, setFailed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bounce = useRef(new Animated.Value(1)).current;
  const log = useLogCooked(recipeId);
  const undo = useUndoCooked();
  const pending = log.isPending || undo.isPending;

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const shownTimes = times + (entry ? 1 : 0);
  const shownLast = entry?.cookedAt ?? lastCookedAt;

  function onCooked() {
    setFailed(false);
    const optimistic = { id: "", cookedAt: new Date() };
    setEntry(optimistic);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    Animated.sequence([
      Animated.timing(bounce, { toValue: 1.15, duration: 120, useNativeDriver: true }),
      Animated.spring(bounce, { toValue: 1, useNativeDriver: true }),
    ]).start();
    log.mutate(undefined, {
      onSuccess: ({ entryId }) => {
        setEntry({ ...optimistic, id: entryId });
        setCanUndo(true);
        timer.current = setTimeout(() => setCanUndo(false), UNDO_WINDOW_MS);
      },
      onError: () => {
        setEntry(null);
        setCanUndo(false);
        setFailed(true);
      },
    });
  }

  function onUndo() {
    if (!entry?.id) return;
    undo.mutate(entry.id, {
      onSuccess: () => {
        // Only now: a failed undo keeps its window, so "Cofnij" still goes away.
        if (timer.current) clearTimeout(timer.current);
        setEntry(null);
        setCanUndo(false);
      },
      onError: () => setFailed(true),
    });
  }

  return (
    <View className="gap-3">
      <Animated.View style={{ transform: [{ scale: bounce }] }}>
        <ArcadeButton
          label={copy.recipe.cooked}
          tone="gold"
          onPress={onCooked}
          disabled={pending || entry !== null}
        />
      </Animated.View>

      {shownTimes > 0 && (
        <Text className="text-sm text-muted">
          <Text className="font-bold">{count(shownTimes, copy.units.times)}</Text>
          {shownLast ? ` · ${formatDate(shownLast)}` : ""}
        </Text>
      )}

      {canUndo && (
        <View className="flex-row items-center gap-3">
          <Kielbas talking size={56} />
          <Text className="flex-1 text-sm text-text">
            {copy.recipe.cookedConfirmed}{" "}
            <Text onPress={onUndo} disabled={pending} className="font-bold text-accent underline">
              {copy.common.undo}
            </Text>
          </Text>
        </View>
      )}

      {failed && (
        <Text accessibilityRole="alert" className="text-sm text-accent2">
          {copy.common.somethingFailed}
        </Text>
      )}
    </View>
  );
}
