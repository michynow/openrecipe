import { copy } from "@openrecipe/core/copy";
import { emptyRecipe, httpUrlSchema } from "@openrecipe/core/recipe-schema";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";

import { RecipeEditor } from "../../components/editor/recipe-editor";
import { AdminGateView, useAdminGate } from "../../components/ui/admin-gate";
import { StateView } from "../../components/ui/state-view";
import { useCreateRecipe } from "../../lib/hooks/editor";
import { useTags } from "../../lib/hooks/discovery";

export default function NewRecipe() {
  const { source } = useLocalSearchParams<{ source?: string }>();
  const router = useRouter();
  const gate = useAdminGate();
  const tags = useTags(gate.ok);
  const create = useCreateRecipe();

  if (!gate.ok) return <AdminGateView gate={gate} />;
  if (!tags.data)
    return tags.isError ? (
      <StateView title={copy.common.somethingFailed} action={{ label: copy.common.retry, onPress: () => tags.refetch() }} />
    ) : (
      <StateView />
    );

  // The failed-import fallback hands the link over (OR-45); only http(s) goes in the field.
  const prefill = source && httpUrlSchema.safeParse(source).success ? source : null;

  return (
    <>
      <Stack.Screen options={{ title: copy.editor.newTitle }} />
      <RecipeEditor
        heading={copy.editor.newTitle}
        tagGroups={tags.data}
        initial={{ ...emptyRecipe, sourceUrl: prefill }}
        onSubmit={(v) => create.mutateAsync(v)}
        onSaved={({ slug }) => router.replace({ pathname: "/recipe/[slug]", params: { slug } })}
      />
    </>
  );
}
