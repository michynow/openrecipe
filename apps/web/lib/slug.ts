/**
 * Slugs for Recipe URLs.
 *
 * Polish titles need transliteration, not just lowercasing: "Żurek" must become
 * "zurek", and NFD-stripping alone leaves ł untouched because Ł is a distinct
 * letter rather than L with a diacritic.
 */

/** Letters that decomposition does not handle. */
const SPECIAL: Record<string, string> = {
  ł: "l",
  Ł: "l",
  ø: "o",
  æ: "ae",
  œ: "oe",
  ß: "ss",
  đ: "d",
  ð: "d",
  þ: "th",
};

export function slugify(title: string): string {
  const transliterated = [...title.trim()]
    .map((char) => SPECIAL[char] ?? char)
    .join("")
    // Decompose, then drop the combining marks: ą → a, ś → s, é → e.
    .normalize("NFD")
    .replace(/\p{M}+/gu, "");

  const slug = transliterated
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    // Slicing can leave a trailing hyphen.
    .replace(/-+$/g, "");

  // A title of pure punctuation or non-Latin script would otherwise yield "".
  return slug || "przepis";
}

/**
 * Append a numeric suffix until the slug is free.
 *
 * `taken` is asked per candidate rather than handed a list, so the caller can let
 * the database answer — and the unique index on `recipe.slug` remains the real
 * guarantee if two creates race.
 */
export async function uniqueSlug(
  title: string,
  taken: (candidate: string) => Promise<boolean>,
): Promise<string> {
  const base = slugify(title);
  if (!(await taken(base))) return base;

  for (let n = 2; n < 1000; n++) {
    const candidate = `${base}-${n}`;
    if (!(await taken(candidate))) return candidate;
  }

  // Pathological: 1000 recipes with the same title. Fall back to something unique.
  return `${base}-${Date.now().toString(36)}`;
}
