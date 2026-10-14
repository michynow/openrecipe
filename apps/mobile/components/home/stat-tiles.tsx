import { copy } from "@openrecipe/core/copy";
import type { DashboardStats } from "@openrecipe/core/api";
import { count, formatNumber } from "@openrecipe/core/format";
import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";

/** The scoreboard. A tile only renders when it has something to say. */
export function StatTiles({ stats }: { stats: DashboardStats }) {
  const router = useRouter();
  if (stats.total === 0) return null;
  const open = (slug: string) => () => router.push({ pathname: "/recipe/[slug]", params: { slug } });

  return (
    <View className="flex-row flex-wrap gap-3">
      <Tile label={copy.dashboard.total} value={formatNumber(stats.total)} />
      {stats.addedThisWeek > 0 && (
        <Tile label={copy.dashboard.addedThisWeek} value={formatNumber(stats.addedThisWeek)} />
      )}
      {stats.cookedThisWeek > 0 && (
        <Tile label={copy.dashboard.cookedThisWeek} value={formatNumber(stats.cookedThisWeek)} />
      )}
      {stats.draftsWaiting > 0 && (
        <Tile label={copy.dashboard.draftsWaiting} value={formatNumber(stats.draftsWaiting)} accent />
      )}
      {stats.mostCooked && (
        <Tile
          wide
          label={copy.dashboard.mostCooked}
          value={stats.mostCooked.title}
          detail={count(stats.mostCooked.times, copy.units.times)}
          onPress={open(stats.mostCooked.slug)}
        />
      )}
      {stats.neglected && (
        <Tile
          wide
          label={copy.dashboard.neglected}
          value={stats.neglected.title}
          detail={
            stats.neglected.days === null
              ? copy.dashboard.neverCooked
              : `${count(stats.neglected.days, copy.units.days)} ${copy.dashboard.ago}`
          }
          onPress={open(stats.neglected.slug)}
        />
      )}
    </View>
  );
}

function Tile({
  label,
  value,
  detail,
  accent,
  wide,
  onPress,
}: {
  label: string;
  value: string;
  detail?: string;
  accent?: boolean;
  wide?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      disabled={!onPress}
      onPress={onPress}
      accessibilityRole={onPress ? "link" : "text"}
      className={`rounded-card border-[3px] border-line bg-surface p-3 ${wide ? "w-full" : "w-[48%] grow"}`}
    >
      <Text className="font-bold text-xs uppercase text-text">{label}</Text>
      <Text numberOfLines={2} className={`font-display text-2xl uppercase leading-tight ${accent ? "text-accent" : "text-text"}`}>
        {value}
      </Text>
      {detail ? <Text className="font-body text-sm text-muted">{detail}</Text> : null}
    </Pressable>
  );
}
