import { copy } from "@openrecipe/core/copy";
import { sourceUrlSchema } from "@openrecipe/core/drafts";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import { useParkUrl } from "../../lib/hooks/drafts";
import { ArcadeButton } from "../ui/button";

/**
 * Park a link for the Worker: one field, one button. Below it, folded away, the
 * recipe's own text for when there is no link that reads (an Instagram caption).
 * `prefill` (with a changing `nonce`) is a link shared from another app; it
 * fills the field, parking stays a deliberate tap.
 *
 * `onParked` is for the Add screen: there is no queue below to watch, so a
 * newly parked link moves on (to Drafts) instead of saying "see below".
 */
export function ParkForm({
  prefill,
  nonce,
  intro = copy.imports.parkIntro,
  onParked,
}: {
  prefill?: string;
  nonce?: string;
  intro?: string;
  onParked?: () => void;
}) {
  const router = useRouter();
  const park = useParkUrl();
  const [url, setUrl] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [existingSlug, setExistingSlug] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pasting, setPasting] = useState(false);
  const [text, setText] = useState("");

  useEffect(() => {
    if (!prefill) return;
    setUrl(prefill);
    setNote(null);
    setExistingSlug(null);
    setError(null);
  }, [prefill, nonce]);

  function submit() {
    if (park.isPending) return;
    setNote(null);
    setExistingSlug(null);
    const checked = sourceUrlSchema.safeParse(url);
    if (!checked.success) return setError(checked.error.issues[0]?.message ?? copy.validation.urlInvalid);
    setError(null);
    park.mutate({ sourceUrl: checked.data }, {
      onSuccess: (result) => {
        if (!result.ok) return setError(result.error);
        if ("existingSlug" in result) {
          setNote(copy.imports.alreadyImported);
          setExistingSlug(result.existingSlug);
        } else if (onParked) {
          setUrl("");
          return onParked();
        } else {
          setNote(result.alreadyQueued ? copy.imports.alreadyParked : copy.imports.parked);
        }
        setUrl("");
      },
      onError: () => setError(copy.common.somethingFailed),
    });
  }

  function submitText() {
    if (park.isPending) return;
    setNote(null);
    setExistingSlug(null);
    park.mutate({ sourceText: text }, {
      onSuccess: (result) => {
        if (!result.ok) return setError(result.error);
        setError(null);
        setText("");
        if (onParked) return onParked();
        setNote(copy.imports.parked);
      },
      onError: () => setError(copy.common.somethingFailed),
    });
  }

  return (
    <View className="gap-2">
      <Text className="font-body text-base text-text">{intro}</Text>
      <TextInput
        value={url}
        onChangeText={setUrl}
        placeholder="https://"
        accessibilityLabel={copy.imports.parkTitle}
        keyboardType="url"
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="go"
        onSubmitEditing={submit}
        className="min-h-11 rounded-input border-2 border-line bg-surface px-3 font-body text-base text-text"
      />
      <ArcadeButton
        label={copy.imports.parkAction}
        icon="link"
        tone="accent"
        disabled={park.isPending || url.trim() === ""}
        onPress={submit}
      />
      {onParked ? null : <Text className="font-body text-sm text-muted">{copy.imports.parkHint}</Text>}
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: pasting }}
        onPress={() => setPasting((open) => !open)}
        className="min-h-11 justify-center"
      >
        <Text className="font-bold text-sm text-text underline">
          {pasting ? "▾" : "▸"} {copy.imports.pasteToggle}
        </Text>
      </Pressable>
      {pasting ? (
        <>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={copy.imports.pastePlaceholder}
            accessibilityLabel={copy.imports.pasteLabel}
            multiline
            textAlignVertical="top"
            className="min-h-40 rounded-input border-2 border-line bg-surface px-3 py-2 font-body text-base text-text"
          />
          <ArcadeButton
            label={copy.imports.pasteAction}
            tone="accent"
            disabled={park.isPending || text.trim() === ""}
            onPress={submitText}
          />
        </>
      ) : null}
      {note ? (
        <Text accessibilityLiveRegion="polite" className="font-bold text-sm text-text">
          {note}{" "}
          {existingSlug ? (
            <Text
              accessibilityRole="link"
              onPress={() => router.push({ pathname: "/recipe/[slug]", params: { slug: existingSlug } })}
              className="text-accent underline"
            >
              {copy.imports.openExisting}
            </Text>
          ) : null}
        </Text>
      ) : null}
      {error ? (
        <Text accessibilityRole="alert" className="font-bold text-sm text-accent">
          {error}
        </Text>
      ) : null}
    </View>
  );
}
