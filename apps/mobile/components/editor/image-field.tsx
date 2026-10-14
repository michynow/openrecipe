import { copy } from "@openrecipe/core/copy";
import { MAX_IMAGE_WIDTH } from "@openrecipe/core/blob";
import { Image } from "expo-image";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";

import { deleteUploadedImage, ImageRejected, uploadImage } from "../../lib/hooks/editor";
import { recipeImage } from "../../lib/image";
import { fitWidth, SessionUploads } from "../../lib/upload";
import { ArcadeButton } from "../ui/button";
import { ErrorText } from "./fields";

/**
 * Pick from the gallery (Android's photo picker, no permission), shrink to
 * MAX_IMAGE_WIDTH, encode WebP, upload. Removing or replacing a picture
 * uploaded in this session deletes it; one the Recipe already had is the
 * server's to drop on save.
 */
export function ImageField({
  value,
  onChange,
  uploads,
}: {
  value: string | null;
  onChange: (url: string | null) => void;
  /** Owned by the editor: it deletes what is left when you leave without saving. */
  uploads: SessionUploads;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const abort = useRef<AbortController | null>(null);
  const preview = recipeImage(value);

  useEffect(() => () => abort.current?.abort(), []);

  async function pick() {
    setError(undefined);
    let picked: ImagePicker.ImagePickerResult;
    try {
      picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 1 });
    } catch {
      setError(copy.editor.imageFailed);
      return;
    }
    if (picked.canceled) return;
    const asset = picked.assets[0];

    const controller = new AbortController();
    abort.current = controller;
    setBusy(true);
    try {
      const ctx = ImageManipulator.manipulate(asset.uri);
      const width = fitWidth(asset.width, MAX_IMAGE_WIDTH);
      if (width) ctx.resize({ width });
      const image = await (await ctx.renderAsync()).saveAsync({ format: SaveFormat.WEBP, compress: 0.85 });
      const url = await uploadImage(image.uri, controller.signal);
      if (uploads.take(value)) deleteUploadedImage(value!);
      uploads.add(url);
      onChange(url);
    } catch (e) {
      if (controller.signal.aborted) return;
      setError(e instanceof ImageRejected ? e.message : copy.editor.imageFailed);
    } finally {
      setBusy(false);
    }
  }

  function remove() {
    if (uploads.take(value)) deleteUploadedImage(value!);
    onChange(null);
  }

  return (
    <View className="gap-3">
      {preview && !busy ? (
        <Image
          source={preview}
          accessibilityLabel={copy.editor.image}
          contentFit="cover"
          className="aspect-[4/3] w-full rounded-2xl border-2 border-ink"
        />
      ) : null}
      {busy ? (
        <View accessibilityLiveRegion="polite" className="flex-row items-center gap-3">
          <ActivityIndicator />
          <Text className="flex-1 font-bold text-text">{copy.editor.uploading}</Text>
          <ArcadeButton tone="surface" label={copy.editor.cancelUpload} onPress={() => abort.current?.abort()} />
        </View>
      ) : (
        <View className="flex-row flex-wrap gap-2">
          <ArcadeButton label={value ? copy.editor.replaceImage : copy.editor.pickImage} onPress={pick} />
          {value ? <ArcadeButton tone="surface" label={copy.editor.removeImage} onPress={remove} /> : null}
        </View>
      )}
      <Text className="text-sm text-muted">{copy.editor.imageHint}</Text>
      <ErrorText>{error}</ErrorText>
    </View>
  );
}
