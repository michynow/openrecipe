import * as cheerio from "cheerio";

/**
 * Getting the facts off a recipe page without asking a model to guess them
 * (OR-41).
 *
 * Two paths, in order of trust:
 *
 *   1. JSON-LD. Most recipe sites publish `@type: Recipe` for Google's benefit,
 *      and it is the page's own statement of what the ingredients are. Nothing
 *      is inferred from it.
 *   2. Readable text. Everything else — strip the furniture, keep the prose, and
 *      let the model structure it (OR-42). Weaker, and the result says so, so a
 *      Draft from this path can be flagged for closer review.
 *
 * Which path ran is part of the result rather than an internal detail: it is the
 * difference between "the site said 400 g of flour" and "a model read a page and
 * believes it said 400 g of flour".
 */

export type ExtractPath = "json-ld" | "readable-text";

export type ExtractedPage = {
  path: ExtractPath;
  title: string | null;
  imageUrl: string | null;
  ingredients: string[];
  instructions: string[];
  servings: number | null;
  totalMinutes: number | null;
  kcalPerServing: number | null;
  author: string | null;
  /** The page's prose, for the model. Only set on the readable-text path. */
  text: string | null;
};

/**
 * Failure reasons, kept as codes rather than sentences: the Worker maps them to
 * Polish for the Drafts screen, and a code can be tested without pinning copy.
 */
export type ExtractFailure =
  | "fetch-blocked"
  | "not-found"
  | "not-html"
  | "no-recipe-found";

/** How the page fetch went, for the Draft's log. */
export type FetchInfo = { status: number; bytes: number; ms: number };

export type ExtractResult =
  | { ok: true; page: ExtractedPage; fetched?: FetchInfo }
  /** `detail` is the technical why — "HTTP 403", "timeout after 20 s" — for the log. */
  | { ok: false; reason: ExtractFailure; detail?: string };

/* ────────────────────────────── JSON-LD ──────────────────────────────── */

type JsonValue = unknown;

/** Depth-first hunt for an @type: Recipe node, through @graph and arrays both. */
export function findRecipeNode(value: JsonValue): Record<string, JsonValue> | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findRecipeNode(item);
      if (found) return found;
    }
    return null;
  }

  if (value && typeof value === "object") {
    const node = value as Record<string, JsonValue>;
    const type = node["@type"];
    const isRecipe =
      type === "Recipe" || (Array.isArray(type) && type.includes("Recipe"));
    if (isRecipe) return node;

    for (const child of Object.values(node)) {
      const found = findRecipeNode(child);
      if (found) return found;
    }
  }

  return null;
}

/**
 * ISO-8601 durations to minutes. `PT1H30M` is 90; `P1DT2H` is 1560.
 *
 * Seconds are deliberately floored away rather than rounded up: no recipe means
 * anything by "45 minutes and 30 seconds", and rounding would turn a tidy 45
 * into a 46 that looks like a bug.
 */
export function isoDurationToMinutes(value: unknown): number | null {
  if (typeof value !== "string") return null;

  const match = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/.exec(
    value.trim(),
  );
  if (!match) return null;

  const [, days, hours, minutes] = match;
  const total =
    Number(days ?? 0) * 24 * 60 + Number(hours ?? 0) * 60 + Number(minutes ?? 0);

  return total > 0 ? total : null;
}

const text = (value: unknown): string | null => {
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) return text(value[0]);
  if (value && typeof value === "object") {
    const node = value as Record<string, unknown>;
    return text(node.name ?? node["@value"] ?? node.text ?? node.url);
  }
  return null;
};

/** Strips the tags a site left inside a JSON-LD string, which many do. */
const stripTags = (value: string) =>
  cheerio.load(`<div>${value}</div>`)("div").text().replace(/\s+/g, " ").trim();

/**
 * `recipeInstructions` arrives as plain strings, as HowToStep objects, or as
 * HowToSection groups with steps inside — sometimes several of those at once.
 * Sections are flattened rather than kept: Steps are a flat numbered list
 * (PRD §6), and a section heading is not a cooking instruction.
 */
export function instructionLines(value: unknown): string[] {
  const out: string[] = [];

  const walk = (item: unknown) => {
    if (!item) return;

    if (Array.isArray(item)) {
      item.forEach(walk);
      return;
    }

    if (typeof item === "string") {
      const cleaned = stripTags(item);
      if (cleaned) out.push(cleaned);
      return;
    }

    if (typeof item === "object") {
      const node = item as Record<string, unknown>;
      const type = node["@type"];

      if (type === "HowToSection" || node.itemListElement) {
        walk(node.itemListElement);
        return;
      }

      const line = text(node.text ?? node.name);
      if (line) out.push(stripTags(line));
    }
  };

  walk(value);
  return out.filter(Boolean);
}

/** "4 porcje", "4-6", 4 — all mean roughly four. Takes the first number. */
export function yieldToServings(value: unknown): number | null {
  const raw = text(value);
  if (!raw) return null;

  const match = /\d+/.exec(raw);
  if (!match) return null;

  const servings = Number(match[0]);
  return servings >= 1 && servings <= 99 ? servings : null;
}

/** "540 kcal", "540 calories", 540 — the number, when there is one. */
export function caloriesToNumber(value: unknown): number | null {
  const raw = text(value);
  if (!raw) return null;

  const match = /\d+/.exec(raw.replace(/\s/g, ""));
  if (!match) return null;

  const kcal = Number(match[0]);
  return kcal >= 0 && kcal <= 10_000 ? kcal : null;
}

function fromJsonLd(html: string): ExtractedPage | null {
  const $ = cheerio.load(html);

  for (const element of $('script[type="application/ld+json"]').toArray()) {
    const raw = $(element).text().trim();
    if (!raw) continue;

    let parsed: JsonValue;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // A malformed block is one site's mistake, not a reason to give up on the
      // page — there is often a second, valid one.
      continue;
    }

    const node = findRecipeNode(parsed);
    if (!node) continue;

    const ingredients = (
      Array.isArray(node.recipeIngredient) ? node.recipeIngredient : []
    )
      .map((line) => (typeof line === "string" ? stripTags(line) : null))
      .filter((line): line is string => Boolean(line));

    const instructions = instructionLines(node.recipeInstructions);

    // A Recipe node with neither is a stub — a "related recipes" card, usually.
    if (ingredients.length === 0 && instructions.length === 0) continue;

    const nutrition = (node.nutrition ?? {}) as Record<string, unknown>;

    return {
      path: "json-ld",
      title: text(node.name),
      imageUrl: text(node.image),
      ingredients,
      instructions,
      servings: yieldToServings(node.recipeYield),
      totalMinutes:
        isoDurationToMinutes(node.totalTime) ??
        // Some sites give the parts but not the sum.
        sumOrNull(
          isoDurationToMinutes(node.prepTime),
          isoDurationToMinutes(node.cookTime),
        ),
      kcalPerServing: caloriesToNumber(nutrition.calories),
      author: text(node.author),
      text: null,
    };
  }

  return null;
}

const sumOrNull = (a: number | null, b: number | null) =>
  a === null && b === null ? null : (a ?? 0) + (b ?? 0);

/* ─────────────────────────── Readable text ───────────────────────────── */

/** Furniture. Present on every page, part of no recipe. */
const CHROME = [
  "script",
  "style",
  "noscript",
  "nav",
  "header",
  "footer",
  "aside",
  "form",
  "iframe",
  "svg",
  "button",
];

/**
 * Class and id fragments that mark a block as not-the-recipe. Deliberately
 * short and English-plus-Polish: matched as substrings, so `related-recipes`
 * and `recipe-related` both go.
 */
const NOISE =
  /(comment|koment|advert|\bads?\b|banner|share|social|newsletter|subscri|related|polecane|popularne|sidebar|menu|breadcrumb|cookie|rodo|footer|nagłówek|reklama)/i;

/**
 * The page's prose, with the furniture removed.
 *
 * Not a Readability implementation: this feeds a model that is good at ignoring
 * leftovers, so the bar is "mostly the recipe", not "exactly the recipe". What
 * matters is that navigation and comment threads do not outweigh the content —
 * a comment section is where a model finds someone's variation and treats it as
 * an instruction.
 */
export function readableText(html: string, maxChars = 12_000): string {
  const $ = cheerio.load(html);

  $(CHROME.join(",")).remove();

  /**
   * Structural elements are never removed by their class, however noisy it
   * reads. Kwestia Smaku puts `one-sidebar sidebar-second` on <body> itself, and
   * matching that took the entire page out — the extractor then reported "no
   * recipe found" for a page that was nothing but recipe.
   */
  const STRUCTURAL = new Set(["html", "body", "main", "article"]);

  $("[class],[id]").each((_, element) => {
    if (STRUCTURAL.has(element.tagName?.toLowerCase())) return;

    const attrs = `${$(element).attr("class") ?? ""} ${$(element).attr("id") ?? ""}`;
    if (NOISE.test(attrs)) $(element).remove();
  });

  const root = $("article").first().length
    ? $("article").first()
    : $("main").first().length
      ? $("main").first()
      : $("body");

  return root
    .text()
    .replace(/[ \t ]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, maxChars);
}

/** Enough text that a recipe could plausibly be in there. */
const MIN_TEXT_CHARS = 400;

export function extractFromHtml(html: string): ExtractResult {
  const structured = fromJsonLd(html);
  if (structured) return { ok: true, page: structured };

  const $ = cheerio.load(html);
  const prose = readableText(html);

  if (prose.length < MIN_TEXT_CHARS) {
    return { ok: false, reason: "no-recipe-found" };
  }

  return {
    ok: true,
    page: {
      path: "readable-text",
      title:
        $('meta[property="og:title"]').attr("content")?.trim() ||
        $("h1").first().text().trim() ||
        null,
      imageUrl: $('meta[property="og:image"]').attr("content")?.trim() || null,
      ingredients: [],
      instructions: [],
      servings: null,
      totalMinutes: null,
      kcalPerServing: null,
      author: null,
      text: prose,
    },
  };
}

/* ───────────────────────────── Fetching ──────────────────────────────── */

/**
 * A browser-ish user agent, because a bare Node fetch is refused outright by a
 * good half of the recipe web. This is one household reading pages it was going
 * to read anyway, at the rate a person clicks — not a crawler.
 */
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const FETCH_TIMEOUT_MS = 20_000;

export async function fetchPage(url: string): Promise<
  | { ok: true; html: string; info: FetchInfo }
  | { ok: false; reason: ExtractFailure; detail: string }
> {
  const started = Date.now();
  let response: Response;

  try {
    response = await fetch(url, {
      headers: { "user-agent": USER_AGENT, accept: "text/html,*/*" },
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch (error) {
    // Timeout, DNS, TLS, connection refused — all "the page would not come",
    // but the log says which.
    const name = (error as Error).name;
    const detail =
      name === "TimeoutError"
        ? `brak odpowiedzi przez ${FETCH_TIMEOUT_MS / 1000} s`
        : `${name}: ${(error as Error).message}`;
    return { ok: false, reason: "fetch-blocked", detail };
  }

  // A dead link wants a different next move than a site that refuses us.
  if (response.status === 404 || response.status === 410) {
    return { ok: false, reason: "not-found", detail: `HTTP ${response.status}` };
  }
  if (!response.ok) {
    return { ok: false, reason: "fetch-blocked", detail: `HTTP ${response.status} ${response.statusText}`.trim() };
  }

  const type = response.headers.get("content-type") ?? "";
  if (!type.includes("html")) {
    return { ok: false, reason: "not-html", detail: `Content-Type: ${type || "brak"}` };
  }

  const html = await response.text();
  return {
    ok: true,
    html,
    info: { status: response.status, bytes: Buffer.byteLength(html), ms: Date.now() - started },
  };
}

/** Fetch and extract. The Worker's whole use of this module. */
export async function extractRecipeFromUrl(url: string): Promise<ExtractResult> {
  const fetched = await fetchPage(url);
  if (!fetched.ok) return fetched;

  const extracted = extractFromHtml(fetched.html);
  return extracted.ok ? { ...extracted, fetched: fetched.info } : extracted;
}
