import { copy } from "@openrecipe/core/copy";
import type { IconName } from "@openrecipe/core/icons";
import { createContext, useContext, type ReactNode } from "react";
import { Pressable, Text, TextInput, View, type TextInputProps } from "react-native";

import { showDialog } from "../ui/dialog";
import { Icon } from "../ui/pixel";
import { Card } from "../ui/card";
import { useTokens } from "../../lib/theme";

/** Lets the editor find a field's view by its error key, to scroll to it. */
export const FieldRegistry = createContext<(key: string) => (node: View | null) => void>(() => () => {});

/** "The Worker guessed this": a tap explains why (mirrors the web's GuessedChip). */
export function GuessedChip() {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${copy.imports.guessed}. ${copy.imports.guessedHint}`}
      onPress={() => showDialog(copy.imports.guessed, copy.imports.guessedHint)}
      className="min-h-8 flex-row items-center gap-1 self-start rounded-full border-2 border-accent bg-surface px-2"
    >
      <Text className="font-bold text-xs uppercase text-accent">? {copy.imports.guessed}</Text>
    </Pressable>
  );
}

export function Section({
  icon,
  label,
  trailing,
  children,
}: {
  icon: IconName;
  label: string;
  trailing?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card className="gap-3 p-4">
      <View className="flex-row items-center gap-2">
        <Icon name={icon} size={20} tone="accent" />
        <Text accessibilityRole="header" className="flex-1 font-display text-lg uppercase text-text">
          {label}
        </Text>
        {trailing}
      </View>
      {children}
    </Card>
  );
}

export function ErrorText({ children }: { children?: string }) {
  if (!children) return null;
  return (
    <Text accessibilityRole="alert" className="font-bold text-sm text-accent2">
      {children}
    </Text>
  );
}

export function Input(props: TextInputProps & { invalid?: boolean }) {
  const { color } = useTokens();
  const { invalid, className, ...rest } = props;
  return (
    <TextInput
      placeholderTextColor={color.muted}
      className={`min-h-11 rounded-input border-2 bg-surface px-3 py-2 font-body text-base text-text ${
        invalid ? "border-accent2" : "border-line"
      } ${className ?? ""}`}
      {...rest}
    />
  );
}

/** A labelled single input with its error underneath. `id` is the error key. */
export function Field({
  id,
  label,
  hint,
  error,
  guessed,
  ...input
}: TextInputProps & { id: string; label: string; hint?: string; error?: string; guessed?: boolean }) {
  const reg = useContext(FieldRegistry);
  return (
    <View ref={reg(id)} className="gap-1.5">
      <View className="flex-row flex-wrap items-center gap-2">
        <Text className="font-bold text-sm uppercase text-text">
          {label}
          {hint ? <Text className="font-body normal-case text-muted"> {hint}</Text> : null}
        </Text>
        {guessed ? <GuessedChip /> : null}
      </View>
      <Input accessibilityLabel={label} invalid={!!error} {...input} />
      <ErrorText>{error}</ErrorText>
    </View>
  );
}

/** ↑ ↓ ✕ and friends: a 44pt hit area with the glyph or icon inside. */
export function RowButton({
  label,
  onPress,
  disabled,
  destructive,
  glyph,
  icon,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  destructive?: boolean;
  glyph?: string;
  icon?: IconName;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      className={`size-11 items-center justify-center rounded-input border-2 border-line bg-surface ${
        disabled ? "opacity-30" : ""
      }`}
    >
      {icon ? (
        <Icon name={icon} size={18} tone="text" />
      ) : (
        <Text className={`font-display text-lg ${destructive ? "text-accent2" : "text-text"}`}>{glyph}</Text>
      )}
    </Pressable>
  );
}
