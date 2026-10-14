import { copy } from "@openrecipe/core/copy";
import type { HelpTopic } from "@openrecipe/core/help";
import { useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";

import { DialogueBox } from "./kielbas";

/** The "?" in a header: opens MC Kiełbas, pinned to the bottom of the screen, with this screen's lines. */
export function HelpButton({ topic }: { topic: HelpTopic }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={copy.help.open}
        onPress={() => setOpen(true)}
        className="size-11 items-center justify-center rounded-full border-2 border-ink bg-gold"
      >
        <Text className="font-display text-xl text-ink">?</Text>
      </Pressable>
      <Modal transparent animationType="fade" visible={open} onRequestClose={() => setOpen(false)}>
        <Pressable accessibilityLabel={copy.help.close} onPress={() => setOpen(false)} className="flex-1 justify-end bg-line/50">
          <View className="px-4 pb-6">
            {/* Remounts per open, so it always starts at line one. */}
            <DialogueBox lines={[...copy.help.pages[topic]]} onDone={() => setOpen(false)} />
          </View>
        </Pressable>
      </Modal>
    </>
  );
}
