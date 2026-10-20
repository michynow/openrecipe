import type { TagResult, TagRow } from "@openrecipe/core/api";
import { copy } from "@openrecipe/core/copy";
import { count } from "@openrecipe/core/format";
import { FACETS, TAG_SLUG, type Facet } from "@openrecipe/core/tags";
import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import { useAddTag, useDeleteTag, useRenameTag } from "../../lib/hooks/admin";
import { ArcadeButton } from "../ui/button";
import { Card } from "../ui/card";
import { showDialog } from "../ui/dialog";
import { HEADING, INPUT } from "./styles";

/** A TagResult refusal as copy, or null when it went through. */
const refusal = (res: TagResult) => (res.ok ? null : copy.settings.tagErrors[res.reason]);

function TagItem({ tag }: { tag: TagRow }) {
  const rename = useRenameTag();
  const del = useDeleteTag();
  const [label, setLabel] = useState(tag.label);
  const [error, setError] = useState<string | null>(null);
  const inUse = tag.uses > 0;

  const settle = (res: TagResult) => setError(refusal(res));
  const fail = () => setError(copy.common.somethingFailed);
  const confirmDelete = () =>
    showDialog(`${copy.common.delete}: ${tag.label}?`, undefined, [
      { text: copy.editor.cancel, style: "cancel" },
      {
        text: copy.common.delete,
        style: "destructive",
        onPress: () => del.mutate(tag.id, { onSuccess: settle, onError: fail }),
      },
    ]);

  return (
    <View className="gap-1 rounded-input border-2 border-line bg-surface px-2 py-1.5">
      <View className="flex-row items-center gap-2">
        <TextInput
          value={label}
          onChangeText={setLabel}
          accessibilityLabel={`${copy.settings.tagLabel}: ${tag.slug}`}
          className="min-h-11 min-w-0 flex-1 px-2 font-body text-base text-text"
        />
        <Pressable
          accessibilityRole="button"
          disabled={label.trim() === "" || label.trim() === tag.label || rename.isPending}
          onPress={() => rename.mutate({ id: tag.id, label: label.trim() }, { onSuccess: settle, onError: fail })}
          className={`min-h-11 justify-center px-2 ${label.trim() === tag.label ? "opacity-40" : ""}`}
        >
          <Text className="font-bold text-sm text-text underline">{copy.settings.rename}</Text>
        </Pressable>
      </View>
      <View className="flex-row items-center justify-between gap-2 px-2">
        <Text className="font-body text-sm text-muted">{tag.slug}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: inUse }}
          accessibilityLabel={inUse ? `${copy.settings.tagInUse} ${count(tag.uses, copy.units.recipes)}` : copy.common.delete}
          disabled={inUse || del.isPending}
          onPress={confirmDelete}
          className="min-h-11 justify-center"
        >
          <Text className={`font-bold text-sm ${inUse ? "text-muted" : "text-accent underline"}`}>
            {inUse ? count(tag.uses, copy.units.recipes) : copy.common.delete}
          </Text>
        </Pressable>
      </View>
      {error ? (
        <Text accessibilityRole="alert" className="px-2 font-bold text-sm text-accent">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

function AddTag() {
  const add = useAddTag();
  const [facet, setFacet] = useState<Facet>(FACETS[0]);
  const [slug, setSlug] = useState("");
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit() {
    const s = slug.trim().toLowerCase();
    if (!TAG_SLUG.test(s)) return setError(copy.settings.tagErrors.slug);
    if (label.trim() === "") return setError(copy.validation.titleRequired);
    setError(null);
    add.mutate(
      { facet, slug: s, label: label.trim() },
      {
        onSuccess: (res) => {
          setError(refusal(res));
          if (res.ok) {
            setSlug("");
            setLabel("");
          }
        },
        onError: () => setError(copy.common.somethingFailed),
      },
    );
  }

  return (
    <View className="gap-2 rounded-card border-2 border-line bg-surface p-3">
      <View accessibilityLabel={copy.editor.tags} className="flex-row flex-wrap gap-2">
        {FACETS.map((f) => (
          <Pressable
            key={f}
            accessibilityRole="radio"
            accessibilityState={{ selected: facet === f }}
            onPress={() => setFacet(f)}
            className={`min-h-11 justify-center rounded-input border-2 border-line px-3 ${facet === f ? "bg-gold" : "bg-bg"}`}
          >
            <Text className={`font-bold text-sm ${facet === f ? "text-ink" : "text-text"}`}>{copy.editor.facets[f]}</Text>
          </Pressable>
        ))}
      </View>
      <TextInput
        value={slug}
        onChangeText={setSlug}
        placeholder={copy.settings.tagSlug}
        accessibilityLabel={copy.settings.tagSlug}
        autoCapitalize="none"
        autoCorrect={false}
        className={INPUT}
      />
      <TextInput
        value={label}
        onChangeText={setLabel}
        placeholder={copy.settings.tagLabel}
        accessibilityLabel={copy.settings.tagLabel}
        className={INPUT}
      />
      <ArcadeButton label={copy.settings.addTag} tone="accent" disabled={add.isPending} onPress={submit} />
      {error ? (
        <Text accessibilityRole="alert" className="font-bold text-sm text-accent">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

export function TagsSection({ tags }: { tags: TagRow[] }) {
  return (
    <Card className="gap-3 p-4">
      <Text className={HEADING}>{copy.settings.tags}</Text>
      <Text className="font-body text-sm text-muted">{copy.settings.tagSlugFixed}</Text>
      <AddTag />
      {FACETS.map((facet) => {
        const group = tags.filter((t) => t.facet === facet);
        if (group.length === 0) return null;
        return (
          <View key={facet} className="gap-1.5">
            <Text className="font-bold text-sm uppercase text-text">{copy.editor.facets[facet]}</Text>
            {group.map((t) => (
              <TagItem key={t.id} tag={t} />
            ))}
          </View>
        );
      })}
    </Card>
  );
}
