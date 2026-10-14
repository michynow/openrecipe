import { API_URL, getCookie } from "./auth";
import { imageSource, type ImageSource } from "./image-source";

/** Source for expo-image; the rules live in image-source.ts. */
export function recipeImage(url: string | null): ImageSource | null {
  return imageSource(url, API_URL, getCookie());
}
