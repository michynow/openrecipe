import { copy } from "@openrecipe/core/copy";
import type { FieldErrors } from "@openrecipe/core/form-errors";
import type { RecipeFormValue } from "@openrecipe/core/recipe-schema";
import { useContext, useEffect, useState } from "react";
import { Text, View } from "react-native";

import { ArcadeButton } from "../ui/button";
import { IngredientSprite } from "../ui/pixel";
import { ErrorText, FieldRegistry, Input, RowButton } from "./fields";
import { move } from "./move";

type Line = RecipeFormValue["ingredientLines"][number];

const blank: Line = { quantity: null, unit: null, item: "", note: null, substitutes: [] };

/** Quantity as the user typed it ("1,5", "1."): parsed on every keystroke, shown as typed. */
const parseQuantity = (text: string): number | null => (text.trim() === "" ? null : Number(text.replace(",", ".")));

function Row({
  line,
  index,
  last,
  errors,
  onChange,
  onMove,
  onRemove,
}: {
  line: Line;
  index: number;
  last: boolean;
  errors: FieldErrors;
  onChange: (patch: Partial<Line>) => void;
  onMove: (to: number) => void;
  onRemove: () => void;
}) {
  const reg = useContext(FieldRegistry);
  const [qty, setQty] = useState(line.quantity === null ? "" : String(line.quantity));
  // A move or an applied re-import diff changes the value from outside: follow it.
  useEffect(() => {
    if (parseQuantity(qty) !== line.quantity) setQty(line.quantity === null ? "" : String(line.quantity));
  }, [line.quantity]); // eslint-disable-line react-hooks/exhaustive-deps

  const itemKey = `ingredientLines.${index}.item`;
  const qtyKey = `ingredientLines.${index}.quantity`;
  const n = index + 1;
  return (
    <View ref={reg(itemKey)} className={`gap-2 ${index > 0 ? "border-t-2 border-line/20 pt-3" : ""}`}>
      <View className="flex-row items-center gap-2">
        <IngredientSprite item={line.item} size={32} />
        <Text className="flex-1 font-bold text-sm text-muted" numberOfLines={1}>
          {n}. {line.item}
        </Text>
        <RowButton glyph="↑" label={`${copy.editor.moveUp}: ${copy.editor.item} ${n}`} disabled={index === 0} onPress={() => onMove(index - 1)} />
        <RowButton glyph="↓" label={`${copy.editor.moveDown}: ${copy.editor.item} ${n}`} disabled={last} onPress={() => onMove(index + 1)} />
        <RowButton
          glyph="✕"
          destructive
          label={`${copy.common.delete}: ${line.item || n}`}
          onPress={onRemove}
        />
      </View>
      <View className="flex-row gap-2">
        <View className="w-24" ref={reg(qtyKey)}>
          <Input
            accessibilityLabel={`${copy.editor.quantity} ${n}`}
            keyboardType="decimal-pad"
            value={qty}
            placeholder={copy.editor.quantityPlaceholder}
            invalid={!!errors[qtyKey]}
            onChangeText={(t) => {
              setQty(t);
              onChange({ quantity: parseQuantity(t) });
            }}
          />
        </View>
        <View className="flex-1">
          <Input
            accessibilityLabel={`${copy.editor.unit} ${n}`}
            value={line.unit ?? ""}
            placeholder={copy.editor.unitPlaceholder}
            onChangeText={(t) => onChange({ unit: t || null })}
          />
        </View>
      </View>
      <Input
        accessibilityLabel={`${copy.editor.item} ${n}`}
        value={line.item}
        placeholder={copy.editor.itemPlaceholder}
        invalid={!!errors[itemKey]}
        onChangeText={(t) => onChange({ item: t })}
      />
      <Input
        accessibilityLabel={`${copy.editor.note} ${n}`}
        value={line.note ?? ""}
        placeholder={copy.editor.notePlaceholder}
        onChangeText={(t) => onChange({ note: t || null })}
      />
      <ErrorText>{errors[itemKey] ?? errors[qtyKey]}</ErrorText>
    </View>
  );
}

/** Ingredient Lines. Substitutes ride along untouched through `...line`. */
export function IngredientLines({
  values,
  onChange,
  errors,
}: {
  values: Line[];
  onChange: (next: Line[]) => void;
  errors: FieldErrors;
}) {
  const reg = useContext(FieldRegistry);
  return (
    <View ref={reg("ingredientLines")} className="gap-3">
      {values.map((line, i) => (
        <Row
          key={i}
          line={line}
          index={i}
          last={i === values.length - 1}
          errors={errors}
          onChange={(patch) => onChange(values.map((l, j) => (j === i ? { ...l, ...patch } : l)))}
          onMove={(to) => onChange(move(values, i, to))}
          onRemove={() => onChange(values.filter((_, j) => j !== i))}
        />
      ))}
      <ErrorText>{errors.ingredientLines}</ErrorText>
      <ArcadeButton tone="surface" label={copy.editor.addIngredient} onPress={() => onChange([...values, { ...blank }])} />
    </View>
  );
}
