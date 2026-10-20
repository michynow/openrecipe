import { copy } from "@openrecipe/core/copy";
import { useSyncExternalStore } from "react";
import { Modal, Pressable, Text, View } from "react-native";

import { ArcadeButton } from "./button";

/**
 * A themed dialog in place of the system's Alert.alert: same call shape, so a
 * call site swaps `Alert.alert(` for `showDialog(` and nothing else. The OS
 * alert is a grey Material box in the middle of an arcade cabinet.
 *
 * `cancel` is the outlined button and what Back or a tap outside does;
 * `destructive` is tomato; anything else is gold.
 */
export type DialogButton = {
  text: string;
  style?: "default" | "cancel" | "destructive";
  onPress?: () => void;
};
type Dialog = { id: number; title: string; message?: string; buttons: DialogButton[] };

/** Module-level store, like the toasts: a dialog can be raised from a mutation's callback. One at a time; the rest queue. */
let queue: Dialog[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function showDialog(title: string, message?: string, buttons?: DialogButton[]): void {
  const list = buttons?.length ? buttons : [{ text: copy.common.ok }];
  queue = [...queue, { id: nextId++, title, message, buttons: list }];
  emit();
}

function close(id: number) {
  queue = queue.filter((d) => d.id !== id);
  emit();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};
const snapshot = () => queue;

const TONE = { cancel: "surface", destructive: "accent", default: "gold" } as const;

/** Mount once in the root layout. */
export function DialogHost() {
  const current = useSyncExternalStore(subscribe, snapshot)[0];
  if (!current) return null;

  // Closed before the handler runs, so a handler that raises the next dialog
  // (a failure after a confirm) is not closed along with this one.
  const press = (button?: DialogButton) => {
    close(current.id);
    button?.onPress?.();
  };
  // Back and the backdrop mean "cancel" when there is one; a lone OK is also safe to dismiss.
  const cancel = current.buttons.find((b) => b.style === "cancel") ?? (current.buttons.length === 1 ? current.buttons[0] : undefined);
  const dismiss = () => (cancel ? press(cancel) : undefined);

  return (
    <Modal transparent visible animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={dismiss}>
      <View className="flex-1 items-center justify-center px-6">
        <Pressable
          accessibilityLabel={cancel?.text ?? copy.common.close}
          onPress={dismiss}
          className="absolute inset-0 bg-ink/60"
        />
        <View accessibilityViewIsModal accessibilityRole="alert" className="w-full max-w-md pb-[5px] pr-[5px]">
          <View className="absolute inset-0 left-[5px] top-[5px] rounded-card bg-line" />
          <View className="gap-4 rounded-card border-[3px] border-line bg-surface p-5">
            <Text className="font-display text-xl uppercase leading-tight text-text">{current.title}</Text>
            {current.message ? <Text className="font-body text-base leading-snug text-text">{current.message}</Text> : null}
            <View className="flex-row flex-wrap justify-end gap-3">
              {current.buttons.map((button) => (
                <ArcadeButton
                  key={button.text}
                  label={button.text}
                  tone={TONE[button.style ?? "default"]}
                  onPress={() => press(button)}
                />
              ))}
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}
