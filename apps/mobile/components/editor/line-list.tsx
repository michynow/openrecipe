import { copy } from "@openrecipe/core/copy";
import { useContext } from "react";
import { View } from "react-native";

import { ArcadeButton } from "../ui/button";
import { ErrorText, FieldRegistry, Input, RowButton } from "./fields";
import { move } from "./move";

/** Steps and tips: a list of short lines, reordered with ↑ ↓ (no drag, see the spec). */
export function LineList({
  id,
  label,
  values,
  onChange,
  addLabel,
  placeholder,
  error,
  onBlur,
}: {
  id: string;
  label: string;
  values: string[];
  onChange: (next: string[]) => void;
  addLabel: string;
  placeholder: string;
  error?: string;
  onBlur: () => void;
}) {
  const reg = useContext(FieldRegistry);
  return (
    <View ref={reg(id)} className="gap-3">
      {values.map((line, i) => (
        <View key={i} className="gap-1.5">
          <Input
            multiline
            accessibilityLabel={`${label} ${i + 1}`}
            value={line}
            placeholder={placeholder}
            onChangeText={(t) => onChange(values.map((v, j) => (j === i ? t : v)))}
            onBlur={onBlur}
            invalid={!!error && line.trim() === ""}
          />
          <View className="flex-row justify-end gap-2">
            <RowButton glyph="↑" label={`${copy.editor.moveUp}: ${label} ${i + 1}`} disabled={i === 0} onPress={() => onChange(move(values, i, i - 1))} />
            <RowButton
              glyph="↓"
              label={`${copy.editor.moveDown}: ${label} ${i + 1}`}
              disabled={i === values.length - 1}
              onPress={() => onChange(move(values, i, i + 1))}
            />
            <RowButton
              glyph="✕"
              destructive
              label={`${copy.common.delete}: ${label} ${i + 1}`}
              onPress={() => onChange(values.filter((_, j) => j !== i))}
            />
          </View>
        </View>
      ))}
      <ErrorText>{error}</ErrorText>
      <ArcadeButton tone="surface" label={addLabel} onPress={() => onChange([...values, ""])} />
    </View>
  );
}
