import type { RecipeDetail } from "@openrecipe/core/api";
import { copy } from "@openrecipe/core/copy";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";

import { ArcadeButton } from "../ui/button";
import { Icon, IngredientSprite } from "../ui/pixel";

export type Line = RecipeDetail["ingredientLines"][number];

/** The stored Substitutes for one line: what you lack -> what works. Nothing is fetched. */
export function SubstitutesSheet({
  line,
  measure,
  onClose,
}: {
  line: Line | null;
  /** Quantity and unit at the current scale, e.g. "350 g". */
  measure: string;
  onClose: () => void;
}) {
  return (
    <Modal
      visible={line !== null}
      transparent
      animationType="slide"
      onRequestClose={onClose} // Android back
    >
      <Pressable className="flex-1 bg-ink/60" onPress={onClose} accessibilityLabel={copy.common.close} />
      {line && (
        <View className="max-h-[80%] gap-4 rounded-t-3xl border-t-4 border-ink bg-surface p-5">
          <Text className="font-display text-2xl uppercase text-text">{copy.recipe.substitutes}</Text>
          <ScrollView contentContainerClassName="gap-3">
            <Text className="text-sm font-extrabold uppercase text-muted">{copy.recipe.insteadOf}</Text>
            <Row item={line.item} title={`${measure} ${line.item}`.trim()} tone="fill" />
            <View className="items-center">
              <Icon name="swap" size={28} tone="accent" />
            </View>
            <Text className="text-sm font-extrabold uppercase text-muted">{copy.recipe.youCanUse}</Text>
            {line.substitutes.length === 0 ? (
              <Text className="text-base text-muted">{copy.recipe.noSubstitutes}</Text>
            ) : (
              line.substitutes.map((s, i) => (
                <View key={s.item} className="gap-2">
                  {i > 0 && (
                    <Text className="self-center text-sm font-extrabold uppercase text-muted">
                      {copy.recipe.or}
                    </Text>
                  )}
                  <Row item={s.item} title={s.item} note={s.note} tone="surface" />
                </View>
              ))
            )}
          </ScrollView>
          <ArcadeButton label={copy.common.close} onPress={onClose} tone="surface" />
        </View>
      )}
    </Modal>
  );
}

function Row({ item, title, note, tone }: { item: string; title: string; note?: string | null; tone: "fill" | "surface" }) {
  return (
    <View
      className={`flex-row items-start gap-3 rounded-xl border-2 border-ink p-3 ${tone === "fill" ? "bg-fill" : "bg-surface"}`}
    >
      <IngredientSprite item={item} size={40} />
      <View className="flex-1">
        <Text className="text-lg font-extrabold text-text">{title}</Text>
        {note ? <Text className="text-base text-muted">{note}</Text> : null}
      </View>
    </View>
  );
}
