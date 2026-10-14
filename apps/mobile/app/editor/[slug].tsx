import { copy } from "@openrecipe/core/copy";
import { toFormValue } from "@openrecipe/core/recipe-schema";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";

import { RecipeEditor } from "../../components/editor/recipe-editor";
import { AdminGateView, useAdminGate } from "../../components/ui/admin-gate";
import { NotFound, StateView } from "../../components/ui/state-view";
import { ApiError } from "../../lib/api";
import { useTags } from "../../lib/hooks/discovery";
import { useUpdateRecipe } from "../../lib/hooks/editor";
import { useRecipe } from "../../lib/hooks/recipe";

export default function EditRecipe() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const gate = useAdminGate();
  const recipe = useRecipe(slug);
  const tags = useTags(gate.ok);
  const update = useUpdateRecipe(recipe.data?.recipe.id ?? "");

  if (!gate.ok) return <AdminGateView gate={gate} />;
  if (recipe.error instanceof ApiError && recipe.error.status === 404) return <NotFound />;
  if (!recipe.data || !tags.data)
    return recipe.isError || tags.isError ? (
      <StateView
        title={copy.common.somethingFailed}
        action={{ label: copy.common.retry, onPress: () => (recipe.isError ? recipe.refetch() : tags.refetch()) }}
      />
    ) : (
      <StateView />
    );

  return (
    <>
      <Stack.Screen options={{ title: copy.editor.editTitle }} />
      <RecipeEditor
        key={recipe.data.recipe.id}
        heading={copy.editor.editTitle}
        tagGroups={tags.data}
        initial={toFormValue(recipe.data.recipe)}
        onSubmit={(v) => update.mutateAsync(v)}
        onSaved={() => router.back()}
      />
    </>
  );
}
