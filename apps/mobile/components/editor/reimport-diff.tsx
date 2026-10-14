import { copy } from "@openrecipe/core/copy";
import { diffRecipes, isTaken, lineText, patchFor } from "@openrecipe/core/import/diff";
import type { RecipeFormValue } from "@openrecipe/core/recipe-schema";
import { Pressable, Text, View } from "react-native";

import { Card } from "../ui/card";

/**
 * The re-import diff: the editor starts from what the Recipe says today and each
 * difference is something you can pull in. Doing nothing keeps what you had.
 */
export function ReimportDiff({
  current,
  incoming,
  value,
  apply,
}: {
  current: RecipeFormValue;
  incoming: RecipeFormValue;
  value: RecipeFormValue;
  apply: (patch: Partial<RecipeFormValue>) => void;
}) {
  const differences = diffRecipes(current, incoming);
  if (differences.length === 0) return <Text className="text-sm text-muted">{copy.imports.noChanges}</Text>;

  return (
    <Card className="gap-2 p-3">
      <Text className="text-sm text-text">{copy.imports.diffHint}</Text>
      {differences.map((d) => {
        const taken = isTaken(d, value, incoming);
        return (
          <View key={d.field} className="gap-1 border-t-2 border-line/20 pt-2">
            <Text className="font-bold text-sm uppercase text-text">{copy.imports.diffFields[d.field]}</Text>
            <Text className="text-sm text-muted line-through">{d.current}</Text>
            <Text className="text-sm text-text">{d.incoming}</Text>
            {d.field === "ingredientLines" && (
              <Text className="text-sm text-muted">{incoming.ingredientLines.map(lineText).join(" · ")}</Text>
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: taken }}
              disabled={taken}
              onPress={() => apply(patchFor(d.field, incoming))}
              className={`min-h-11 items-center justify-center self-start rounded-input border-2 px-3 ${
                taken ? "border-accent" : "border-line bg-surface"
              }`}
            >
              <Text className={`font-bold text-sm ${taken ? "text-accent" : "text-text"}`}>
                {taken ? copy.imports.diffTaken : copy.imports.diffApply}
              </Text>
            </Pressable>
          </View>
        );
      })}
    </Card>
  );
}
