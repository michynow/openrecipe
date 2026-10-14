import type { RecipeDetail } from "@openrecipe/core/api";
import { copy } from "@openrecipe/core/copy";
import { count } from "@openrecipe/core/format";
import { formatScaledQuantity } from "@openrecipe/core/quantity";
import { buildShoppingExport } from "@openrecipe/core/shopping-export";
import * as Haptics from "expo-haptics";
import { useState } from "react";
import { Pressable, Share, Text, View } from "react-native";

import { usePantry } from "../../lib/pantry";
import { useTokens } from "../../lib/theme";
import { ArcadeButton } from "../ui/button";
import { Card } from "../ui/card";
import { Icon, IngredientSprite } from "../ui/pixel";
import { SubstitutesSheet } from "./substitutes-sheet";

/**
 * Servings stepper, Pantry Check, Shopping Export and Substitutes. All display
 * state: the Recipe is never rewritten, and the ticks stay on this phone (ADR-0004).
 */
export function CookingPanel({ recipe }: { recipe: RecipeDetail }) {
  const { px } = useTokens();
  const [servings, setServings] = useState(recipe.servings);
  const [openLineId, setOpenLineId] = useState<string | null>(null);
  const lines = recipe.ingredientLines;
  const { checked, toggle } = usePantry(recipe.id, lines.map((l) => l.id));
  const factor = servings / recipe.servings;

  const measureOf = (line: (typeof lines)[number]) =>
    [formatScaledQuantity(line.quantity, factor), line.unit].filter(Boolean).join(" ");
  const openLine = lines.find((l) => l.id === openLineId) ?? null;

  return (
    <Card className="gap-3 p-3">
      <Text className="font-display text-xl uppercase text-text">{copy.recipe.ingredients}</Text>

      <View className="flex-row items-center gap-2">
        <Text className="text-sm text-muted">{copy.recipe.servings}</Text>
        <Stepper label={copy.recipe.fewerServings} glyph="−" disabled={servings <= 1} onPress={() => setServings((n) => Math.max(1, n - 1))} />
        <Text accessibilityLiveRegion="polite" className="min-w-24 text-center font-bold text-text">
          {count(servings, copy.units.servings)}
        </Text>
        <Stepper label={copy.recipe.moreServings} glyph="+" disabled={servings >= 99} onPress={() => setServings((n) => Math.min(99, n + 1))} />
      </View>

      <Text className="text-sm text-muted">
        {copy.recipe.pantryCheck} {checked.length > 0 && `(${checked.length}/${lines.length})`}
      </Text>
      <View>
        {lines.map((line, i) => {
          const isChecked = checked.includes(line.id);
          const measure = measureOf(line);
          return (
            <View key={line.id} className={`flex-row items-center gap-2 ${i > 0 ? "border-t-2 border-line/10" : ""}`}>
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isChecked }}
                accessibilityLabel={`${measure} ${line.item}`.trim()}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  toggle(line.id);
                }}
                className={`min-h-12 flex-1 flex-row items-center gap-2 ${isChecked ? "opacity-50" : ""}`}
              >
                <View style={{ backgroundColor: px.w }} className="size-10 items-center justify-center rounded-lg border-2 border-ink">
                  <IngredientSprite item={line.item} size={30} />
                </View>
                <Text className={`flex-1 text-base text-text ${isChecked ? "line-through" : ""}`}>
                  {measure ? <Text className="font-bold">{measure} </Text> : null}
                  <Text className="font-bold">{line.item}</Text>
                  {line.note ? <Text className="text-muted"> ({line.note})</Text> : null}
                </Text>
              </Pressable>
              {line.substitutes.length > 0 && (
                <Pressable
                  onPress={() => setOpenLineId(line.id)}
                  accessibilityLabel={`${copy.recipe.substitutes}: ${line.item}`}
                  className="min-h-10 flex-row items-center gap-1 rounded-lg border-2 border-ink px-2"
                >
                  <Icon name="swap" size={20} tone="accent" />
                  <Text className="font-bold text-accent2">{line.substitutes.length}</Text>
                </Pressable>
              )}
            </View>
          );
        })}
      </View>

      <ArcadeButton
        label={copy.recipe.export}
        tone="accent"
        onPress={() =>
          Share.share({
            message: buildShoppingExport({ title: recipe.title, servings, factor, lines, checked }),
          }).catch(() => {})
        }
      />

      <SubstitutesSheet
        line={openLine}
        measure={openLine ? measureOf(openLine) : ""}
        onClose={() => setOpenLineId(null)}
      />
    </Card>
  );
}

function Stepper({ label, glyph, disabled, onPress }: { label: string; glyph: string; disabled: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      className={`size-11 items-center justify-center rounded-xl border-2 border-ink bg-surface active:bg-fill ${disabled ? "opacity-30" : ""}`}
    >
      <Text className="text-xl font-bold text-text">{glyph}</Text>
    </Pressable>
  );
}
