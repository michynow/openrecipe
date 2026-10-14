import type { FacetGroup, SaveResult } from "@openrecipe/core/api";
import { copy } from "@openrecipe/core/copy";
import { firstErrorField, toFieldErrors, type FieldErrors } from "@openrecipe/core/form-errors";
import { guessedFields } from "@openrecipe/core/inferred";
import { emptyRecipe, recipeSchema, type RecipeFormValue } from "@openrecipe/core/recipe-schema";
import { useNavigation, useRouter } from "expo-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Alert, ScrollView, Text, View } from "react-native";

import { ArcadeButton } from "../ui/button";
import { ErrorText, Field, FieldRegistry, GuessedChip, Section } from "./fields";
import { ImageField } from "./image-field";
import { IngredientLines } from "./ingredient-lines";
import { LineList } from "./line-list";
import { TagPicker } from "./tag-picker";
import { deleteUploadedImage } from "../../lib/hooks/editor";
import { SessionUploads } from "../../lib/upload";

/** Focus order: the form's order, not Zod's report order. */
const FIELD_ORDER = [
  "title",
  "servings",
  "totalMinutes",
  "kcalPerServing",
  "sourceUrl",
  "ingredientLines",
  "tagSlugs",
  "steps",
  "tips",
] as const;

export type Banner =
  | ReactNode
  | ((h: { value: RecipeFormValue; apply: (patch: Partial<RecipeFormValue>) => void }) => ReactNode);

/** Empty text means absent (null), as the web's schema reads "". */
const numberOrNull = (raw: string) => (raw === "" ? null : Number(raw));

/** The one Recipe form: new, edit and Draft review (as on the web). */
export function RecipeEditor({
  initial,
  tagGroups,
  onSubmit,
  onSaved,
  heading,
  inferred = [],
  banner,
  submitLabel,
  extraActions,
}: {
  initial?: RecipeFormValue;
  tagGroups: FacetGroup[];
  onSubmit: (v: RecipeFormValue) => Promise<SaveResult>;
  /** Called after a successful save, once leaving is no longer "losing changes". */
  onSaved: (r: { slug: string; id: string }) => void;
  heading: string;
  inferred?: string[];
  banner?: Banner;
  submitLabel?: string;
  /**
   * Buttons beside Save. As a function it gets `leave(go)`: for actions that end
   * the editing on purpose (retry, discard), which skips the "unsaved changes"
   * prompt — their own confirm already asked — and drops this session's uploads.
   */
  extraActions?: ReactNode | ((h: { leave: (go: () => void) => void }) => ReactNode);
}) {
  const guessedSet = guessedFields(inferred).fields;
  const guessed = (f: string) => guessedSet.has(f);
  const router = useRouter();
  const navigation = useNavigation();
  const [value, setValue] = useState<RecipeFormValue>(initial ?? emptyRecipe);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [pending, setPending] = useState(false);
  const dirty = useRef(false);
  const uploads = useRef(new SessionUploads());
  /** Leaving unsaved: blobs uploaded in this session would be orphans. */
  const releaseUploads = () => uploads.current.drain().forEach((url) => void deleteUploadedImage(url));
  // A ref, not the `pending` state: state alone lets three quick taps through (the web hit this).
  const submitting = useRef(false);
  const scroll = useRef<ScrollView>(null);
  const frame = useRef<View>(null);
  const scrollY = useRef(0);
  const nodes = useRef(new Map<string, View>());

  const reg = (key: string) => (node: View | null) => {
    if (node) nodes.current.set(key, node);
    else nodes.current.delete(key);
  };

  useEffect(
    () =>
      navigation.addListener("beforeRemove", (e) => {
        if (!dirty.current) {
          releaseUploads(); // nothing after a save: it clears the set
          return;
        }
        e.preventDefault();
        Alert.alert(copy.editor.unsavedChanges, undefined, [
          { text: copy.editor.cancel, style: "cancel" },
          {
            text: copy.imports.discard,
            style: "destructive",
            onPress: () => {
              dirty.current = false;
              releaseUploads();
              navigation.dispatch(e.data.action);
            },
          },
        ]);
      }),
    [navigation],
  );

  function set<K extends keyof RecipeFormValue>(key: K, next: RecipeFormValue[K]) {
    dirty.current = true;
    setValue((v) => ({ ...v, [key]: next }));
  }

  /** Validate one field on blur, without flagging fields not touched yet. */
  function validateField(field: string) {
    const r = recipeSchema.safeParse(value);
    const all = r.success ? {} : toFieldErrors(r.error);
    setErrors((cur) => {
      const next = { ...cur };
      const hit = Object.keys(all).find((k) => k === field || k.startsWith(`${field}.`));
      if (hit) next[field] = all[hit];
      else delete next[field];
      return next;
    });
  }

  function scrollTo(key: string) {
    // "steps.2" has no node of its own: fall back to the list it belongs to.
    const node = nodes.current.get(key) ?? nodes.current.get(key.split(".")[0]);
    const box = frame.current;
    if (!node || !box) return;
    // Window-relative positions of both, plus how far the list is already scrolled.
    box.measureInWindow((_x, boxY) =>
      node.measureInWindow((_nx, nodeY) =>
        scroll.current?.scrollTo({ y: Math.max(0, scrollY.current + nodeY - boxY - 16), animated: true }),
      ),
    );
  }

  async function submit() {
    if (submitting.current) return;
    const parsed = recipeSchema.safeParse(value);
    if (!parsed.success) {
      const fieldErrors = toFieldErrors(parsed.error);
      setErrors(fieldErrors);
      const target = firstErrorField(fieldErrors, FIELD_ORDER);
      if (target) scrollTo(target);
      return;
    }

    submitting.current = true;
    setPending(true);
    let result: SaveResult;
    try {
      result = await onSubmit(value);
    } catch {
      result = { ok: false, errors: [copy.common.somethingFailed] };
    }
    if (!result.ok) {
      setErrors({ _form: result.errors.join(" ") });
      setPending(false);
      submitting.current = false;
      scroll.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    dirty.current = false;
    uploads.current.clear(); // the saved Recipe owns its image now
    onSaved(result);
  }

  const apply = (patch: Partial<RecipeFormValue>) => {
    dirty.current = true;
    setValue((v) => ({ ...v, ...patch }));
  };

  return (
    <FieldRegistry.Provider value={reg}>
    <View ref={frame} className="flex-1">
      <ScrollView
        ref={scroll}
        className="flex-1 bg-bg"
        contentContainerClassName="gap-5 px-4 py-4 pb-16"
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={16}
        onScroll={(e) => (scrollY.current = e.nativeEvent.contentOffset.y)}
        automaticallyAdjustKeyboardInsets
      >
        <Text accessibilityRole="header" className="font-display text-3xl uppercase text-text">
          {heading}
        </Text>

        {errors._form ? <ErrorText>{errors._form}</ErrorText> : null}

        {typeof banner === "function" ? banner({ value, apply }) : banner}

        <Section icon="basics" label={copy.editor.basics}>
          <Field
            id="title"
            label={copy.editor.title}
            value={value.title}
            onChangeText={(t) => set("title", t)}
            onBlur={() => validateField("title")}
            error={errors.title}
            guessed={guessed("title")}
          />
          <Field
            id="servings"
            label={copy.recipe.servings}
            keyboardType="number-pad"
            value={value.servings ? String(value.servings) : ""}
            onChangeText={(t) => set("servings", Number(t))}
            onBlur={() => validateField("servings")}
            error={errors.servings}
            guessed={guessed("servings")}
          />
          <Field
            id="totalMinutes"
            label={copy.editor.totalMinutes}
            hint={copy.editor.optional}
            keyboardType="number-pad"
            value={value.totalMinutes === null ? "" : String(value.totalMinutes)}
            onChangeText={(t) => set("totalMinutes", numberOrNull(t))}
            onBlur={() => validateField("totalMinutes")}
            error={errors.totalMinutes}
            guessed={guessed("totalMinutes")}
          />
          <Field
            id="kcalPerServing"
            label={copy.editor.kcal}
            hint={copy.editor.optional}
            keyboardType="number-pad"
            value={value.kcalPerServing === null ? "" : String(value.kcalPerServing)}
            onChangeText={(t) => set("kcalPerServing", numberOrNull(t))}
            onBlur={() => validateField("kcalPerServing")}
            error={errors.kcalPerServing}
            guessed={guessed("kcalPerServing")}
          />
          <Field
            id="sourceUrl"
            label={copy.editor.sourceUrl}
            hint={copy.editor.optional}
            keyboardType="url"
            autoCapitalize="none"
            autoCorrect={false}
            value={value.sourceUrl ?? ""}
            onChangeText={(t) => set("sourceUrl", t || null)}
            onBlur={() => validateField("sourceUrl")}
            error={errors.sourceUrl}
          />
        </Section>

        <Section icon="ingredients" label={copy.recipe.ingredients} trailing={guessed("ingredientLines") ? <GuessedChip /> : undefined}>
          <IngredientLines values={value.ingredientLines} onChange={(n) => set("ingredientLines", n)} errors={errors} />
        </Section>

        <Section
          icon="tags"
          label={copy.editor.tags}
          trailing={
            <View className="flex-row items-center gap-2">
              {guessed("tagSlugs") ? <GuessedChip /> : null}
              <Text className="font-bold text-sm text-muted">
                {value.tagSlugs.length} {copy.editor.tagsCount}
              </Text>
            </View>
          }
        >
          <TagPicker groups={tagGroups} selected={value.tagSlugs} onChange={(n) => set("tagSlugs", n)} error={errors.tagSlugs} />
        </Section>

        <Section icon="image" label={copy.editor.image}>
          <ImageField value={value.imageUrl} onChange={(url) => set("imageUrl", url)} uploads={uploads.current} />
        </Section>

        <Section icon="steps" label={copy.recipe.steps} trailing={guessed("steps") ? <GuessedChip /> : undefined}>
          <LineList
            id="steps"
            label={copy.recipe.steps}
            values={value.steps}
            onChange={(n) => set("steps", n)}
            addLabel={copy.editor.addStep}
            placeholder={copy.editor.stepPlaceholder}
            error={errors.steps ?? Object.entries(errors).find(([k]) => k.startsWith("steps."))?.[1]}
            onBlur={() => validateField("steps")}
          />
        </Section>

        <Section icon="tips" label={copy.recipe.tips} trailing={guessed("tips") ? <GuessedChip /> : undefined}>
          <LineList
            id="tips"
            label={copy.recipe.tips}
            values={value.tips}
            onChange={(n) => set("tips", n)}
            addLabel={copy.editor.addTip}
            placeholder={copy.editor.tipPlaceholder}
            error={errors.tips ?? Object.entries(errors).find(([k]) => k.startsWith("tips."))?.[1]}
            onBlur={() => validateField("tips")}
          />
        </Section>

        {Object.keys(errors).length > 0 && !errors._form ? <ErrorText>{copy.editor.fixErrors}</ErrorText> : null}

        <View className="gap-3">
          <ArcadeButton
            tone="accent"
            label={pending ? copy.editor.saving : (submitLabel ?? copy.editor.save)}
            disabled={pending}
            onPress={submit}
          />
          {typeof extraActions === "function"
            ? extraActions({
                leave: (go) => {
                  dirty.current = false;
                  releaseUploads();
                  go();
                },
              })
            : extraActions}
          <ArcadeButton tone="surface" label={copy.editor.cancel} disabled={pending} onPress={() => router.back()} />
        </View>
      </ScrollView>
    </View>
    </FieldRegistry.Provider>
  );
}
