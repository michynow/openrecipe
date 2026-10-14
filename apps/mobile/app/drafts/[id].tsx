import { copy } from "@openrecipe/core/copy";
import { guessedFields } from "@openrecipe/core/inferred";
import { isHttpUrl } from "@openrecipe/core/recipe-schema";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Alert, Linking, Text, View } from "react-native";

import { GuessedChip } from "../../components/editor/fields";
import { RecipeEditor } from "../../components/editor/recipe-editor";
import { ReimportDiff } from "../../components/editor/reimport-diff";
import { AdminGateView, useAdminGate } from "../../components/ui/admin-gate";
import { StateView } from "../../components/ui/state-view";
import { ArcadeButton } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { showToast } from "../../components/ui/toast";
import { ApiError } from "../../lib/api";
import { useApproveDraft, useDiscardDraft, useDraft, useRetryDraft } from "../../lib/hooks/drafts";

export default function DraftReview() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const gate = useAdminGate();
  const query = useDraft(id, gate.ok);
  const approve = useApproveDraft(id);
  const retry = useRetryDraft();
  const discard = useDiscardDraft();
  const [notReady, setNotReady] = useState(false);

  const toDrafts = { label: copy.imports.draftsTitle, onPress: () => router.replace("/drafts") };

  if (!gate.ok) return <AdminGateView gate={gate} />;
  const gone = notReady || (query.error instanceof ApiError && query.error.status === 404);
  if (gone) return <StateView title={copy.imports.review} body={copy.imports.notReady} action={toDrafts} />;
  if (!query.data)
    return query.isError ? (
      <StateView title={copy.common.somethingFailed} action={{ label: copy.common.retry, onPress: () => query.refetch() }} />
    ) : (
      <StateView />
    );

  const { draft, tags } = query.data;
  const reimport = Boolean(draft.recipeId && draft.current);
  const guessed = guessedFields(reimport ? [] : draft.inferred);
  const link = isHttpUrl(draft.sourceUrl) ? draft.sourceUrl : null;

  function confirmDiscard(leave: (go: () => void) => void) {
    Alert.alert(copy.imports.discardConfirm, undefined, [
      { text: copy.editor.cancel, style: "cancel" },
      {
        text: copy.imports.discard,
        style: "destructive",
        onPress: () =>
          discard
            .mutateAsync(id)
            .then((r) => r.ok && leave(() => router.replace("/drafts")))
            .catch(() => {}),
      },
    ]);
  }

  return (
    <>
      <Stack.Screen options={{ title: reimport ? copy.imports.reviewChangesTitle : copy.imports.reviewTitle }} />
      <RecipeEditor
        heading={reimport ? copy.imports.reviewChangesTitle : copy.imports.reviewTitle}
        tagGroups={tags}
        // A re-import starts from the Recipe you have, never from the import.
        initial={reimport ? draft.current! : draft.payload}
        inferred={reimport ? [] : draft.inferred}
        submitLabel={reimport ? copy.imports.updateRecipe : copy.imports.approve}
        onSubmit={async (input) => {
          const res = await approve.mutateAsync({ input, recipeId: draft.recipeId ?? undefined });
          if (!res.ok && res.reason === "not-ready") setNotReady(true);
          return res;
        }}
        onSaved={({ slug }) => {
          router.replace({ pathname: "/recipe/[slug]", params: { slug } });
          showToast({ message: copy.imports.approved, kielbas: true });
        }}
        banner={(h) => (
          <View className="gap-3">
            <Card className="gap-2 p-3">
              <Text className="text-sm text-text">{reimport ? copy.imports.diffHint : copy.imports.reviewHint}</Text>
              <Text className="text-sm text-muted">
                {copy.imports.fromSource}{" "}
                {link ? (
                  <Text
                    accessibilityRole="link"
                    className="text-accent underline"
                    // Only http(s): the field is data, and a `tel:`/`intent:` link must not fire.
                    onPress={() => Linking.openURL(link).catch(() => {})}
                  >
                    {link}
                  </Text>
                ) : (
                  draft.sourceUrl
                )}
              </Text>
              {guessed.fields.size > 0 && (
                <View className="gap-1">
                  <GuessedChip />
                  <Text className="text-sm text-text">{copy.imports.guessedLegend}</Text>
                </View>
              )}
              {guessed.untranslated && <Text className="font-bold text-sm text-text">{copy.imports.untranslated}</Text>}
            </Card>
            {reimport && <ReimportDiff current={draft.current!} incoming={draft.payload} value={h.value} apply={h.apply} />}
          </View>
        )}
        extraActions={({ leave }) => (
          <>
            <ArcadeButton
              tone="surface"
              label={copy.imports.retry}
              disabled={retry.isPending}
              onPress={() =>
                retry
                  .mutateAsync(id)
                  .then((r) => r.ok && leave(() => router.replace("/drafts")))
                  .catch(() => {})
              }
            />
            <ArcadeButton
              tone="surface"
              label={copy.imports.discard}
              disabled={discard.isPending}
              onPress={() => confirmDiscard(leave)}
            />
          </>
        )}
      />
    </>
  );
}
