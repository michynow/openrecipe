import { copy } from "@openrecipe/core/copy";
import type { FieldErrors } from "@openrecipe/core/form-errors";
import type { RecipeFormValue } from "@openrecipe/core/recipe-schema";
import {
  addSection,
  groupSections,
  hasSections,
  moveLine,
  normalizeSections,
  removeSection,
  renameSection,
  sectionNames,
  setLineSection,
} from "@openrecipe/core/sections";
import { useContext, useEffect, useRef, useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";

import { ArcadeButton } from "../ui/button";
import { IngredientSprite } from "../ui/pixel";
import { ErrorText, FieldRegistry, Input, RowButton } from "./fields";

type Line = RecipeFormValue["ingredientLines"][number];

const blank: Line = { quantity: null, unit: null, item: "", note: null, section: null, substitutes: [] };

/** Quantity as the user typed it ("1,5", "1."): parsed on every keystroke, shown as typed. */
const parseQuantity = (text: string): number | null => (text.trim() === "" ? null : Number(text.replace(",", ".")));

function Row({
  line,
  index,
  last,
  errors,
  onChange,
  onMove,
  onSection,
  onRemove,
}: {
  line: Line;
  index: number;
  last: boolean;
  errors: FieldErrors;
  onChange: (patch: Partial<Line>) => void;
  onMove: (to: number) => void;
  onSection: () => void;
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
        <RowButton glyph="§" label={`${copy.editor.moveToSection}: ${copy.editor.item} ${n}`} onPress={onSection} />
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

/** A Section's heading: rename on blur/submit (an existing name merges, empty ungroups), remove, add a line to it. */
function SectionHeading({
  name,
  onRename,
  onRemove,
  onAdd,
}: {
  name: string;
  onRename: (next: string) => void;
  onRemove: () => void;
  onAdd: () => void;
}) {
  const [text, setText] = useState(name);
  useEffect(() => setText(name), [name]);
  const commit = () => text !== name && onRename(text);
  return (
    <View className="gap-2 rounded-input border-2 border-line bg-fill p-2">
      <Input
        accessibilityLabel={copy.editor.sectionName}
        value={text}
        placeholder={copy.editor.sectionPlaceholder}
        onChangeText={setText}
        onBlur={commit}
        onSubmitEditing={commit}
        returnKeyType="done"
      />
      <View className="flex-row gap-2">
        <View className="flex-1">
          <ArcadeButton tone="surface" label={copy.editor.addIngredient} onPress={onAdd} />
        </View>
        <View className="flex-1">
          <ArcadeButton
            tone="surface"
            label={copy.editor.removeSection}
            accessibilityLabel={`${copy.editor.removeSection}. ${copy.editor.removeSectionHint}`}
            onPress={onRemove}
          />
        </View>
      </View>
    </View>
  );
}

/** Pick a Section for one line: "Bez części", then the existing ones. */
function SectionPicker({
  open,
  names,
  onPick,
  onClose,
}: {
  open: boolean;
  names: string[];
  onPick: (section: string | null) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 bg-ink/60" onPress={onClose} accessibilityLabel={copy.common.close} />
      <View className="gap-3 rounded-t-3xl border-t-4 border-ink bg-surface p-5">
        <Text className="font-display text-2xl uppercase text-text">{copy.editor.moveToSection}</Text>
        {[null, ...names].map((name) => (
          <ArcadeButton key={name ?? ""} tone="surface" label={name ?? copy.editor.noSection} onPress={() => onPick(name)} />
        ))}
        <ArcadeButton label={copy.common.close} onPress={onClose} />
      </View>
    </Modal>
  );
}

/** Ingredient Lines, grouped by Section. Substitutes ride along untouched through `...line`. */
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
  const [picking, setPicking] = useState<number | null>(null);
  const [newSection, setNewSection] = useState("");
  const groups = groupSections(values);

  /**
   * Every change is a function of the latest lines, not of this render's
   * `values`. A heading rename commits on blur, and the tap that caused the blur
   * (add, remove) fires in the same frame, before a re-render — reading `values`
   * there would drop the rename.
   */
  const latest = useRef(values);
  latest.current = values;
  const update = (fn: (lines: Line[]) => Line[]) => {
    latest.current = fn(latest.current);
    onChange(latest.current);
  };

  const confirmSection = () => {
    if (!newSection.trim()) return;
    update((lines) => addSection(lines, newSection, blank));
    setNewSection("");
  };
  return (
    <View ref={reg("ingredientLines")} className="gap-3">
      {groups.map((group, gi) => (
        <View key={gi} className="gap-3">
          {group.section !== null && (
            <SectionHeading
              name={group.section}
              onRename={(next) => update((lines) => renameSection(lines, group.section!, next))}
              onRemove={() => update((lines) => removeSection(lines, group.section!))}
              onAdd={() => update((lines) => addSection(lines, group.section!, blank))}
            />
          )}
          {group.items.map(({ line, index: i }) => (
            <Row
              key={i}
              line={line}
              index={i}
              last={i === values.length - 1}
              errors={errors}
              onChange={(patch) => update((lines) => lines.map((l, j) => (j === i ? { ...l, ...patch } : l)))}
              onMove={(to) => update((lines) => moveLine(lines, i, to))}
              onSection={() => setPicking(i)}
              onRemove={() => update((lines) => lines.filter((_, j) => j !== i))}
            />
          ))}
        </View>
      ))}
      <ErrorText>{errors.ingredientLines}</ErrorText>
      <ArcadeButton tone="surface" label={copy.editor.addIngredient} onPress={() => update((lines) => normalizeSections([...lines, { ...blank }]))} />
      <View className="gap-2">
        <Input
          accessibilityLabel={copy.editor.sectionName}
          value={newSection}
          placeholder={copy.editor.sectionPlaceholder}
          onChangeText={setNewSection}
          onSubmitEditing={confirmSection}
          returnKeyType="done"
        />
        <ArcadeButton tone="surface" label={copy.editor.addSection} onPress={confirmSection} />
        {!hasSections(values) && <Text className="text-sm text-muted">{copy.editor.sectionsHint}</Text>}
      </View>
      <SectionPicker
        open={picking !== null}
        names={sectionNames(values)}
        onPick={(section) => {
          if (picking !== null) update((lines) => setLineSection(lines, picking, section));
          setPicking(null);
        }}
        onClose={() => setPicking(null)}
      />
    </View>
  );
}
