import { copy } from "@openrecipe/core/copy";
import { emptyRecipe, httpUrlSchema } from "@openrecipe/core/recipe-schema";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";

import { Text } from "react-native";

import { ParkForm } from "../../components/drafts/park-form";
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
        // PRD §7.3: one entry point, both ways in. The web links over to Drafts;
        // on a phone that detour is a tab switch, so the link field sits here.
        banner={
          prefill ? undefined : (
            <>
              <ParkForm intro={copy.imports.orPasteLink} onParked={() => router.replace("/drafts")} />
              <Text className="mt-2 font-display text-xl uppercase text-text">{copy.imports.typeInstead}</Text>
            </>
          )
        }
        onSubmit={(v) => create.mutateAsync(v)}
        onSaved={({ slug }) => router.replace({ pathname: "/recipe/[slug]", params: { slug } })}
      />
    </>
  );
}
