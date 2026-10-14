import type { RecipeDetail } from "@openrecipe/core/api";
import { confirmDelete, copy } from "@openrecipe/core/copy";
import { formatDate, formatDuration } from "@openrecipe/core/format";
import { Image } from "expo-image";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, Text, View } from "react-native";

import { CookingPanel } from "../../components/recipe/cooking-panel";
import { CookLog } from "../../components/recipe/cook-log";
import { KeepAwakeToggle } from "../../components/recipe/keep-awake-toggle";
import { HelpButton } from "../../components/ui/help-button";
import { ArcadeButton } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Icon } from "../../components/ui/pixel";
import { TagChip } from "../../components/ui/tag-chip";
import { showToast } from "../../components/ui/toast";
import { ApiError, useMe } from "../../lib/api";
import { useDeleteRecipe, useReimport, useRestoreRecipe } from "../../lib/hooks/editor";
import { useRecipe } from "../../lib/hooks/recipe";
import { recipeImage } from "../../lib/image";

/** A null field renders as nothing at all, as on the web. */
export default function RecipeScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const { data, error, isPending, refetch, fetchStatus } = useRecipe(slug);
  const isAdmin = useMe().data?.isAdmin === true;

  if (!data) {
    if (isPending) {
      return (
        <View className="flex-1 items-center justify-center bg-bg">
          <ActivityIndicator />
        </View>
      );
    }
    const missing = error instanceof ApiError && error.status === 404;
    return (
      <View className="flex-1 items-center justify-center gap-3 bg-bg px-6">
        <Text className="text-center font-display text-4xl uppercase text-text">
          {missing ? copy.common.notFoundTitle : copy.common.somethingFailed}
        </Text>
        {missing && <Text className="text-center text-sm text-muted">{copy.common.notFoundBody}</Text>}
        <ArcadeButton
          label={missing ? copy.common.backHome : copy.common.retry}
          onPress={() => (missing ? router.replace("/") : refetch())}
        />
      </View>
    );
  }

  const { recipe, cookLog, shoppingListServings } = data;
  const duration = formatDuration(recipe.totalMinutes);
  const image = recipeImage(recipe.imageUrl);
  // Cached copy on screen, but the server could not be reached.
  const stale = error !== null || fetchStatus === "paused";

  return (
    <ScrollView className="flex-1 bg-bg" contentContainerClassName="gap-5 px-4 py-4 pb-12">
      <Stack.Screen
        options={{ title: recipe.title, headerRight: () => (
            <View className="flex-row items-center gap-2">
              <HelpButton topic="recipe" />
              {isAdmin ? <AdminActions recipe={recipe} /> : null}
            </View>
          ), }}
      />

      {stale && <Text className="text-sm text-muted">{copy.common.offline}</Text>}

      {image ? (
        <Image source={image} accessibilityLabel={recipe.title} contentFit="cover" className="aspect-[4/3] w-full rounded-2xl border-2 border-ink" />
      ) : (
        <View className="aspect-[4/3] w-full items-center justify-center rounded-2xl bg-fill">
          <Text className="font-display text-6xl uppercase text-muted">{recipe.title.slice(0, 2)}</Text>
        </View>
      )}

      <View className="gap-3">
        <Text className="font-display text-4xl uppercase leading-none text-text">{recipe.title}</Text>
        <Text className="text-sm text-muted">
          {copy.recipe.addedBy} {recipe.author.name} · {formatDate(recipe.createdAt)}
          {recipe.lastEditor ? ` · ${copy.recipe.editedBy} ${recipe.lastEditor.name}` : ""}
        </Text>
        {(duration || recipe.kcalPerServing !== null) && (
          <View className="flex-row flex-wrap gap-4">
            {duration && <Stat label={copy.recipe.time} value={duration} />}
            {recipe.kcalPerServing !== null && (
              <Stat label={copy.recipe.kcalPerServing} value={String(recipe.kcalPerServing)} />
            )}
          </View>
        )}
        {recipe.tags.length > 0 && (
          <View className="flex-row flex-wrap gap-2">
            {recipe.tags.map((tag) => (
              <TagChip key={tag.slug} tag={tag} />
            ))}
          </View>
        )}
        {recipe.sourceUrl && /^https?:\/\//i.test(recipe.sourceUrl) && (
          <ArcadeButton
            label={copy.recipe.openSource}
            tone="surface"
            // Only http(s): the field is data, and a `tel:`/`intent:` link must not fire.
            onPress={() => Linking.openURL(recipe.sourceUrl!).catch(() => {})}
          />
        )}
      </View>

      <KeepAwakeToggle />

      <CookingPanel key={recipe.id} recipe={recipe} shoppingListServings={shoppingListServings} />

      <Card className="gap-2 p-4">
        <Text className="font-display text-xl uppercase text-text">{copy.recipe.steps}</Text>
        {recipe.steps.map((step, i) => (
          <View key={i} className="flex-row gap-3">
            <Text className="w-8 text-right text-xl font-bold text-accent">{i + 1}.</Text>
            <Text className="flex-1 text-xl leading-8 text-text">{step}</Text>
          </View>
        ))}
      </Card>

      {recipe.tips.length > 0 && (
        <Card className="gap-2 p-4">
          <Text className="font-display text-lg uppercase text-text">{copy.recipe.tips}</Text>
          {recipe.tips.map((tip, i) => (
            <Text key={i} className="text-base leading-6 text-text">
              {tip}
            </Text>
          ))}
        </Card>
      )}

      <CookLog recipeId={recipe.id} times={cookLog.times} lastCookedAt={cookLog.lastCookedAt} />
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <Text className="text-xs uppercase text-muted">{label}</Text>
      <Text className="text-lg font-bold text-text">{value}</Text>
    </View>
  );
}

function HeaderButton({ icon, label, onPress }: { icon: "edit" | "refresh" | "remove"; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      className="size-11 items-center justify-center"
    >
      <Icon name={icon} size={22} tone="ink" />
    </Pressable>
  );
}

/** Admin-only: edit, import again, delete (with an undo toast, like the web). */
function AdminActions({ recipe }: { recipe: RecipeDetail }) {
  const router = useRouter();
  const del = useDeleteRecipe();
  const restore = useRestoreRecipe();
  const reimport = useReimport();

  function confirmDeleteRecipe() {
    Alert.alert(confirmDelete(recipe.title), undefined, [
      { text: copy.editor.cancel, style: "cancel" },
      {
        text: copy.common.delete,
        style: "destructive",
        onPress: () =>
          del
            .mutateAsync(recipe.id)
            .then(() => {
              router.back();
              showToast({
                message: copy.common.deleted,
                action: {
                  label: copy.common.undo,
                  // Fails quietly once the server's grace window has closed.
                  onPress: () =>
                    restore
                      .mutateAsync(recipe.id)
                      .then((r) => r.ok && router.push({ pathname: "/recipe/[slug]", params: { slug: recipe.slug } }))
                      .catch(() => {}),
                },
              });
            })
            .catch(() => Alert.alert(copy.common.somethingFailed)),
      },
    ]);
  }

  function confirmReimport() {
    Alert.alert(copy.imports.reimport, copy.imports.reimportConfirm, [
      { text: copy.editor.cancel, style: "cancel" },
      {
        text: copy.imports.reimport,
        onPress: () =>
          reimport
            .mutateAsync(recipe.id)
            .then(() => {
              showToast({ message: copy.imports.reimportQueued, kielbas: true });
              router.push("/drafts");
            })
            .catch(() => Alert.alert(copy.common.somethingFailed)),
      },
    ]);
  }

  return (
    <View className="flex-row">
      <HeaderButton
        icon="edit"
        label={copy.editor.editTitle}
        onPress={() => router.push({ pathname: "/editor/[slug]", params: { slug: recipe.slug } })}
      />
      {recipe.sourceUrl ? <HeaderButton icon="refresh" label={copy.imports.reimport} onPress={confirmReimport} /> : null}
      <HeaderButton icon="remove" label={copy.common.delete} onPress={confirmDeleteRecipe} />
    </View>
  );
}
