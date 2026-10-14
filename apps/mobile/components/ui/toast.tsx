import { copy } from "@openrecipe/core/copy";
import { useEffect, useSyncExternalStore } from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Kielbas } from "./kielbas";

export type ToastInput = {
  message: string;
  action?: { label: string; onPress: () => void };
  /** MC Kiełbas delivers it (default). */
  kielbas?: boolean;
  durationMs?: number;
};
type Toast = ToastInput & { id: number };

const DEFAULT_MS = 6000;
const ACTION_MS = 8000; // the web's undo window

/** Module-level store, so a toast can be raised outside React (after a mutation). One at a time; the rest queue. */
let queue: Toast[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function showToast(t: ToastInput): void {
  queue = [...queue, { ...t, id: nextId++ }];
  emit();
}

function dismiss(id: number) {
  queue = queue.filter((t) => t.id !== id);
  emit();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};
const snapshot = () => queue;

/** Mount once in the root layout. */
export function ToastHost() {
  const current = useSyncExternalStore(subscribe, snapshot)[0];
  const insets = useSafeAreaInsets();

  const id = current?.id;
  const ms = current?.durationMs ?? (current?.action ? ACTION_MS : DEFAULT_MS);
  useEffect(() => {
    if (id === undefined) return;
    const timer = setTimeout(() => dismiss(id), ms);
    return () => clearTimeout(timer);
  }, [id, ms]);

  if (!current) return null;
  const talking = current.kielbas !== false;

  return (
    <View
      pointerEvents="box-none"
      style={{ bottom: insets.bottom + 72 }}
      className="absolute inset-x-4"
    >
      <View
        accessibilityLiveRegion="polite"
        accessibilityRole="alert"
        className="mb-[5px] mr-[5px] mt-3"
      >
        <View className="absolute inset-0 left-[5px] top-[5px] rounded-card bg-line" />
        <View className="flex-row gap-3 rounded-card border-[3px] border-line bg-surface p-3 pt-5">
          {talking ? (
            <View className="absolute -top-3.5 left-4 rounded-input border-2 border-line bg-gold px-2 py-0.5">
              <Text className="font-display text-sm uppercase text-ink">{copy.help.name}</Text>
            </View>
          ) : null}
          {talking ? (
            <View className="h-14 w-14 items-center justify-center overflow-hidden rounded-input border-2 border-line bg-fill">
              <Kielbas talking size={52} />
            </View>
          ) : null}
          <View className="min-w-0 flex-1 items-start gap-2">
            <Text className="font-body text-sm leading-snug text-text">{current.message}</Text>
            {current.action ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  dismiss(current.id);
                  current.action?.onPress();
                }}
                className="min-h-11 justify-center rounded-input border-2 border-line bg-accent px-3"
              >
                <Text className="font-display text-sm uppercase text-accent-ink">{current.action.label}</Text>
              </Pressable>
            ) : null}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={copy.imports.toastDismiss}
            onPress={() => dismiss(current.id)}
            className="-mr-1 -mt-2 h-11 w-11 items-center justify-center"
          >
            <Text className="font-bold text-lg text-muted">✕</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
